import { describe, expect, it } from 'vitest';
import { compareHands, evaluateBest, HandEvaluator } from '../src/game/HandEvaluator.js';

const SUITS = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };

function cards(value) {
  return value.split(/\s+/).map(token => ({
    rank: token.slice(0, -1),
    suit: SUITS[token.at(-1)],
  }));
}

describe('evaluateBest', () => {
  it.each([
    ['high card', 'As Jd 9c 6h 3s 2d 4c', 0, 'High Card'],
    ['one pair', 'As Ad 9c 6h 3s 2d 4c', 1, 'One Pair'],
    ['two pair', 'As Ad 9c 9h 3s 2d 4c', 2, 'Two Pair'],
    ['three of a kind', 'As Ad Ac 9h 3s 2d 4c', 3, 'Three of a Kind'],
    ['straight', '2s 3d 4c 5h 6s 9c Td', 4, 'Straight'],
    ['flush', 'As Js 9s 6s 3s 2d 4c', 5, 'Flush'],
    ['full house', 'As Ad Ac 9h 9s 2d 4c', 6, 'Full House'],
    ['four of a kind', 'As Ad Ac Ah 9s 2d 4c', 7, 'Four of a Kind'],
    ['straight flush', '9s Ts Js Qs Ks 2d 4c', 8, 'Straight Flush'],
  ])('recognizes %s', (_name, value, category, label) => {
    expect(evaluateBest(cards(value))).toMatchObject({ category, label });
  });

  it('uses the board when it is the best five-card hand', () => {
    const board = cards('Ah Kh Qh Jh Th');
    const first = evaluateBest([...board, ...cards('2c 3d')]);
    const second = evaluateBest([...board, ...cards('4s 5s')]);

    expect(compareHands(first, second)).toBe(0);
  });

  it('orders a wheel straight below a six-high straight', () => {
    const wheel = evaluateBest(cards('As 2d 3c 4h 5s 9d Tc'));
    const sixHigh = evaluateBest(cards('2s 3d 4c 5h 6s 9c Td'));

    expect(wheel.kickers).toEqual([5]);
    expect(compareHands(wheel, sixHigh)).toBe(-1);
  });

  it('uses all kickers to break otherwise equal pairs', () => {
    const aceKicker = evaluateBest(cards('Qs Qd As 9h 7s 3d 2c'));
    const kingKicker = evaluateBest(cards('Qh Qc Ks Jh Ts 3c 2d'));

    expect(compareHands(aceKicker, kingKicker)).toBe(1);
  });

  it('selects the best five cards from seven', () => {
    expect(evaluateBest(cards('Ah Ad Ac Kh Kd Ks 2c'))).toMatchObject({
      category: 6,
      kickers: [14, 13],
    });
  });

  it('keeps the legacy class adapter consistent with the normalized result', () => {
    const result = new HandEvaluator().evaluate(cards('Ah Ad'), cards('Ac Kh Kd 2s 3c'));

    expect(result).toMatchObject({
      category: 6,
      label: 'Full House',
      rank: 4,
      name: 'Full House',
      kickers: [14, 13],
    });
    expect(result.cmp({ category: 5, kickers: [14, 13, 12, 11, 9] })).toBeGreaterThan(0);
  });
});
