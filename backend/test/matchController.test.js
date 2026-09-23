import { describe, expect, it } from 'vitest';
import { MatchController } from '../src/game/MatchController.js';

function fakeGame(stacks, handNumber) {
  const players = Object.fromEntries(Object.entries(stacks).map(([playerId, stack], seat) => [
    playerId,
    { id: playerId, displayName: playerId.toUpperCase(), seat, stack },
  ]));
  return {
    handNumber,
    players,
    rules: { startingChips: 1_000, maxHands: 10 },
    matchStats: Object.fromEntries(Object.keys(stacks).map(playerId => [
      playerId,
      { handsWon: 0, biggestPot: 0, peakStack: 1_000 },
    ])),
    largestPot: 0,
  };
}

describe('MatchController', () => {
  it.each([
    [1, 10, 20],
    [4, 10, 20],
    [5, 20, 40],
    [7, 20, 40],
    [8, 40, 80],
    [10, 40, 80],
  ])('uses the correct blinds for hand %i', (hand, smallBlind, bigBlind) => {
    expect(new MatchController().blindsFor(hand)).toEqual({ smallBlind, bigBlind });
  });

  it('ends after hand ten with tied ranks preserved', () => {
    const game = fakeGame({ a: 1_500, b: 1_500, c: 0 }, 10);
    const status = new MatchController().afterHand(game, { pot: 300, winnerIds: ['a', 'b'] });

    expect(status).toMatchObject({ handNumber: 10, complete: true, reason: 'tenHands' });
    expect(status.rankings.map(rank => [rank.playerId, rank.rank])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ]);
  });

  it('ends early only when one player has chips remaining', () => {
    const controller = new MatchController();

    expect(controller.afterHand(fakeGame({ a: 3_000, b: 0, c: 0 }, 4), { pot: 900, winnerIds: ['a'] }))
      .toMatchObject({ complete: true, reason: 'lastPlayer' });
    expect(controller.afterHand(fakeGame({ a: 1_500, b: 1_500, c: 0 }, 4), { pot: 300, winnerIds: ['a'] }))
      .toMatchObject({ complete: false, reason: null, rankings: null });
  });

  it('resets stacks and match counters while preserving seat identity', () => {
    const game = fakeGame({ a: 2_200, b: 800, c: 0 }, 7);
    const reset = new MatchController().reset(game.players, game.rules);

    expect(reset.handNumber).toBe(0);
    expect(Object.values(reset.players).map(player => [player.id, player.seat, player.stack])).toEqual([
      ['a', 0, 1_000],
      ['b', 1, 1_000],
      ['c', 2, 1_000],
    ]);
  });
});
