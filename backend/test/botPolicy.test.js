import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotController } from '../src/bots/BotController.js';
import { decideBotAction } from '../src/bots/BotPolicy.js';
import { PERSONAS } from '../src/bots/personas.js';
import { RoomManager } from '../src/RoomManager.js';
import { projectRoom } from '../src/RoomView.js';

function lcg(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value / 2 ** 32;
  };
}

function visibleDecision(seed) {
  const cardPairs = [['2c', '7d'], ['9c', 'Td'], ['As', 'Ad']];
  const pair = cardPairs[seed % cardPairs.length];
  return {
    visibleState: {
      actorId: 'bot-a',
      pot: 120,
      board: [],
      order: ['bot-a', 'b', 'c'],
      buttonId: seed % 2 ? 'bot-a' : 'c',
      players: {
        'bot-a': { id: 'bot-a', stack: 900, holeCards: pair, folded: false, allIn: false },
        b: { id: 'b', stack: 900, folded: false, allIn: false },
        c: { id: 'c', stack: 900, folded: false, allIn: false },
      },
    },
    legalActions: {
      fold: true,
      check: false,
      callAmount: 20 + (seed % 4) * 20,
      bet: null,
      raise: { minTo: 160, maxTo: 900, reopened: true },
      allInTo: 900,
    },
    random: lcg(seed),
  };
}

function actionIsLegal(action, legal) {
  if (action.type === 'fold') return legal.fold;
  if (action.type === 'check') return legal.check;
  if (action.type === 'call') return legal.callAmount !== null;
  if (action.type === 'allIn') return legal.allInTo > 0;
  const limits = action.type === 'bet' ? legal.bet : legal.raise;
  return Boolean(limits && Number.isSafeInteger(action.raiseTo) && action.raiseTo >= limits.minTo && action.raiseTo <= limits.maxTo);
}

describe('bot policy', () => {
  it('defines the five approved stable personas', () => {
    expect(Object.keys(PERSONAS)).toEqual(['songguo', 'yanshu', 'xiaoman', 'ace', 'youyou']);
    expect(Object.values(PERSONAS).map(persona => persona.displayName)).toEqual(['松果', '岩叔', '小满', '阿策', '悠悠']);
  });

  it.each(['songguo', 'yanshu', 'xiaoman', 'ace', 'youyou'])('%s always returns a legal action', personaId => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const input = visibleDecision(seed);
      expect(actionIsLegal(decideBotAction({ personaId, ...input }), input.legalActions)).toBe(true);
    }
  });

  it('receives its own cards without receiving opponent hole cards', () => {
    let id = 0;
    const manager = new RoomManager({
      randomCode: () => 'ABC234',
      createPlayerId: () => `player_${++id}`,
      gameRandomInt: () => 0,
    });
    const { room, playerId } = manager.createRoom({ displayName: '房主', avatarId: 'river-dog' });
    manager.startRoom(room.code, playerId);
    const actorId = room.game.snapshot().actorId;
    const visible = projectRoom(room, { playerId: actorId, role: 'player' }).game;

    expect(visible.players[actorId].holeCards).toHaveLength(2);
    expect(Object.values(visible.players).filter(player => player.id !== actorId).every(player => !('holeCards' in player))).toBe(true);
  });

  describe('BotController scheduling', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('cancels the old decision when the room actor changes', () => {
      const applyGameAction = vi.fn();
      const controller = new BotController({
        roomManager: { applyGameAction },
        random: () => 0,
      });
      const room = {
        code: 'ABC234', revision: 1, handId: 'hand_1', phase: 'playing',
        seats: [{ seat: 0, playerId: 'bot-a', kind: 'bot', personaId: 'ace', controller: 'bot' }],
        spectators: [], hostPlayerId: null, mode: 'friends',
        game: {
          snapshot: () => ({ ...visibleDecision(1).visibleState, phase: 'playing', handNumber: 1, street: 'preflop', board: [], smallBlindId: 'b', bigBlindId: 'c', smallBlind: 10, bigBlind: 20, currentBet: 20, lastFullRaise: 20, matchStatus: null, lastHandResult: null }),
          legalActionsFor: () => visibleDecision(1).legalActions,
        },
      };
      controller.maybeAct(room);
      room.game.snapshot = () => ({ ...visibleDecision(1).visibleState, actorId: 'human' });
      controller.maybeAct(room);

      vi.advanceTimersByTime(1_200);
      expect(applyGameAction).not.toHaveBeenCalled();
    });
  });
});
