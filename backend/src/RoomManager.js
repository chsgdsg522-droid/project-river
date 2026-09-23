import { randomInt, randomUUID } from 'node:crypto';
import { DEFAULT_RULES, MAX_ROOM_CODE_ATTEMPTS, ROOM_CODE_ALPHABET } from './config.js';
import { Game } from './game/Game.js';

export const DEFAULT_BOTS = Object.freeze([
  { personaId: 'songguo', displayName: '松果', avatarId: 'river-fox' },
  { personaId: 'yanshu', displayName: '岩叔', avatarId: 'river-bear' },
  { personaId: 'xiaoman', displayName: '小满', avatarId: 'river-cat' },
  { personaId: 'ace', displayName: '阿策', avatarId: 'river-owl' },
  { personaId: 'youyou', displayName: '悠悠', avatarId: 'river-rabbit' },
]);

function defaultRoomCode() {
  return Array.from({ length: 6 }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');
}

function roomError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function emptySeat(seat) {
  return { seat, playerId: null, kind: null, personaId: null, displayName: null, avatarId: null, connected: false, joinedAt: null };
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
    room.phase = 'playing';
    room.result = null;
    this.touch(room);
    return room;
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
    room.lastHumanLeftAt = null;
    this.touch(room);
    return true;
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
