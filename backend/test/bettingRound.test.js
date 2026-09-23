import { describe, expect, it } from 'vitest';
import { nextActorId, uncontestedWinner } from '../src/game/BettingRound.js';
import { applyAction, getLegalActions } from '../src/game/PlayerActionValidator.js';

function player(id, seat, stack, streetCommitment = 0, extras = {}) {
  return { id, seat, stack, streetCommitment, totalCommitment: streetCommitment, folded: false, allIn: false, ...extras };
}

function bettingState(overrides = {}) {
  return {
    players: {
      a: player('a', 0, 900, 100),
      b: player('b', 1, 30, 100),
      c: player('c', 2, 900, 100),
    },
    order: ['a', 'b', 'c'],
    actorId: 'b',
    currentBet: 100,
    lastFullRaise: 60,
    bigBlind: 20,
    acted: new Set(['a']),
    raisingOpenFor: new Set(['b', 'c']),
    ...overrides,
  };
}

describe('betting round transitions', () => {
  it('does not reopen raising after a short all-in', () => {
    const { state: after } = applyAction(bettingState(), 'b', { type: 'allIn' });
    const legal = getLegalActions(after, 'a');

    expect(after.currentBet).toBe(130);
    expect(after.lastFullRaise).toBe(60);
    expect(legal.callAmount).toBe(30);
    expect(legal.raise).toBeNull();
    expect(legal.fold).toBe(true);
  });

  it('reopens raising for active opponents after a full raise', () => {
    const before = bettingState({
      actorId: 'c',
      players: {
        a: player('a', 0, 900, 100),
        b: player('b', 1, 900, 100),
        c: player('c', 2, 900, 100),
      },
      raisingOpenFor: new Set(['c']),
      acted: new Set(['a', 'b']),
    });

    const { state: after } = applyAction(before, 'c', { type: 'raise', raiseTo: 200 });

    expect(after.lastFullRaise).toBe(100);
    expect(after.raisingOpenFor).toEqual(new Set(['a', 'b']));
    expect(after.acted).toEqual(new Set(['c']));
  });

  it('skips folded and all-in seats when selecting the next actor', () => {
    const before = bettingState({
      players: {
        a: player('a', 0, 900, 100, { folded: true }),
        b: player('b', 1, 0, 130, { allIn: true }),
        c: player('c', 2, 900, 130),
      },
    });

    expect(nextActorId(before, 'a')).toBe('c');
  });

  it('identifies an early winner only after every opponent folds', () => {
    const before = bettingState({
      players: {
        a: player('a', 0, 900, 100, { folded: true }),
        b: player('b', 1, 900, 100),
        c: player('c', 2, 900, 100, { folded: true }),
      },
    });

    expect(uncontestedWinner(before)).toBe('b');
    expect(uncontestedWinner(bettingState())).toBeNull();
  });

  it('conserves chips and commitments through a full raise', () => {
    const before = bettingState({
      actorId: 'c',
      players: {
        a: player('a', 0, 900, 100),
        b: player('b', 1, 900, 100),
        c: player('c', 2, 900, 100),
      },
      raisingOpenFor: new Set(['c']),
    });
    const totalBefore = Object.values(before.players).reduce((sum, value) => sum + value.stack + value.totalCommitment, 0);
    const { state: after } = applyAction(before, 'c', { type: 'raise', raiseTo: 220 });
    const totalAfter = Object.values(after.players).reduce((sum, value) => sum + value.stack + value.totalCommitment, 0);

    expect(totalAfter).toBe(totalBefore);
  });
});
