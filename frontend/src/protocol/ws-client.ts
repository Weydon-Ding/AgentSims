import type {
  PushFrame,
  RequestFrame,
  RequestFrameByUri,
  ResponseEnvelope,
  Uid,
} from './types';
import { WsClientError, WsRequestTimeoutError } from './ws-client-errors';
import { correlationKey, isEnvelope, isPingData, isPushFrame, isRequestUri } from './ws-client-support';

export { WsClientError, WsRequestTimeoutError } from './ws-client-errors';

export interface WebSocketLike {
  readonly readyState: number;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  send(data: string): void;
  close(): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;
export type WsClientOptions = {
  readonly webSocketFactory?: WebSocketFactory;
  readonly pingIntervalMs?: number;
  readonly requestTimeoutMs?: number;
  readonly reconnectBaseDelayMs?: number;
  readonly reconnectMaxDelayMs?: number;
};
type PendingRequest = {
  readonly frame: RequestFrame;
  readonly resolve: (response: ResponseEnvelope) => void;
  readonly reject: (error: WsClientError) => void;
  timeoutId: ReturnType<typeof setTimeout> | undefined;
};
type ErrorListener = (error: WsClientError) => void;

const DEFAULTS = { pingIntervalMs: 20_000, requestTimeoutMs: 15_000, reconnectBaseDelayMs: 250, reconnectMaxDelayMs: 8_000 } as const;
const OPEN = 1;

export class WsClient {
  private readonly webSocketFactory: WebSocketFactory;
  private readonly pingIntervalMs: number;
  private readonly requestTimeoutMs: number;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly pendingByKey = new Map<string, PendingRequest[]>();
  private readonly pushListeners = new Set<(push: PushFrame) => void>();
  private readonly envelopeListeners = new Set<(envelope: ResponseEnvelope) => void>();
  private readonly errorListeners = new Set<ErrorListener>();
  private socket: WebSocketLike | undefined;
  private url: string | undefined;
  private pingId: ReturnType<typeof setInterval> | undefined;
  private reconnectId: ReturnType<typeof setTimeout> | undefined;
  private reconnectAttempt = 0;
  private lastUid: Uid | undefined;
  private disposed = false;

  constructor(options: WsClientOptions = {}) {
    this.webSocketFactory = options.webSocketFactory ?? ((url) => new WebSocket(url));
    this.pingIntervalMs = options.pingIntervalMs ?? DEFAULTS.pingIntervalMs;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULTS.requestTimeoutMs;
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? DEFAULTS.reconnectBaseDelayMs;
    this.reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? DEFAULTS.reconnectMaxDelayMs;
  }

  connect(url: string): void {
    this.disposed = false;
    this.url = url;
    this.clearReconnect();
    this.open();
  }

  send(frame: RequestFrameByUri<'ping'>): Promise<{ readonly ping: true }>;
  send(frame: RequestFrame): Promise<ResponseEnvelope>;
  send(frame: RequestFrame): Promise<ResponseEnvelope | { readonly ping: true }> {
    this.lastUid = frame.uid;
    const response = new Promise<ResponseEnvelope>((resolve, reject) => {
      const pending: PendingRequest = {
        frame,
        resolve,
        reject,
        timeoutId: undefined,
      };
      const key = correlationKey(frame.uid, frame.uri);
      const queue = this.pendingByKey.get(key) ?? [];
      queue.push(pending);
      this.pendingByKey.set(key, queue);
      this.dispatchNext(key);
    });
    if (frame.uri === 'ping') {
      return response.then((envelope) => {
        if (isPingData(envelope.data)) {
          return envelope.data;
        }
        throw new WsClientError('Ping response payload is invalid');
      });
    }
    return response;
  }

  onPush(listener: (push: PushFrame) => void): () => void {
    this.pushListeners.add(listener); return () => this.pushListeners.delete(listener);
  }

  onEnvelope(listener: (envelope: ResponseEnvelope) => void): () => void {
    this.envelopeListeners.add(listener); return () => this.envelopeListeners.delete(listener);
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener); return () => this.errorListeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    this.clearReconnect();
    this.stopPing();
    this.socket?.close();
    this.socket = undefined;
    for (const queue of this.pendingByKey.values()) {
      for (const pending of queue) {
        this.clearTimeout(pending);
        pending.reject(new WsRequestTimeoutError(pending.frame.uid, pending.frame.uri, this.requestTimeoutMs));
      }
    }
    this.pendingByKey.clear();
  }

  private open(): void {
    if (this.url === undefined || this.disposed) {
      return;
    }
    const socket = this.webSocketFactory(this.url);
    this.socket = socket;
    socket.addEventListener('open', this.handleOpen);
    socket.addEventListener('message', this.handleMessage);
    socket.addEventListener('close', this.handleClose);
    socket.addEventListener('error', this.handleError);
  }

  private readonly handleOpen: EventListener = () => {
    this.reconnectAttempt = 0;
    this.startPing();
    for (const key of this.pendingByKey.keys()) {
      this.dispatchNext(key);
    }
  };

  private readonly handleMessage: EventListener = (event) => {
    if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
      this.emitError(new WsClientError('WebSocket message payload is not text'));
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(event.data);
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.emitError(new WsClientError(`Malformed WebSocket JSON: ${error.message}`));
        return;
      }
      throw error;
    }
    if (!isEnvelope(payload)) {
      this.emitError(new WsClientError('WebSocket message is not a response envelope'));
      return;
    }
    this.routeEnvelope(payload);
  };

  private readonly handleClose: EventListener = () => {
    this.stopPing();
    this.scheduleReconnect();
  };

  private readonly handleError: EventListener = () => {
    this.emitError(new WsClientError('WebSocket transport error'));
  };

  private routeEnvelope(envelope: ResponseEnvelope): void {
    this.envelopeListeners.forEach((listener) => listener(envelope));
    if (envelope.uid !== undefined && isRequestUri(envelope.uri)) {
      const key = correlationKey(envelope.uid, envelope.uri);
      const queue = this.pendingByKey.get(key);
      const pending = queue?.[0];
      if (queue !== undefined && pending !== undefined) {
        queue.shift();
        this.clearTimeout(pending);
        if (queue.length === 0) {
          this.pendingByKey.delete(key);
        }
        pending.resolve(envelope);
        this.dispatchNext(key);
        return;
      }
    }
    if (isPushFrame(envelope)) {
      this.pushListeners.forEach((listener) => listener(envelope));
      return;
    }
  }

  private dispatchNext(key: string): void {
    const pending = this.pendingByKey.get(key)?.[0];
    if (pending === undefined || pending.timeoutId !== undefined || this.socket?.readyState !== OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(pending.frame));
    pending.timeoutId = setTimeout(() => this.timeoutRequest(key, pending), this.requestTimeoutMs);
  }

  private timeoutRequest(key: string, pending: PendingRequest): void {
    const queue = this.pendingByKey.get(key);
    if (queue?.[0] !== pending) {
      return;
    }
    queue.shift();
    if (queue.length === 0) {
      this.pendingByKey.delete(key);
    }
    pending.reject(new WsRequestTimeoutError(pending.frame.uid, pending.frame.uri, this.requestTimeoutMs));
    this.dispatchNext(key);
  }

  private startPing(): void {
    this.stopPing();
    this.pingId = setInterval(() => {
      const uid = this.lastUid;
      if (uid !== undefined) {
        void this.send({ uid, uri: 'ping', method: null, data: {} }).catch(() => undefined);
      }
    }, this.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingId !== undefined) {
      clearInterval(this.pingId);
      this.pingId = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.url === undefined || this.reconnectId !== undefined) {
      return;
    }
    const delay = Math.min(this.reconnectBaseDelayMs * 2 ** this.reconnectAttempt, this.reconnectMaxDelayMs);
    this.reconnectAttempt += 1;
    this.reconnectId = setTimeout(() => {
      this.reconnectId = undefined;
      this.open();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectId !== undefined) {
      clearTimeout(this.reconnectId);
      this.reconnectId = undefined;
    }
  }

  private clearTimeout(pending: PendingRequest): void {
    if (pending.timeoutId !== undefined) {
      clearTimeout(pending.timeoutId);
      pending.timeoutId = undefined;
    }
  }

  private emitError(error: WsClientError): void {
    this.errorListeners.forEach((listener) => listener(error));
  }
}
