import { useEffect, useRef } from 'react';

export function ResultsPage({ summary, selfId, isHost = false, onRecord, onRematch, onHome }) {
  const recorded = useRef(null);
  useEffect(() => {
    if (!summary || recorded.current === summary.matchId) return;
    const self = summary.players.find(player => player.playerId === selfId);
    if (self) onRecord?.({ matchId: summary.matchId, placement: self.rank, handsWon: self.handsWon, biggestPot: self.biggestPot });
    recorded.current = summary.matchId;
  }, [onRecord, selfId, summary]);

  if (!summary) return <main className="route-placeholder"><p>正在整理本局结果…</p></main>;
  const rankCounts = summary.players.reduce((counts, player) => ({ ...counts, [player.rank]: (counts[player.rank] ?? 0) + 1 }), {});
  return (
    <main className="results-page">
      <header className="results-heading"><p>Match complete</p><h1>十手牌，落定。</h1><span>{summary.handsPlayed} 手 · 最大底池 {summary.largestPot}</span></header>
      <ol className="results-list">
        {summary.players.map(player => (
          <li key={player.playerId} className={player.playerId === selfId ? 'is-self' : ''}>
            <span className="result-rank">{rankCounts[player.rank] > 1 ? `并列第 ${player.rank} 名` : `第 ${player.rank} 名`}</span>
            <strong>{player.displayName ?? player.playerId}</strong>
            <span>{player.chips} 筹码</span>
            <small>赢下 {player.handsWon} 手 · 最大赢取 {player.biggestPot} · 最大增幅 {player.biggestRise}</small>
          </li>
        ))}
      </ol>
      <footer className="results-actions">
        <button type="button" className="secondary-button" onClick={onHome}>返回首页</button>
        {isHost ? <button type="button" className="primary-button" onClick={onRematch}>再来一局</button> : <p>等待房主发起下一局</p>}
      </footer>
    </main>
  );
}
