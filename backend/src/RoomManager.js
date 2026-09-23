import { randomInt, randomUUID } from 'node:crypto';
import { DEFAULT_RULES, MAX_ROOM_CODE_ATTEMPTS, ROOM_CODE_ALPHABET } from './config.js';
import { Game } from './game/Game.js';
import { PERSONAS } from './bots/personas.js';

export const DEFAULT_BOTS = Object.freeze(Object.entries(PERSONAS).map(([personaId, persona]) => ({
  personaId,
  displayName: persona.displayName,
  avatarId: persona.avatarId,
})));

function defaultRoomCode() {
  return Array.from({ length: 6 }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');
}

function roomError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function emptySeat(seat) {
  return { seat, playerId: null, kind: null, personaId: null, displayName: null, avatarId: null, connected: false, joinedAt: null, disconnectedAt: null, controller: null };
}

export function chooseTimeoutAction(legalActions) {
  if (legalActions?.check) return { type: 'check' };
  if (legalActions?.fold) return { type: 'fold' };
  throw roomError('NO_TIMEOUT_ACTION');
}

export class RoomManager {
  constructor({
    now = Date.now,
    randomCode = defaultRoomCode,
    createPlayerId = () => `player_${randomUUID().replaceAll('-', '')}`,
    gameRandomInt,
    rules = DEFAULT_RULES,
  } = {}) {
    this.now = now;
    this.randomCode = randomCode;
    this.createPlayerId = createPlayerId;
    this.gameRandomInt = gameRandomInt;
    this.rules = rules;
    this.rooms = new Map();
    this.personas = DEFAULT_BOTS;
    this.actionResults = new Map();
    this.timeoutActionCounter = 0;
  }

  generateUniqueCode() {
    for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
      const code = this.randomCode();
      if (/^[A-HJ-NP-Z2-9]{6}$/.test(code) && !this.rooms.has(code)) return code;
    }
    throw roomError('ROOM_CODE_EXHAUSTED');
  }

  createHumanSeat(profile, seat) {
    return {
      seat,
      playerId: this.createPlayerId(),
      kind: 'human',
      personaId: null,
      displayName: profile.displayName,
      avatarId: profile.avatarId,
      connected: true,
      joinedAt: this.now(),
      disconnectedAt: null,
      controller: 'human',
    };
  }

  createBotSeat(persona, seat, roomCode) {
    return {
      seat,
      playerId: `bot_${persona.personaId}_${roomCode}`,
      kind: 'bot',
      personaId: persona.personaId,
      displayName: persona.displayName,
      avatarId: persona.avatarId,
      connected: true,
      joinedAt: this.now(),
      disconnectedAt: null,
      controller: 'bot',
    };
  }

  createRoom(hostProfile) {
    const code = this.generateUniqueCode();
    const host = this.createHumanSeat(hostProfile, 0);
    const seats = [host, ...this.personas.map((persona, index) => this.createBotSeat(persona, index + 1, code))];
    const room = {
      code,
      phase: 'waiting',
      mode: 'friends',
      seats,
      spectators: [],
      hostPlayerId: host.playerId,
      revision: 1,
      createdAt: this.now(),
      updatedAt: this.now(),
      lastHumanLeftAt: null,
      game: null,
      result: null,
      matchNumber: 0,
      handId: null,
    };
    this.rooms.set(code, room);
    return { room, playerId: host.playerId };
  }

  getRoom(code) {
    return this.rooms.get(code) ?? null;
  }

  requireRoom(code) {
    const room = this.getRoom(code);
    if (!room) throw roomError('ROOM_NOT_FOUND');
    return room;
  }

  requireHost(room, actorId) {
    if (room.hostPlayerId !== actorId) throw roomError('HOST_ONLY');
  }

  requireWaiting(room) {
    if (room.phase !== 'waiting') throw roomError('ROOM_NOT_WAITING');
  }

  touch(room) {
    room.revision += 1;
    room.updatedAt = this.now();
  }

  joinRoom(code, profile) {
    const room = this.requireRoom(code);
    const playerId = this.createPlayerId();
    if (room.phase !== 'waiting') return this.queueSpectator(code, profile, playerId);

    const empty = room.seats.find(seat => seat.kind === null);
    const bot = [...room.seats].reverse().find(seat => seat.kind === 'bot');
    const target = empty ?? bot;
    if (!target) return this.queueSpectator(code, profile, playerId);

    const joinedAt = this.now();
    Object.assign(target, {
      playerId,
      kind: 'human',
      personaId: null,
      displayName: profile.displayName,
      avatarId: profile.avatarId,
      connected: true,
      joinedAt,
      disconnectedAt: null,
      controller: 'human',
    });
    room.lastHumanLeftAt = null;
    this.touch(room);
    return { room, playerId, role: 'player', seat: target.seat };
  }

  queueSpectator(code, profile, playerId = this.createPlayerId()) {
    const room = this.requireRoom(code);
    room.spectators.push({
      playerId,
      displayName: profile.displayName,
      avatarId: profile.avatarId,
      connected: true,
      joinedAt: this.now(),
      disconnectedAt: null,
      controller: 'human',
    });
    room.lastHumanLeftAt = null;
    this.touch(room);
    return { room, playerId, role: 'spectator', seat: null };
  }

  startRoom(code, actorId) {
    const room = this.requireRoom(code);
    this.requireHost(room, actorId);
    this.requireWaiting(room);
    const participants = room.seats.filter(seat => seat.kind !== null);
    if (participants.length < 2 || !participants.some(seat => seat.kind === 'human')) {
      throw roomError('NOT_ENOUGH_PLAYERS');
    }

    room.game = new Game({
      players: participants.map(seat => ({
        id: seat.playerId,
        displayName: seat.displayName,
        seat: seat.seat,
        stack: this.rules.startingChips,
      })),
      rules: this.rules,
      randomInt: this.gameRandomInt,
    });
    room.game.startMatch();
    room.matchNumber += 1;
    room.handId = `${room.code}_m${room.matchNumber}_h${room.game.handNumber}`;
    room.phase = 'playing';
    room.result = null;
    this.touch(room);
    return room;
  }

  actionCacheFor(playerId) {
    if (!this.actionResults.has(playerId)) this.actionResults.set(playerId, new Map());
    return this.actionResults.get(playerId);
  }

  rememberAction(playerId, key, value) {
    const cache = this.actionCacheFor(playerId);
    cache.set(key, value);
    while (cache.size > 256) cache.delete(cache.keys().next().value);
  }

  applyGameAction(playerId, message) {
    const room = this.requireRoom(message.roomCode);
    const cacheKey = `${message.handId}:${message.actionId}`;
    const fingerprint = JSON.stringify(message.action);
    const prior = this.actionCacheFor(playerId).get(cacheKey);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw roomError('ACTION_ID_CONFLICT');
      return prior.result;
    }
    if (message.handId !== room.handId) throw roomError('STALE_HAND');
    if (message.revision !== room.revision) throw roomError('STALE_REVISION');
    if (room.phase !== 'playing' || !room.game) throw roomError('GAME_NOT_IN_PROGRESS');
    if (room.game.snapshot().actorId !== playerId) throw roomError('NOT_YOUR_TURN');

    const event = room.game.dispatch(playerId, message.action);
    if (room.game.phase === 'results') {
      room.phase = 'results';
      room.result = room.game.matchStatus.summary;
    }
    this.touch(room);
    const result = { event, revision: room.revision, handId: room.handId };
    this.rememberAction(playerId, cacheKey, { fingerprint, result });
    return result;
  }

  startNextHand(code) {
    const room = this.requireRoom(code);
    if (!room.game || room.phase !== 'playing' || room.game.phase !== 'betweenHands') {
      throw roomError('NEXT_HAND_NOT_AVAILABLE');
    }
    room.game.startNextHand();
    room.handId = `${room.code}_m${room.matchNumber}_h${room.game.handNumber}`;
    this.touch(room);
    return room;
  }

  applyTimeout(code) {
    const room = this.requireRoom(code);
    if (!room.game || room.phase !== 'playing') throw roomError('GAME_NOT_IN_PROGRESS');
    const playerId = room.game.snapshot().actorId;
    const action = chooseTimeoutAction(room.game.legalActionsFor(playerId));
    this.timeoutActionCounter += 1;
    return this.applyGameAction(playerId, {
      type: 'game.action',
      roomCode: code,
      handId: room.handId,
      actionId: `timeout_${this.timeoutActionCounter}`,
      revision: room.revision,
      action,
    });
  }

  kick(code, actorId, targetId) {
    const room = this.requireRoom(code);
    this.requireHost(room, actorId);
    this.requireWaiting(room);
    if (targetId === room.hostPlayerId) throw roomError('CANNOT_KICK_HOST');
    const seat = room.seats.find(value => value.playerId === targetId && value.kind === 'human');
    if (!seat) throw roomError('PLAYER_NOT_FOUND');
    const removed = { playerId: seat.playerId, seat: seat.seat };
    Object.assign(seat, emptySeat(seat.seat));
    this.touch(room);
    return removed;
  }

  addBot(code, actorId, personaId) {
    const room = this.requireRoom(code);
    this.requireHost(room, actorId);
    this.requireWaiting(room);
    const persona = this.personas.find(value => value.personaId === personaId);
    if (!persona) throw roomError('UNKNOWN_BOT_PERSONA');
    if (room.seats.some(seat => seat.personaId === personaId)) throw roomError('BOT_ALREADY_SEATED');
    const target = room.seats.find(seat => seat.kind === null);
    if (!target) throw roomError('ROOM_FULL');
    Object.assign(target, this.createBotSeat(persona, target.seat, room.code));
    this.touch(room);
    return target;
  }

  removeBot(code, actorId, seatNumber) {
    const room = this.requireRoom(code);
    this.requireHost(room, actorId);
    this.requireWaiting(room);
    const seat = room.seats[seatNumber];
    if (!seat || seat.kind !== 'bot') throw roomError('BOT_NOT_FOUND');
    const removed = { ...seat };
    Object.assign(seat, emptySeat(seatNumber));
    this.touch(room);
    return removed;
  }

  rematch(code, actorId) {
    const room = this.requireRoom(code);
    this.requireHost(room, actorId);
    if (room.phase !== 'results') throw roomError('REMATCH_NOT_AVAILABLE');

    while (room.spectators.length > 0) {
      const target = room.seats.find(seat => seat.kind === null)
        ?? [...room.seats].reverse().find(seat => seat.kind === 'bot');
      if (!target) break;
      const spectator = room.spectators.shift();
      Object.assign(target, { ...spectator, seat: target.seat, kind: 'human', personaId: null });
    }
    room.game = null;
    room.phase = 'waiting';
    room.result = null;
    this.touch(room);
    return room;
  }

  markDisconnected(code, playerId, at = this.now()) {
    const room = this.requireRoom(code);
    const participant = room.seats.find(seat => seat.playerId === playerId)
      ?? room.spectators.find(value => value.playerId === playerId);
    if (!participant || participant.kind === 'bot') return false;
    participant.connected = false;
    participant.disconnectedAt = at;
    const hasConnectedHuman = room.seats.some(seat => seat.kind === 'human' && seat.connected)
      || room.spectators.some(value => value.connected);
    if (!hasConnectedHuman && room.lastHumanLeftAt === null) room.lastHumanLeftAt = at;
    this.touch(room);
    return true;
  }

  markConnected(code, playerId) {
    const room = this.requireRoom(code);
    const participant = room.seats.find(seat => seat.playerId === playerId)
      ?? room.spectators.find(value => value.playerId === playerId);
    if (!participant || participant.kind === 'bot') return false;
    participant.connected = true;
    participant.disconnectedAt = null;
    room.lastHumanLeftAt = null;
    this.touch(room);
    return true;
  }

  processDisconnectTimeouts(at = this.now()) {
    const takeovers = [];
    for (const room of this.rooms.values()) {
      for (const seat of room.seats) {
        if (seat.kind !== 'human'
          || seat.connected
          || seat.controller === 'bot'
          || seat.disconnectedAt === null
          || at - seat.disconnectedAt < this.rules.reconnectMs) continue;
        seat.controller = 'bot';
        takeovers.push({ roomCode: room.code, playerId: seat.playerId });
        if (room.hostPlayerId === seat.playerId) room.hostPlayerId = this.selectNextHost(room);
        this.touch(room);
      }
    }
    return takeovers;
  }

  restoreHumanControl(code, playerId) {
    const room = this.requireRoom(code);
    const seat = room.seats.find(value => value.playerId === playerId && value.kind === 'human');
    if (!seat) throw roomError('PLAYER_NOT_FOUND');
    seat.controller = 'human';
    seat.connected = true;
    seat.disconnectedAt = null;
    this.touch(room);
    return seat;
  }

  selectNextHost(room) {
    return room.seats
      .filter(seat => seat.kind === 'human' && seat.connected)
      .sort((left, right) => left.joinedAt - right.joinedAt || left.seat - right.seat)[0]?.playerId ?? null;
  }

  expireIdleRooms(at = this.now()) {
    const expired = [];
    for (const [code, room] of this.rooms) {
      if (room.lastHumanLeftAt !== null && at - room.lastHumanLeftAt >= this.rules.roomIdleMs) {
        this.rooms.delete(code);
        expired.push(code);
      }
    }
    return expired;
  }
}
