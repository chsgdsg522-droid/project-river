import WebSocket from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/createServer.js';

class TestClient {
  constructor(socket) {
    this.socket = socket;
    this.messages = [];
    this.waiters = [];
    socket.on('message', raw => {
      const message = JSON.parse(raw.toString());
      this.messages.push(message);
      const pending = this.waiters.splice(0);
      for (const waiter of pending) {
        if (waiter.predicate(message)) waiter.resolve(message);
        else this.waiters.push(waiter);
      }
    });
  }

  waitFor(type, extra = () => true) {
    const existing = [...this.messages].reverse().find(message => message.type === type && extra(message));
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 2_000);
      this.waiters.push({
        predicate: message => message.type === type && extra(message),
        resolve: message => {
          clearTimeout(timeout);
          resolve(message);
        },
      });
    });
  }

  async sendAndWait(message, type, extra) {
    const previousCount = this.messages.length;
    this.socket.send(JSON.stringify(message));
    return this.waitFor(type, value => this.messages.indexOf(value) >= previousCount && (extra?.(value) ?? true));
  }

  close() {
    if (this.socket.readyState === WebSocket.CLOSED) return Promise.resolve();
    return new Promise(resolve => {
      this.socket.once('close', resolve);
      this.socket.close();
    });
  }
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return new TestClient(socket);
}

const profile = displayName => ({ displayName, avatarId: 'river-fox' });

describe('Project River server', () => {
  const running = [];
  afterEach(async () => {
    await Promise.all(running.splice(0).map(server => server.stop()));
  });

  it('creates, joins, starts, acts, and broadcasts recipient-safe views', async () => {
    let id = 0;
    const server = createServer({
      port: 0,
      randomCode: () => 'ABC234',
      createPlayerId: () => `player_${++id}`,
      randomInt: () => 0,
    });
    running.push(server);
    const address = await server.start();
    const host = await connect(address.wsUrl);
    const guest = await connect(address.wsUrl);

    const created = await host.sendAndWait({ type: 'room.create', profile: profile('房主') }, 'room.state');
    const hostSession = await host.waitFor('session.ready');
    const code = created.payload.code;
    const joined = await guest.sendAndWait({ type: 'room.join', roomCode: code, profile: profile('朋友') }, 'room.state');
    const guestSession = await guest.waitFor('session.ready');
    expect(hostSession.payload.token).toMatch(/^[a-zA-Z0-9_-]{22,}$/);
    expect(guestSession.payload.playerId).not.toBe(hostSession.payload.playerId);
    expect(joined.payload.seats.filter(seat => seat.kind === 'human')).toHaveLength(2);

    let hostState = await host.waitFor('room.state', value => value.revision >= joined.revision);
    for (const seat of [1, 2, 3, 4]) {
      hostState = await host.sendAndWait({ type: 'room.bot.remove', roomCode: code, seat }, 'room.state', value => value.revision > hostState.revision);
    }
    const started = await host.sendAndWait({ type: 'room.start', roomCode: code }, 'room.state', value => value.payload.phase === 'playing');
    const guestStarted = await guest.waitFor('room.state', value => value.revision === started.revision);
    expect(started.payload.actionDeadline).toEqual(expect.any(Number));
    const hostCards = started.payload.game.players[hostSession.payload.playerId].holeCards;
    expect(hostCards).toHaveLength(2);
    expect(guestStarted.payload.game.players[hostSession.payload.playerId].holeCards).toBeUndefined();
    expect(JSON.stringify(guestStarted)).not.toContain(hostCards[0]);
    expect(JSON.stringify(guestStarted)).not.toContain(hostCards[1]);

    const acted = await host.sendAndWait({
      type: 'game.action', roomCode: code, handId: started.payload.handId,
      actionId: 'click_0001', revision: started.revision, action: { type: 'call' },
    }, 'room.state', value => value.revision > started.revision);
    expect(acted.payload.game.actorId).toBe(guestSession.payload.playerId);
    expect(acted.payload.actionDeadline).toEqual(expect.any(Number));

    await host.close();
    await guest.close();
  });

  it('serves health and accepts only allowlisted anonymous telemetry', async () => {
    const received = [];
    const server = createServer({ port: 0, telemetrySink: event => received.push(event) });
    running.push(server);
    const address = await server.start();

    expect(await (await fetch(`${address.url}/health`)).json()).toEqual({ ok: true });
    const accepted = await fetch(`${address.url}/telemetry`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'performance', name: 'LCP', durationMs: 123, route: '/game', browserFamily: 'Chrome' }),
    });
    expect(accepted.status).toBe(204);
    expect(received).toEqual([{ kind: 'performance', name: 'LCP', durationMs: 123, route: '/game', browserFamily: 'Chrome' }]);

    const rejected = await fetch(`${address.url}/telemetry`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'error', name: 'boom', nickname: '秘密玩家' }),
    });
    expect(rejected.status).toBe(400);
  });

  it('broadcasts a bot action without polling shared game state', async () => {
    let id = 0;
    const server = createServer({
      port: 0,
      randomCode: () => 'ABC234',
      createPlayerId: () => `botroom_${++id}`,
      randomInt: () => 0,
      botRandom: () => 0,
    });
    running.push(server);
    const address = await server.start();
    const host = await connect(address.wsUrl);
    const waiting = await host.sendAndWait({ type: 'room.create', profile: profile('房主') }, 'room.state');
    const started = await host.sendAndWait({ type: 'room.start', roomCode: waiting.payload.code }, 'room.state', value => value.payload.phase === 'playing');

    const botActed = await host.waitFor('room.state', value => value.revision > started.revision);
    expect(botActed.payload.game.players[botActed.payload.game.actorId]).toBeDefined();
    await host.close();
  });

  it('handles ten six-seat rooms and releases rooms and sockets on shutdown', async () => {
    let now = 10_000;
    let id = 0;
    let codeIndex = 0;
    const codes = ['ABC234', 'DEF567', 'GHJ789', 'KLM234', 'NPQ567', 'RST789', 'UVW234', 'XYZ567', 'BDF789', 'HJK234'];
    const server = createServer({
      port: 0,
      now: () => now,
      randomCode: () => codes[codeIndex++],
      createPlayerId: () => `load_${++id}`,
      randomInt: () => 0,
    });
    running.push(server);
    await server.start();

    for (let roomIndex = 0; roomIndex < 10; roomIndex += 1) {
      const { room, playerId } = server.services.rooms.createRoom(profile(`房主${roomIndex}`));
      for (let guest = 1; guest < 6; guest += 1) server.services.rooms.joinRoom(room.code, profile(`玩家${roomIndex}-${guest}`));
      server.services.rooms.startRoom(room.code, playerId);
      expect(room.game.snapshot().players).toBeDefined();
      for (const seat of room.seats.filter(value => value.kind === 'human')) {
        server.services.rooms.markDisconnected(room.code, seat.playerId, now);
      }
    }
    expect(server.services.rooms.rooms.size).toBe(10);
    now += 30 * 60_000;
    server.services.runMaintenance(now);
    expect(server.services.rooms.rooms.size).toBe(0);

    await server.stop();
    running.pop();
    expect(server.wsServer.clients.size).toBe(0);
  });
});
