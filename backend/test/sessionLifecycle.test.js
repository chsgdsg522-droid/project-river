import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/createServer.js';

// Only transport and time are substituted; messages exercise the real server,
// registry, rooms, game, projections, and automation together.
class Connection extends EventEmitter {
  readyState = 1;
  messages = [];
  send(raw) { this.messages.push(JSON.parse(raw)); }
  request(message) { this.emit('message', JSON.stringify(message)); }
  close() { this.readyState = 2; }
  finishClose() { this.readyState = 3; this.emit('close'); }
  last(type) { return this.messages.filter(message => message.type === type).at(-1); }
}

const profile = displayName => ({ displayName, avatarId: 'river-fox' });
const running = [];
afterEach(async () => { await Promise.all(running.splice(0).map(server => server.stop())); });

function setup() {
  let now = 1_000;
  let id = 0;
  let timerId = 0;
  const timers = new Map();
  const server = createServer({
    now: () => now, randomCode: () => 'ABC234', createPlayerId: () => `human_${++id}`,
    randomInt: () => 0, botRandom: () => 0,
    setTimeout(callback, delay) { timers.set(++timerId, { callback, due: now + delay }); return timerId; },
    clearTimeout(timer) { timers.delete(timer); },
  });
  running.push(server);
  const connect = () => { const socket = new Connection(); server.wsServer.emit('connection', socket); return socket; };
  const host = connect();
  host.request({ type: 'room.create', profile: profile('房主') });
  const room = server.services.rooms.getRoom('ABC234');
  const session = host.last('session.ready').payload;
  function elapse(ms) {
    const target = now + ms;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.due <= target).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      now = next[1].due;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = target;
  }
  function takeover(socket) {
    socket.finishClose();
    now += 30_000;
    server.services.runMaintenance(now);
  }
  function twoPlayers() {
    for (const seat of [1, 2, 3, 4, 5]) host.request({ type: 'room.bot.remove', roomCode: room.code, seat });
    const guest = connect();
    guest.request({ type: 'room.join', roomCode: room.code, profile: profile('朋友') });
    host.request({ type: 'room.start', roomCode: room.code });
    return guest;
  }
  function act(socket, action = { type: 'fold' }) {
    socket.request({ type: 'game.action', roomCode: room.code, handId: room.handId,
      revision: room.revision, actionId: `action_${++id}_test`, action });
  }
  return { server, host, room, session, connect, elapse, takeover, twoPlayers, act };
}

describe('server session lifecycle', () => {
  it('returns a fresh recipient-safe snapshot before rejecting a stale action without restarting the clock', () => {
    const game = setup();
    const guest = game.twoPlayers();
    const deadline = game.room.actionDeadline;
    game.elapse(1_000);
    const start = game.host.messages.length;
    game.host.request({ type: 'game.action', roomCode: game.room.code, handId: game.room.handId,
      revision: game.room.revision - 1, actionId: 'action_stale_001', action: { type: 'call' } });
    const reply = game.host.messages.slice(start);
    expect(reply.map(message => message.type)).toEqual(['room.state', 'game.error']);
    expect(reply[0].revision).toBe(game.room.revision);
    const guestId = guest.last('session.ready').payload.playerId;
    expect(reply[0].payload.game.players[game.session.playerId].holeCards).toHaveLength(2);
    expect(reply[0].payload.game.players[guestId]).not.toHaveProperty('holeCards');
    expect(reply[1].payload.code).toBe('STALE_REVISION');
    expect(game.room.actionDeadline).toBe(deadline);
  });

  it('does not let a bound connection switch to another player token', () => {
    const game = setup();
    const guest = game.twoPlayers();
    const guestToken = guest.last('session.ready').payload.token;
    game.host.request({ type: 'session.resume', token: guestToken });
    expect(game.host.last('game.error')?.payload.code).toBe('SESSION_ALREADY_BOUND');
    expect(guest.readyState).toBe(1);
    game.act(game.host);
    expect(game.room.game.phase).toBe('betweenHands');
  });

  it('does not restart the opponent clock when retrying an accepted action', () => {
    const game = setup();
    game.twoPlayers();
    const message = { type: 'game.action', roomCode: game.room.code, handId: game.room.handId,
      revision: game.room.revision, actionId: 'action_retry_001', action: { type: 'call' } };
    game.host.request(message);
    const deadline = game.room.actionDeadline;
    game.elapse(1_000);
    game.host.request(message);
    expect(game.room.actionDeadline).toBe(deadline);
  });

  it('ignores late close and action messages from a replaced socket', () => {
    const game = setup();
    const replacement = game.connect();
    replacement.request({ type: 'session.resume', token: game.session.token });
    game.host.finishClose();
    expect(game.room.seats[0].connected).toBe(true);
    game.host.request({ type: 'room.start', roomCode: game.room.code });
    expect(game.room.phase).toBe('waiting');
    replacement.request({ type: 'room.start', roomCode: game.room.code });
    expect(game.room.phase).toBe('playing');
  });

  it('resumes a spectator without trying to restore a seat', () => {
    const game = setup();
    game.twoPlayers();
    const spectator = game.connect();
    spectator.request({ type: 'room.join', roomCode: game.room.code, profile: profile('观众') });
    const token = spectator.last('session.ready').payload.token;
    spectator.finishClose();
    const resumed = game.connect();
    resumed.request({ type: 'session.resume', token });
    expect(resumed.last('game.error')).toBeUndefined();
    expect(resumed.last('session.ready')?.payload.role).toBe('spectator');
    expect(resumed.last('room.state')?.payload.game.legalActions).toBeNull();
  });

  it('gives promoted spectators player controls in the next match', () => {
    const game = setup();
    const guest = game.twoPlayers();
    const spectator = game.connect();
    spectator.request({ type: 'room.join', roomCode: game.room.code, profile: profile('下一局') });
    const spectatorId = spectator.last('session.ready').payload.playerId;
    for (let hand = 0; hand < 10; hand += 1) {
      game.act(game.room.game.actorId === game.session.playerId ? game.host : guest);
      game.elapse(1_000);
    }
    expect(game.room.phase).toBe('results');
    game.host.request({ type: 'match.rematch', roomCode: game.room.code });
    game.host.request({ type: 'room.start', roomCode: game.room.code });
    const state = spectator.last('room.state').payload;
    expect(state.self).toEqual({ playerId: spectatorId, role: 'player' });
    expect(state.game.players[spectatorId].holeCards).toHaveLength(2);
    expect(state.game.legalActions).not.toBeNull();
  });

  it('restores a hostless room when its only human returns', () => {
    const game = setup();
    game.takeover(game.host);
    expect(game.room.hostPlayerId).toBeNull();
    const resumed = game.connect();
    resumed.request({ type: 'session.resume', token: game.session.token });
    resumed.request({ type: 'room.start', roomCode: game.room.code });
    expect(resumed.last('game.error')).toBeUndefined();
    expect(game.room.hostPlayerId).toBe(game.session.playerId);
    expect(game.room.phase).toBe('playing');
  });

  it('cancels a pending bot action when control returns during the same hand', () => {
    const game = setup();
    game.twoPlayers();
    game.takeover(game.host);
    const before = game.room.game.players[game.session.playerId].stack;
    const resumed = game.connect();
    resumed.request({ type: 'session.resume', token: game.session.token });
    expect(resumed.last('session.ready').payload.resumeAt).toBe('now');
    game.elapse(1_000);
    expect(game.room.game.players[game.session.playerId].stack).toBe(before);
    expect(game.room.game.actorId).toBe(game.session.playerId);
    expect(game.room.actionDeadline).toEqual(expect.any(Number));
  });

  it('defers a later-hand return, blocks actions, then restores at the next boundary', () => {
    const game = setup();
    const guest = game.twoPlayers();
    game.act(game.host);
    game.takeover(game.host);
    game.elapse(1_000);
    expect(game.room.game.handNumber).toBe(2);
    const resumed = game.connect();
    resumed.request({ type: 'session.resume', token: game.session.token });
    expect(resumed.last('session.ready').payload.resumeAt).toBe('nextHand');
    expect(resumed.last('room.state').payload.game.legalActions).toBeNull();
    resumed.request({ type: 'room.start', roomCode: game.room.code });
    expect(resumed.last('game.error')?.payload.code).toBe('HOST_ONLY');
    expect(game.room.seats[0].controller).toBe('bot');
    expect(game.server.services.sessions.activeController(game.session.playerId)).toBe('bot');
    game.act(resumed);
    expect(resumed.last('game.error')?.payload.code).toBe('HUMAN_CONTROL_PENDING');
    game.act(guest);
    game.elapse(1_000);
    expect(game.room.game.handNumber).toBe(3);
    expect(game.room.seats[0].controller).toBe('human');
    expect(game.server.services.sessions.activeController(game.session.playerId)).toBe('human');
    game.act(resumed);
    expect(game.room.game.phase).toBe('betweenHands');
  });
});
