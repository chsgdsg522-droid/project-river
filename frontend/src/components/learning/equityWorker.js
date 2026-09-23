const RANK_VALUE = Object.freeze({ '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 });

export function estimateVisibleEquity({ holeCards = [], board = [] }) {
  const ranks = [...holeCards, ...board].map(card => RANK_VALUE[card?.[0]] ?? 0);
  const pairBonus = ranks.some((rank, index) => ranks.indexOf(rank) !== index) ? 18 : 0;
  const highCard = Math.max(0, ...holeCards.map(card => RANK_VALUE[card?.[0]] ?? 0));
  return Math.max(8, Math.min(92, Math.round(22 + highCard * 2.2 + pairBonus + board.length * 1.5)));
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = event => self.postMessage({ equity: estimateVisibleEquity(event.data) });
}
