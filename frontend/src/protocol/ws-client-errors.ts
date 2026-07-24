import type { RequestUri, Uid } from './types';

export class WsClientError extends Error {
  override readonly name: string = 'WsClientError';
}

export class WsRequestTimeoutError extends WsClientError {
  override readonly name: string = 'WsRequestTimeoutError';

  constructor(readonly uid: Uid, readonly uri: RequestUri, readonly timeoutMs: number) {
    super(`WebSocket request ${uid} ${uri} timed out after ${timeoutMs}ms`);
  }
}
