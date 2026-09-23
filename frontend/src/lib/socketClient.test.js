import { describe, expect, it, vi } from 'vitest';
import { SocketClient } from './socketClient.js';

class MockWebSocket {
  static latest = null;

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = new Map();
    this.sent = [];
    MockWebSocket.latest = this;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  open() {
    this.readyState = 1;
    this.dispatch('open');
  }

  send(value) {
    this.sent.push(JSON.parse(value));
  }

  close() {
    this.readyState = 3;
    this.dispatch('close');
  }
}

describe('SocketClient', () => {
  it('calls browser timers with their global receiver when scheduling and cancelling reconnect', async () => {
    let scheduledWith;
    let cancelledWith;
    vi.stubGlobal('setTimeout', function () { scheduledWith = this; return 42; });
    vi.stubGlobal('clearTimeout', function () { cancelledWith = this; });
    try {
      const client = new SocketClient({ url: 'ws://river.test', WebSocketImpl: MockWebSocket });
      const connecting = client.resume('resume_token_that_is_long_enough');
      MockWebSocket.latest.open();
      await connecting;
      MockWebSocket.latest.close();
      expect(scheduledWith).toBe(globalThis);
      client.close();
      expect(cancelledWith).toBe(globalThis);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('resumes once after opening and keeps the token in memory', async () => {
    const client = new SocketClient({ url: 'ws://river.test', WebSocketImpl: MockWebSocket });
    const pending = client.resume('resume_token_that_is_long_enough');
    MockWebSocket.latest.open();
    await pending;

    expect(MockWebSocket.latest.sent).toEqual([
      { type: 'session.resume', token: 'resume_token_that_is_long_enough' },
    ]);
    expect(client.token).toBe('resume_token_that_is_long_enough');
  });

  it('creates monotonically unique action identifiers', () => {
    const client = new SocketClient({ url: 'ws://river.test', WebSocketImpl: MockWebSocket });
    const first = client.nextActionId();
    const second = client.nextActionId();

    expect(first).not.toBe(second);
    expect(first < second).toBe(true);
  });

  it('does not reconnect and steal control back after the server replaces its session', async () => {
    const client = new SocketClient({ url: 'ws://river.test', WebSocketImpl: MockWebSocket });
    const events = [];
    client.subscribe(message => events.push(message));
    const pending = client.resume('replaced_token_that_is_long_enough');
    MockWebSocket.latest.open();
    await pending;
    MockWebSocket.latest.readyState = 3;
    MockWebSocket.latest.dispatch('close', { code: 4001 });
    expect(client.reconnectAttempt).toBe(0);
    expect(client.token).toBeNull();
    expect(events).toContainEqual({ type: 'client.error', payload: { code: 'SESSION_REPLACED' } });
    client.close();
  });

  it('forgets the abandoned identity and ignores late events from the old connection', async () => {
    const client = new SocketClient({ url: 'ws://river.test', WebSocketImpl: MockWebSocket });
    const first = client.resume('old_token_that_is_long_enough');
    const oldSocket = MockWebSocket.latest;
    oldSocket.open();
    await first;
    oldSocket.dispatch('message', { data: JSON.stringify({ type: 'session.ready', payload: { token: 'old_token_that_is_long_enough', playerId: 'old-player' } }) });
    client.close();
    const second = client.connect();
    const newSocket = MockWebSocket.latest;
    newSocket.open();
    await second;
    oldSocket.dispatch('close');
    oldSocket.dispatch('message', { data: JSON.stringify({ type: 'session.ready', payload: { token: 'old_token_that_is_long_enough', playerId: 'old-player' } }) });

    expect(client.socket).toBe(newSocket);
    expect(newSocket.sent).toEqual([]);
    expect(client.token).toBeNull();
    expect(client.playerId).toBeNull();
    client.close();
  });
});
