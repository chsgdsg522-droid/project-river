import { describe, expect, it } from 'vitest';
import { applyAction, GameRuleError, getLegalActions } from '../src/game/PlayerActionValidator.js';

function state(overrides = {}) {
  return {
    players: {
      hero: { id: 'hero', seat: 0, stack: 920, streetCommitment: 80, totalCommitment: 80, folded: false, allIn: false },
      villain: { id: 'villain', seat: 1, stack: 900, streetCommitment: 80, totalCommitment: 80, folded: false, allIn: false },
    },
    order: ['hero', 'villain'],
    actorId: 'hero',
    currentBet: 80,
    lastFullRaise: 80,
    bigBlind: 20,
    acted: new Set(),
    raisingOpenFor: new Set(['hero', 'villain']),
    ...overrides,
  };
}

describe('legal actions', () => {
  it('interprets raiseTo as the total street commitment', () => {
    const before = state();
    const { state: after } = applyAction(before, 'hero', { type: 'raise', raiseTo: 320 });

    expect(after.players.hero.streetCommitment).toBe(320);
    expect(after.players.hero.totalCommitment).toBe(320);
    expect(after.players.hero.stack).toBe(680);
    expect(before.players.hero.stack).toBe(920);
  });

  it('offers check and a minimum big-blind bet when no bet is open', () => {
    const before = state({
      currentBet: 0,
      players: {
        hero: { id: 'hero', seat: 0, stack: 1_000, streetCommitment: 0, totalCommitment: 0, folded: false, allIn: false },
        villain: { id: 'villain', seat: 1, stack: 1_000, streetCommitment: 0, totalCommitment: 0, folded: false, allIn: false },
      },
    });

    expect(getLegalActions(before, 'hero')).toMatchObject({
      fold: false,
      check: true,
      callAmount: null,
      bet: { minTo: 20, maxTo: 1_000 },
      raise: null,
      allInTo: 1_000,
    });
  });

  it('allows an exact short-stack call without making the stack negative', () => {
    const before = state({
      currentBet: 200,
      players: {
        hero: { id: 'hero', seat: 0, stack: 50, streetCommitment: 80, totalCommitment: 80, folded: false, allIn: false },
        villain: { id: 'villain', seat: 1, stack: 800, streetCommitment: 200, totalCommitment: 200, folded: false, allIn: false },
      },
    });

    const { state: after } = applyAction(before, 'hero', { type: 'call' });
    expect(after.players.hero).toMatchObject({ stack: 0, streetCommitment: 130, totalCommitment: 130, allIn: true });
  });

  it.each([
    ['not a number', Number.NaN],
    ['a decimal', 320.5],
    ['negative', -1],
    ['above the stack', 1_001],
  ])('rejects %s raise-to amount before mutating state', (_label, raiseTo) => {
    const before = state();

    expect(() => applyAction(before, 'hero', { type: 'raise', raiseTo })).toThrow(GameRuleError);
    expect(before.players.hero).toMatchObject({ stack: 920, streetCommitment: 80, totalCommitment: 80 });
  });

  it('rejects checking while facing a bet', () => {
    const facingBet = state({
      players: {
        hero: { id: 'hero', seat: 0, stack: 1_000, streetCommitment: 0, totalCommitment: 0, folded: false, allIn: false },
        villain: { id: 'villain', seat: 1, stack: 920, streetCommitment: 80, totalCommitment: 80, folded: false, allIn: false },
      },
    });

    expect(() => applyAction(facingBet, 'hero', { type: 'check' })).toThrowError('CHECK_NOT_AVAILABLE');
  });
});
