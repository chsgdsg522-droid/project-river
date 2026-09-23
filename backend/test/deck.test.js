import { describe, expect, it, vi } from 'vitest';
import { createDeck, Deck, shuffle } from '../src/game/Deck.js';

describe('deck', () => {
  it('creates 52 unique normalized cards', () => {
    const deck = createDeck();

    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(card => `${card.rank}:${card.suit}`)).size).toBe(52);
    expect(deck[0]).toEqual({ rank: '2', suit: 'clubs' });
    expect(deck.at(-1)).toEqual({ rank: 'A', suit: 'spades' });
  });

  it('uses the supplied random source for every Fisher-Yates swap without mutating input', () => {
    const input = ['A', 'B', 'C'];
    const calls = [];

    const result = shuffle(input, max => {
      calls.push(max);
      return 0;
    });

    expect(calls).toEqual([3, 2]);
    expect(result).toEqual(['B', 'C', 'A']);
    expect(input).toEqual(['A', 'B', 'C']);
  });

  it('lets Deck use an injected random source and draw every card once', () => {
    const randomInt = vi.fn(() => 0);
    const deck = new Deck({ randomInt });
    const drawn = Array.from({ length: 52 }, () => deck.draw());

    expect(randomInt).toHaveBeenCalledTimes(51);
    expect(new Set(drawn.map(card => `${card.rank}:${card.suit}`)).size).toBe(52);
    expect(deck.draw()).toBeUndefined();
  });
});
