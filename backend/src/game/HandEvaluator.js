const RANK_VALUES = Object.freeze({
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
});

const SUIT_ALIASES = Object.freeze({
  clubs: 'clubs',
  diamonds: 'diamonds',
  hearts: 'hearts',
  spades: 'spades',
  '♣': 'clubs',
  '♦': 'diamonds',
  '♥': 'hearts',
  '♠': 'spades',
});

const LABELS = Object.freeze([
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
]);

const LEGACY_RANK = Object.freeze({
  0: 10,
  1: 9,
  2: 8,
  3: 7,
  4: 6,
  5: 5,
  6: 4,
  7: 3,
  8: 2,
});

function normalizeCard(card) {
  const rank = card?.rank === '10' ? 'T' : card?.rank;
  const suit = SUIT_ALIASES[card?.suit];
  if (!(rank in RANK_VALUES) || !suit) {
    throw new TypeError('Card must contain a supported rank and suit');
  }
  return { rank, suit };
}

function combinations(values, choose) {
  const result = [];

  function visit(start, selected) {
    if (selected.length === choose) {
      result.push(selected);
      return;
    }
    for (let index = start; index <= values.length - (choose - selected.length); index += 1) {
      visit(index + 1, [...selected, values[index]]);
    }
  }

  visit(0, []);
  return result;
}

function compareNumberArrays(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function straightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique[0] === 14) unique.push(1);

  for (let index = 0; index <= unique.length - 5; index += 1) {
    const run = unique.slice(index, index + 5);
    if (run.every((value, offset) => offset === 0 || run[offset - 1] - value === 1)) {
      return run[0];
    }
  }
  return null;
}

function withCompatibility(category, kickers) {
  const label = LABELS[category];
  const score = [category, ...kickers].reduce((value, part) => value * 15 + part, 0);
  const result = {
    category,
    kickers,
    label,
    rank: LEGACY_RANK[category],
    name: label,
    score,
  };
  result.cmp = other => compareHands(result, other);
  return result;
}

function evaluateFive(input) {
  const cards = input.map(normalizeCard);
  const values = cards.map(card => RANK_VALUES[card.rank]);
  const isFlush = cards.every(card => card.suit === cards[0].suit);
  const highStraight = straightHigh(values);
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const groups = [...counts.entries()].sort((left, right) => right[1] - left[1] || right[0] - left[0]);

  if (isFlush && highStraight !== null) return withCompatibility(8, [highStraight]);

  if (groups[0][1] === 4) {
    return withCompatibility(7, [groups[0][0], groups.find(([, count]) => count === 1)[0]]);
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return withCompatibility(6, [groups[0][0], groups[1][0]]);
  }

  const descending = [...values].sort((a, b) => b - a);
  if (isFlush) return withCompatibility(5, descending);
  if (highStraight !== null) return withCompatibility(4, [highStraight]);

  if (groups[0][1] === 3) {
    return withCompatibility(3, [groups[0][0], ...groups.filter(([, count]) => count === 1).map(([value]) => value)]);
  }

  const pairs = groups.filter(([, count]) => count === 2).map(([value]) => value);
  if (pairs.length === 2) {
    return withCompatibility(2, [...pairs, groups.find(([, count]) => count === 1)[0]]);
  }
  if (pairs.length === 1) {
    return withCompatibility(1, [pairs[0], ...groups.filter(([, count]) => count === 1).map(([value]) => value)]);
  }

  return withCompatibility(0, descending);
}

export function compareHands(left, right) {
  const leftCategory = left.category ?? 10 - left.rank;
  const rightCategory = right.category ?? 10 - right.rank;
  if (leftCategory !== rightCategory) return Math.sign(leftCategory - rightCategory);
  return compareNumberArrays(left.kickers, right.kickers);
}

export function evaluateBest(input) {
  if (!Array.isArray(input) || input.length < 5 || input.length > 7) {
    throw new RangeError('evaluateBest requires between five and seven cards');
  }

  let best = null;
  for (const candidate of combinations(input, 5)) {
    const evaluated = evaluateFive(candidate);
    if (best === null || compareHands(evaluated, best) > 0) best = evaluated;
  }
  return best;
}

export class HandEvaluator {
  evaluate(holeCards, communityCards) {
    return evaluateBest([...holeCards, ...communityCards]);
  }
}
