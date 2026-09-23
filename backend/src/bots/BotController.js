import { randomInt } from 'node:crypto';
import { projectRoom } from '../RoomView.js';
import { decideBotAction } from './BotPolicy.js';

function secureUnitRandom() {
  return randomInt(1_000_000) / 1_000_000;
}

export class BotController {
  constructor({
    roomManager,
    random = secureUnitRandom,
    setTimeout: schedule = setTimeout,
    clearTimeout: cancel = clearTimeout,
  }) {
    this.roomManager = roomManager;
    this.random = random;
    this.schedule = schedule;
    this.cancelTimer = cancel;
    this.entries = new Map();
    this.actionCounter = 0;
  }

  cancel(roomCode) {
    const entry = this.entries.get(roomCode);
    if (!entry) return false;
    this.cancelTimer(entry.timeoutId);
    this.entries.delete(roomCode);
    return true;
  }

  maybeAct(room) {
    this.cancel(room.code);
    if (room.phase !== 'playing' || !room.game || room.game.phase !== 'playing') return false;
    const actorId = room.game.snapshot().actorId;
    const seat = room.seats.find(value => value.playerId === actorId);
    if (!seat || (seat.kind !== 'bot' && seat.controller !== 'bot')) return false;

    const handId = room.handId;
    const visibleState = projectRoom(room, { playerId: actorId, role: 'player' }).game;
    const action = decideBotAction({
      personaId: seat.personaId ?? 'ace',
      visibleState,
      legalActions: room.game.legalActionsFor(actorId),
      random: this.random,
    });
    const generation = Symbol(room.code);
    const delay = 450 + Math.floor(this.random() * 751);
    const timeoutId = this.schedule(() => {
      const current = this.entries.get(room.code);
      if (current?.generation !== generation
        || room.handId !== handId
        || room.game?.snapshot().actorId !== actorId) return;
      this.entries.delete(room.code);
      this.actionCounter += 1;
      try {
        this.roomManager.applyGameAction(actorId, {
          type: 'game.action',
          roomCode: room.code,
          handId,
          actionId: `bot_${this.actionCounter}_${actorId}`.slice(0, 64),
          revision: room.revision,
          action,
        });
        this.maybeAct(room);
      } catch (error) {
        if (!['STALE_HAND', 'STALE_REVISION', 'NOT_YOUR_TURN'].includes(error.code)) throw error;
      }
    }, delay);
    this.entries.set(room.code, { generation, timeoutId, handId, actorId });
    return true;
  }

  close() {
    for (const roomCode of this.entries.keys()) this.cancel(roomCode);
  }
}
