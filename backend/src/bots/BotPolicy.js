import { evaluateBest } from '../game/HandEvaluator.js';
import { PERSONAS } from './personas.js';

const RANK = Object.freeze({ '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 });
const SUIT = Object.freeze({ c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' });

function parseCard(code) {
  return { rank: code.slice(0, -1), suit: SUIT[code.at(-1)] };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function preflopStrength(holeCards) {
  const cards = holeCards.map(parseCard);
  const values = cards.map(card => RANK[card.rank]).sort((a, b) => b - a);
  if (values[0] === values[1]) return clamp(0.42 + values[0] / 26, 0, 1);
  const suited = cards[0].suit === cards[1].suit ? 0.07 : 0;
  const connected = Math.abs(values[0] - values[1]) <= 1 ? 0.06 : 0;
  return clamp(values[0] / 14 * 0.55 + values[1] / 14 * 0.2 + suited + connected - 0.08, 0, 1);
}

function visibleStrength(visibleState) {
  const self = visibleState.players[visibleState.actorId];
  const holeCards = self?.holeCards ?? [];
  const board = visibleState.board ?? [];
  if (holeCards.length !== 2) return 0;
  if (board.length < 3) return preflopStrength(holeCards);
  const hand = evaluateBest([...holeCards, ...board].map(parseCard));
  return clamp(hand.category / 8 * 0.82 + (hand.kickers[0] ?? 0) / 14 * 0.18, 0, 1);
}

function sizedRaise(limits, strength, persona) {
  const span = limits.maxTo - limits.minTo;
  const fraction = clamp(0.18 + strength * 0.42 + persona.aggression * 0.2, 0, 1);
  return Math.round(clamp(limits.minTo + span * fraction, limits.minTo, limits.maxTo));
}

export function decideBotAction({ personaId, visibleState, legalActions, random }) {
  const persona = PERSONAS[personaId];
  if (!persona) throw new Error('UNKNOWN_BOT_PERSONA');
  if (!legalActions) throw new Error('BOT_HAS_NO_LEGAL_ACTIONS');

  const strength = visibleStrength(visibleState);
  const noise = (random() - 0.5) * persona.volatility;
  const positionBonus = visibleState.buttonId === visibleState.actorId ? 0.04 : 0;
  const callAmount = legalActions.callAmount ?? 0;
  const pressure = callAmount / Math.max(1, visibleState.pot + callAmount);
  const decisionScore = clamp(strength + noise + positionBonus - pressure * 0.42, 0, 1);
  const continueThreshold = 0.74 - persona.looseness * 0.55;

  if (legalActions.fold && decisionScore < continueThreshold) return { type: 'fold' };

  const limits = legalActions.raise ?? legalActions.bet;
  const raiseChance = persona.aggression * (0.2 + decisionScore * 0.8);
  if (limits && random() < raiseChance) {
    if (decisionScore > 0.93 && random() < persona.aggression * 0.18) return { type: 'allIn' };
    return {
      type: legalActions.raise ? 'raise' : 'bet',
      raiseTo: sizedRaise(limits, decisionScore, persona),
    };
  }

  if (legalActions.check) return { type: 'check' };
  if (legalActions.callAmount !== null) return { type: 'call' };
  if (legalActions.fold) return { type: 'fold' };
  return { type: 'allIn' };
}
