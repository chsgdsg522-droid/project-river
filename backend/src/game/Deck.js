import { secureRandomInt } from './random.js';

export const RANKS = Object.freeze(['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']);
export const SUITS = Object.freeze(['clubs', 'diamonds', 'hearts', 'spades']);

export function createDeck() {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ rank, suit })));
}

export function shuffle(input, randomInt = secureRandomInt) {
  const cards = [...input];

  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    if (!Number.isSafeInteger(swapIndex) || swapIndex < 0 || swapIndex > index) {
      throw new RangeError(`Random index ${swapIndex} is outside 0..${index}`);
    }
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }

  return cards;
}

export class Deck {
  constructor({ randomInt = secureRandomInt } = {}) {
    this.randomInt = randomInt;
    this.cards = shuffle(createDeck(), this.randomInt);
  }

  shuffle() {
    this.cards = shuffle(this.cards, this.randomInt);
    return this.cards;
  }

  draw() {
    return this.cards.pop();
  }
}
