import { afterEach, describe, expect, it, vi } from 'vitest';
import { WsClient, type WebSocketLike } from '../ws-client';
import type { RequestFrameByUri, ResponseEnvelope } from '../types';

type Listener = (event: Event) => void;

class MockWebSocket implements WebSocketLike {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit(new Event('close'));
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit(new Event('open'));
  }

  receive(payload: string): void {
    this.emit(new MessageEvent('message', { data: payload }));
  }

  private emit(event: Event): void {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
  }
}

const configFrame = {
  uid: 'Player-7',
  uri: 'command.config.GetBuildingsConfig',
  method: null,
  data: {},
} as const satisfies RequestFrameByUri<'command.config.GetBuildingsConfig'>;

const pingFrame = {
  uid: 'Player-7',
  uri: 'ping',
  method: null,
  data: {},
} as const satisfies RequestFrameByUri<'ping'>;

function createHarness(): { readonly client: WsClient; readonly sockets: MockWebSocket[] } {
  const sockets: MockWebSocket[] = [];
  const client = new WsClient({
    webSocketFactory: (url) => {
      const socket = new MockWebSocket(url);
      sockets.push(socket);
      return socket;
    },
    pingIntervalMs: 1_000,
    requestTimeoutMs: 500,
    reconnectBaseDelayMs: 100,
    reconnectMaxDelayMs: 1_000,
  });
  return { client, sockets };
}

function latestSocket(sockets: readonly MockWebSocket[]): MockWebSocket {
  const socket = sockets.at(-1);
  if (socket === undefined) {
    throw new Error('测试尚未创建 WebSocket');
  }
  return socket;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('WsClient', () => {
  it('Given welcome 推送 When 收到未关联帧 Then 通过 push 订阅发出', () => {
    const { client, sockets } = createHarness();
    const onPush = vi.fn();
    client.onPush(onPush);
    client.connect('ws://example.test/ws');
    latestSocket(sockets).open();

    latestSocket(sockets).receive(JSON.stringify({ code: 200, uri: 'welcome', msg: 'Welcome' }));

    expect(onPush).toHaveBeenCalledWith({ code: 200, uri: 'welcome', msg: 'Welcome' });
    client.dispose();
  });

  it('Given ping 请求 When 后端响应 ping envelope Then promise 解析 ping data', async () => {
    const { client, sockets } = createHarness();
    client.connect('ws://example.test/ws');
    latestSocket(sockets).open();

    const response = client.send(pingFrame);
    latestSocket(sockets).receive(JSON.stringify({ code: 200, data: { ping: true }, uid: 'Player-7', msg: '', uri: 'ping' }));

    await expect(response).resolves.toEqual({ ping: true });
    client.dispose();
  });

  it('Given 普通命令 When 收到相同 uid 与 uri 的 envelope Then 匹配请求', async () => {
    const { client, sockets } = createHarness();
    client.connect('ws://example.test/ws');
    latestSocket(sockets).open();

    const response = client.send(configFrame);
    const envelope = { code: 200, data: { configs: [] }, uid: 'Player-7', msg: '', uri: configFrame.uri } as const satisfies ResponseEnvelope;
    latestSocket(sockets).receive(JSON.stringify(envelope));

    await expect(response).resolves.toEqual(envelope);
    client.dispose();
  });

  it('Given envelope 订阅 When 收到合法响应后取消订阅 Then 仅首次响应通知 listener', async () => {
    const { client, sockets } = createHarness();
    const onEnvelope = vi.fn();
    const unsubscribe = client.onEnvelope(onEnvelope);
    client.connect('ws://example.test/ws');
    const socket = latestSocket(sockets);
    socket.open();

    const first = client.send(configFrame);
    const firstEnvelope = { code: 200, data: { configs: [{ first: true }] }, uid: 'Player-7', msg: '', uri: configFrame.uri } as const satisfies ResponseEnvelope;
    socket.receive(JSON.stringify(firstEnvelope));
    await expect(first).resolves.toEqual(firstEnvelope);
    expect(onEnvelope).toHaveBeenCalledTimes(1);
    expect(onEnvelope).toHaveBeenLastCalledWith(firstEnvelope);
    unsubscribe();
    const second = client.send(configFrame);
    const secondEnvelope = { code: 200, data: { configs: [{ second: true }] }, uid: 'Player-7', msg: '', uri: configFrame.uri } as const satisfies ResponseEnvelope;
    socket.receive(JSON.stringify(secondEnvelope));
    await expect(second).resolves.toEqual(secondEnvelope);
    expect(onEnvelope).toHaveBeenCalledTimes(1);
    client.dispose();
  });

  it('Given Mayor 请求 When 后端以 Player uid 响应 Then 规范化 uid 后解析', async () => {
    const { client, sockets } = createHarness();
    const mayorFrame = { ...configFrame, uid: 'Mayor-7' } as const satisfies RequestFrameByUri<'command.config.GetBuildingsConfig'>;
    client.connect('ws://example.test/ws');
    latestSocket(sockets).open();

    const response = client.send(mayorFrame);
    latestSocket(sockets).receive(JSON.stringify({ code: 200, data: { configs: [] }, uid: 'Player-7', msg: '', uri: mayorFrame.uri }));

    await expect(response).resolves.toMatchObject({ uid: 'Player-7', uri: mayorFrame.uri });
    client.dispose();
  });

  it('Given 相同 uid 和 uri 的并发请求 When 首个响应到达 Then FIFO 串行发送并按顺序解析', async () => {
    const { client, sockets } = createHarness();
    client.connect('ws://example.test/ws');
    const socket = latestSocket(sockets);
    socket.open();

    const first = client.send(configFrame);
    const second = client.send(configFrame);
    expect(socket.sent).toHaveLength(1);
    socket.receive(JSON.stringify({ code: 200, data: { configs: [{ first: true }] }, uid: 'Player-7', msg: '', uri: configFrame.uri }));
    await expect(first).resolves.toMatchObject({ data: { configs: [{ first: true }] } });
    expect(socket.sent).toHaveLength(2);
    socket.receive(JSON.stringify({ code: 200, data: { configs: [{ second: true }] }, uid: 'Player-7', msg: '', uri: configFrame.uri }));
    await expect(second).resolves.toMatchObject({ data: { configs: [{ second: true }] } });
    client.dispose();
  });

  it('Given Mayor 与 Player 同 URI 并发请求 When 响应以 Player uid 返回 Then 按规范化 UID 共享 FIFO', async () => {
    const { client, sockets } = createHarness();
    const mayorFrame = { ...configFrame, uid: 'Mayor-7' } as const satisfies RequestFrameByUri<'command.config.GetBuildingsConfig'>;
    client.connect('ws://example.test/ws');
    const socket = latestSocket(sockets);
    socket.open();

    const mayorResponse = client.send(mayorFrame);
    const playerResponse = client.send(configFrame);
    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0] ?? '')).toMatchObject({ uid: 'Mayor-7', uri: configFrame.uri });
    socket.receive(JSON.stringify({ code: 200, data: { configs: [{ mayor: true }] }, uid: 'Player-7', msg: '', uri: configFrame.uri }));
    await expect(mayorResponse).resolves.toMatchObject({ data: { configs: [{ mayor: true }] } });
    expect(socket.sent).toHaveLength(2);
    expect(JSON.parse(socket.sent[1] ?? '')).toMatchObject({ uid: 'Player-7', uri: configFrame.uri });
    socket.receive(JSON.stringify({ code: 200, data: { configs: [{ player: true }] }, uid: 'Player-7', msg: '', uri: configFrame.uri }));
    await expect(playerResponse).resolves.toMatchObject({ data: { configs: [{ player: true }] } });
    client.dispose();
  });

  it('Given 意外关闭 When backoff 到期 Then 建立新的连接', () => {
    vi.useFakeTimers();
    const { client, sockets } = createHarness();
    client.connect('ws://example.test/ws');
    latestSocket(sockets).open();

    latestSocket(sockets).close();
    vi.advanceTimersByTime(99);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    client.dispose();
  });

  it('Given 已发送业务帧 When keepalive 到期 Then 自动发送同 uid 的 ping', () => {
    vi.useFakeTimers();
    const { client, sockets } = createHarness();
    client.connect('ws://example.test/ws');
    const socket = latestSocket(sockets);
    socket.open();
    void client.send(configFrame);
    socket.receive(JSON.stringify({ code: 200, data: { configs: [] }, uid: 'Player-7', msg: '', uri: configFrame.uri }));

    vi.advanceTimersByTime(1_000);

    expect(JSON.parse(socket.sent.at(-1) ?? '')).toMatchObject({ uid: 'Player-7', uri: 'ping' });
    client.dispose();
  });

  it('Given 无响应请求 When 到达请求上限 Then 拒绝带上下文的超时错误', async () => {
    vi.useFakeTimers();
    const { client, sockets } = createHarness();
    client.connect('ws://example.test/ws');
    latestSocket(sockets).open();

    const response = client.send(configFrame);
    vi.advanceTimersByTime(500);

    await expect(response).rejects.toMatchObject({ name: 'WsRequestTimeoutError', uid: 'Player-7', uri: configFrame.uri });
    client.dispose();
  });

  it('Given 损坏 JSON When 收到消息 Then 发送错误事件且客户端继续运行', async () => {
    const { client, sockets } = createHarness();
    const onError = vi.fn();
    client.onError(onError);
    client.connect('ws://example.test/ws');
    latestSocket(sockets).open();

    latestSocket(sockets).receive('{not-json');
    const response = client.send(pingFrame);
    latestSocket(sockets).receive(JSON.stringify({ code: 200, data: { ping: true }, uid: 'Player-7', msg: '', uri: 'ping' }));

    expect(onError).toHaveBeenCalledOnce();
    await expect(response).resolves.toEqual({ ping: true });
    client.dispose();
  });
});
