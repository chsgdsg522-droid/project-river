import { Term } from '../common/Term.jsx';

const STREET_TERMS = Object.freeze({ preflop: 'preflop', flop: 'flop', turn: 'turn', river: 'river', showdown: 'showdown' });

function madeHandLabel(cards) {
  if (!cards || cards.length < 2) return null;
  const ranks = cards.map(card => card.slice(0, -1));
  const counts = [...new Map(ranks.map(rank => [rank, ranks.filter(value => value === rank).length])).values()].sort((a, b) => b - a);
  if (counts[0] === 4) return ['四条', 'Four of a Kind'];
  if (counts[0] === 3 && counts[1] === 2) return ['葫芦', 'Full House'];
  if (counts[0] === 3) return ['三条', 'Three of a Kind'];
  if (counts.filter(count => count === 2).length >= 2) return ['两对', 'Two Pair'];
  if (counts[0] === 2) return ['一对', 'One Pair'];
  return cards.length >= 5 ? ['高牌', 'High Card'] : null;
}

export function HandInfo({ street, holeCards = [], board = [] }) {
  const label = madeHandLabel([...holeCards, ...board]);
  return (
    <div className="hand-info">
      <Term id={STREET_TERMS[street] ?? 'hand'} />
      {label && <span className="made-hand"><strong>{label[0]}</strong><small lang="en">{label[1]}</small></span>}
    </div>
  );
}
