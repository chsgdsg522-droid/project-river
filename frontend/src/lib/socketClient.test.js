import { describe, expect, it } from 'vitest';
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
});
