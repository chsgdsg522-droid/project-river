const ROOM_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

export function parseRoomCode(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim().toUpperCase().replace(/\/+$/, '');
  const match = value.match(/(?:^|\/ROOM\/)([A-HJ-NP-Z2-9]{6})$/);
  const code = match?.[1] ?? (ROOM_CODE.test(value) ? value : null);
  return code && ROOM_CODE.test(code) ? code : null;
}

function defaultUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const isVite = window.location.port === '5173';
  const authority = isVite ? `${window.location.hostname}:8080` : window.location.host;
  return `${protocol}//${authority}`;
}

export class SocketClient {
  constructor({
    url = defaultUrl(),
    WebSocketImpl = globalThis.WebSocket,
    setTimeout: schedule = globalThis.setTimeout.bind(globalThis),
    clearTimeout: cancel = globalThis.clearTimeout.bind(globalThis),
  } = {}) {
    this.url = url;
    this.WebSocketImpl = WebSocketImpl;
    this.schedule = schedule;
    this.cancel = cancel;
    this.socket = null;
    this.connectPromise = null;
    this.listeners = new Set();
    this.token = null;
    this.playerId = null;
    this.sequence = 0;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.closedByUser = false;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(message) {
    for (const listener of this.listeners) listener(message);
  }

  connect() {
    if (this.socket?.readyState === 1) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    if (!this.WebSocketImpl) return Promise.reject(new Error('WEBSOCKET_UNAVAILABLE'));
    this.closedByUser = false;
    this.emit({ type: 'client.status', payload: { status: this.reconnectAttempt ? 'reconnecting' : 'connecting' } });
    this.connectPromise = new Promise((resolve, reject) => {
      const socket = new this.WebSocketImpl(this.url);
      let opened = false;
      this.socket = socket;
      socket.addEventListener('open', () => {
        if (this.socket !== socket) return;
        opened = true;
        this.connectPromise = null;
        this.reconnectAttempt = 0;
        this.emit({ type: 'client.status', payload: { status: 'connected' } });
        if (this.token) this.request({ type: 'session.resume', token: this.token });
        resolve();
      }, { once: true });
      socket.addEventListener('message', event => {
        if (this.socket !== socket) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'session.ready') {
            this.token = message.payload.token;
            this.playerId = message.payload.playerId;
          }
          this.emit(message);
        } catch {
          this.emit({ type: 'client.error', payload: { code: 'INVALID_SERVER_MESSAGE' } });
        }
      });
      socket.addEventListener('error', () => {
        if (this.socket !== socket) return;
        this.emit({ type: 'client.error', payload: { code: 'CONNECTION_FAILED' } });
      });
      socket.addEventListener('close', event => {
        if (!opened) reject(new Error('CONNECTION_CLOSED'));
        if (this.socket !== socket) return;
        this.connectPromise = null;
        this.socket = null;
        if (event.code === 4001) {
          this.close();
          this.emit({ type: 'client.error', payload: { code: 'SESSION_REPLACED' } });
          return;
        }
        if (!this.closedByUser) this.queueReconnect();
      });
    });
    return this.connectPromise;
  }

  queueReconnect() {
    if (this.reconnectTimer !== null) return;
    this.reconnectAttempt += 1;
    this.emit({ type: 'client.status', payload: { status: 'reconnecting' } });
    const delay = Math.min(5_000, 500 * (2 ** (this.reconnectAttempt - 1)));
    this.reconnectTimer = this.schedule(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, delay);
  }

  request(message) {
    if (this.socket?.readyState !== 1) throw new Error('SOCKET_NOT_CONNECTED');
    this.socket.send(JSON.stringify(message));
  }

  async resume(token) {
    this.token = token;
    if (this.socket?.readyState === 1) {
      this.request({ type: 'session.resume', token });
      return;
    }
    await this.connect();
  }

  nextActionId() {
    this.sequence += 1;
    return `action_${Date.now().toString(36)}_${this.sequence.toString(36).padStart(4, '0')}`;
  }

  close() {
    this.closedByUser = true;
    if (this.reconnectTimer !== null) this.cancel(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    this.connectPromise = null;
    this.token = null;
    this.playerId = null;
    this.reconnectAttempt = 0;
    socket?.close();
    this.emit({ type: 'client.status', payload: { status: 'closed' } });
  }
}

export const socketClient = new SocketClient();
