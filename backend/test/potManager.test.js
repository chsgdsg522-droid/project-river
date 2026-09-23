import { describe, expect, it } from 'vitest';
import { awardPots, buildPots } from '../src/game/PotManager.js';

function playersWithCommitments(commitments, folded = []) {
  return Object.entries(commitments).map(([id, totalCommitment], seat) => ({
    id,
    seat,
    totalCommitment,
    folded: folded.includes(id),
  }));
}

describe('side pots', () => {
  it('builds and splits nested all-in pots without losing a chip', () => {
    const pots = buildPots(playersWithCommitments({ a: 100, b: 250, c: 250 }));
    const payouts = awardPots(pots, [['a'], ['b', 'c']], 5);

    expect(pots.map(pot => pot.amount)).toEqual([300, 300]);
    expect(payouts.reduce((sum, payout) => sum + payout.amount, 0)).toBe(600);
    expect(payouts).toEqual([
      { playerId: 'a', amount: 300, potIndex: 0 },
      { playerId: 'b', amount: 150, potIndex: 1 },
      { playerId: 'c', amount: 150, potIndex: 1 },
    ]);
  });

  it('counts folded chips in pots but never awards them to a folded player', () => {
    const pots = buildPots(playersWithCommitments({ a: 50, b: 100, c: 200, d: 200 }, ['d']));
    const payouts = awardPots(pots, [['d'], ['a', 'b'], ['c']], 5);

    expect(pots.map(pot => pot.amount)).toEqual([200, 150, 200]);
    expect(pots.flatMap(pot => pot.eligible)).not.toContain('d');
    expect(payouts).toEqual([
      { playerId: 'a', amount: 100, potIndex: 0 },
      { playerId: 'b', amount: 100, potIndex: 0 },
      { playerId: 'b', amount: 150, potIndex: 1 },
      { playerId: 'c', amount: 200, potIndex: 2 },
    ]);
    expect(payouts.reduce((sum, payout) => sum + payout.amount, 0)).toBe(550);
  });

  it('gives an odd chip to the first tied winner clockwise after the button', () => {
    const pots = buildPots(playersWithCommitments({ button: 5, left: 5, across: 5 }));
    const payouts = awardPots(pots, [['left', 'across'], ['button']], 0);

    expect(payouts).toEqual([
      { playerId: 'left', amount: 8, potIndex: 0 },
      { playerId: 'across', amount: 7, potIndex: 0 },
    ]);
  });

  it('returns an empty list when nobody committed chips', () => {
    expect(buildPots(playersWithCommitments({ a: 0, b: 0 }))).toEqual([]);
  });
});
