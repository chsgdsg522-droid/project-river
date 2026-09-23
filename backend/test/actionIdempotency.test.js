import { describe, expect, it } from 'vitest';
import { RoomManager, chooseTimeoutAction } from '../src/RoomManager.js';

const profile = displayName => ({ displayName, avatarId: 'river-fox' });

function startedHeadsUpRoom() {
  let id = 0;
  const manager = new RoomManager({
    randomCode: () => 'ABC234',
    createPlayerId: () => `player_${++id}`,
    gameRandomInt: () => 0,
  });
  const { room, playerId } = manager.createRoom(profile('房主'));
  for (let seat = 4; seat >= 1; seat -= 1) manager.removeBot(room.code, playerId, seat);
  manager.startRoom(room.code, playerId);
  return { manager, room, playerId };
}

function actionMessage(room, overrides = {}) {
  return {
    type: 'game.action',
    roomCode: room.code,
    handId: room.handId,
    actionId: 'click_0001',
    revision: room.revision,
    action: { type: 'call' },
    ...overrides,
  };
}

describe('idempotent game actions', () => {
  it('applies a duplicated socket action exactly once', () => {
    const { manager, room, playerId } = startedHeadsUpRoom();
    const message = actionMessage(room);

    const first = manager.applyGameAction(playerId, message);
    const second = manager.applyGameAction(playerId, message);

    expect(second).toEqual(first);
    expect(room.game.snapshot().players[playerId].stack).toBe(980);
  });

  it('rejects reuse of an action ID with different contents', () => {
    const { manager, room, playerId } = startedHeadsUpRoom();
    const message = actionMessage(room);
    manager.applyGameAction(playerId, message);

    expect(() => manager.applyGameAction(playerId, { ...message, action: { type: 'fold' } }))
      .toThrow('ACTION_ID_CONFLICT');
  });

  it.each([
    ['stale hand', room => ({ handId: `${room.handId}_old`, actionId: 'click_old1' }), 'STALE_HAND'],
    ['stale revision', room => ({ revision: room.revision - 1, actionId: 'click_old2' }), 'STALE_REVISION'],
  ])('rejects %s without changing chips', (_name, change, errorCode) => {
    const { manager, room, playerId } = startedHeadsUpRoom();
    const before = room.game.snapshot().players[playerId].stack;

    expect(() => manager.applyGameAction(playerId, actionMessage(room, change(room)))).toThrow(errorCode);
    expect(room.game.snapshot().players[playerId].stack).toBe(before);
  });

  it('rejects an action from a player who does not own the turn', () => {
    const { manager, room } = startedHeadsUpRoom();
    const botId = room.seats.find(seat => seat.kind === 'bot').playerId;
    const before = room.game.snapshot().players[botId].stack;

    expect(() => manager.applyGameAction(botId, actionMessage(room, { actionId: 'click_bot1' }))).toThrow('NOT_YOUR_TURN');
    expect(room.game.snapshot().players[botId].stack).toBe(before);
  });

  it('checks on timeout when legal and folds otherwise', () => {
    expect(chooseTimeoutAction({ check: true, fold: false })).toEqual({ type: 'check' });
    expect(chooseTimeoutAction({ check: false, fold: true })).toEqual({ type: 'fold' });
  });
});
