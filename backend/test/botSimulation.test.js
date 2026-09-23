import { describe, expect, it } from 'vitest';
import { decideBotAction } from '../src/bots/BotPolicy.js';
import { PERSONAS } from '../src/bots/personas.js';
import { Game } from '../src/game/Game.js';
import { projectRoom } from '../src/RoomView.js';

function lcg(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value / 2 ** 32;
  };
}

function decisionFixture(index) {
  const pairs = [['2c', '7d'], ['8c', '9d'], ['Qc', 'Kd'], ['As', 'Ad']];
  return {
    actorId: 'self', pot: 160, board: [], order: ['self', 'b', 'c'], buttonId: index % 2 ? 'self' : 'c',
    players: {
      self: { id: 'self', stack: 900, holeCards: pairs[index % pairs.length], folded: false, allIn: false },
      b: { id: 'b', stack: 900, folded: false, allIn: false },
      c: { id: 'c', stack: 900, folded: false, allIn: false },
    },
  };
}

const legalActions = {
  fold: true,
  check: false,
  callAmount: 40,
  bet: null,
  raise: { minTo: 160, maxTo: 900, reopened: true },
  allInTo: 900,
};

describe('bot simulations', () => {
  it('produces observable persona differences over fixed decisions', () => {
    const stats = {};
    for (const personaId of Object.keys(PERSONAS)) {
      const random = lcg(42);
      let vpip = 0;
      let raises = 0;
      for (let index = 0; index < 5_000; index += 1) {
        const action = decideBotAction({ personaId, visibleState: decisionFixture(index), legalActions, random });
        if (!['fold', 'check'].includes(action.type)) vpip += 1;
        if (['raise', 'bet', 'allIn'].includes(action.type)) raises += 1;
      }
      stats[personaId] = { vpip: vpip / 5_000, raiseRate: raises / 5_000 };
    }

    expect(stats.songguo.vpip).toBeGreaterThan(stats.yanshu.vpip + 0.12);
    expect(stats.xiaoman.raiseRate).toBeGreaterThan(stats.yanshu.raiseRate + 0.08);
  });

  it('completes 5,000 deterministic six-bot matches without illegal actions or lost chips', () => {
    for (let match = 1; match <= 5_000; match += 1) {
      const random = lcg(match);
      const personaIds = Object.keys(PERSONAS);
      const game = new Game({
        players: Array.from({ length: 6 }, (_, seat) => ({
          id: `bot-${seat}`,
          displayName: PERSONAS[personaIds[seat % personaIds.length]].displayName,
          seat,
        })),
        randomInt: max => Math.floor(random() * max),
      });
      const room = {
        code: 'ABC234', phase: 'playing', mode: 'practice', revision: 1, hostPlayerId: null,
        seats: Array.from({ length: 6 }, (_, seat) => ({ seat, playerId: `bot-${seat}`, kind: 'bot', personaId: personaIds[seat % personaIds.length], controller: 'bot' })),
        spectators: [], game,
      };
      game.startMatch();
      let actions = 0;
      while (game.phase !== 'results' && actions < 1_500) {
        if (game.phase === 'betweenHands') {
          game.startNextHand();
          continue;
        }
        const actorId = game.snapshot().actorId;
        const seat = room.seats.find(value => value.playerId === actorId);
        const visibleState = projectRoom(room, { playerId: actorId, role: 'player' }).game;
        const action = decideBotAction({
          personaId: seat.personaId,
          visibleState,
          legalActions: game.legalActionsFor(actorId),
          random,
        });
        game.dispatch(actorId, action);
        actions += 1;
      }

      expect(actions).toBeLessThan(1_500);
      const stacks = Object.values(game.snapshot().players).map(player => player.stack);
      expect(stacks.every(stack => stack >= 0)).toBe(true);
      expect(stacks.reduce((sum, stack) => sum + stack, 0)).toBe(6_000);
    }
  }, 30_000);
});
