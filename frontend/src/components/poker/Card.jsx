const SUITS = Object.freeze({
  s: { symbol: '♠', name: '黑桃', className: 'spade' },
  h: { symbol: '♥', name: '红桃', className: 'heart' },
  d: { symbol: '♦', name: '方片', className: 'diamond' },
  c: { symbol: '♣', name: '梅花', className: 'club' },
});

const RANK_NAMES = Object.freeze({ A: 'A', K: 'K', Q: 'Q', J: 'J', T: '10' });

export function Card({ code, hidden = false, compact = false }) {
  if (hidden || !code) return <span className={`poker-card poker-card--back ${compact ? 'poker-card--compact' : ''}`} aria-label="盖住的牌" />;
  const suit = SUITS[code.slice(-1)];
  const rawRank = code.slice(0, -1);
  const rank = RANK_NAMES[rawRank] ?? rawRank;
  return (
    <span className={`poker-card poker-card--${suit?.className ?? 'spade'} ${compact ? 'poker-card--compact' : ''}`} aria-label={`${suit?.name ?? ''}${rank}`}>
      <strong>{rank}</strong><span aria-hidden="true">{suit?.symbol}</span>
    </span>
  );
}
