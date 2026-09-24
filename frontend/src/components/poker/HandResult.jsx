import { useEffect, useState } from 'react';
import { Card } from './Card.jsx';

const HAND_NAMES = Object.freeze([
  ['高牌', 'High Card'], ['一对', 'One Pair'], ['两对', 'Two Pair'],
  ['三条', 'Three of a Kind'], ['顺子', 'Straight'], ['同花', 'Flush'],
  ['葫芦', 'Full House'], ['四条', 'Four of a Kind'], ['同花顺', 'Straight Flush'],
]);

function WinnerMark() {
  return (
    <span className="hand-winner" aria-label="获胜 Winner">
      <svg className="hand-winner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 3h10v6a5 5 0 0 1-10 0V3Zm0 2H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4M12 14v5m-4 2h8m-6-2h4" />
      </svg>
      <span>获胜 <small lang="en">Winner</small></span>
    </span>
  );
}

export function HandResult({ room, onContinue, disabled = false }) {
  const { game } = room;
  const result = game.lastHandResult;
  const final = game.matchStatus?.complete;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (room.handReviewUntil == null) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [room.handReviewUntil]);
  const seconds = Math.max(0, Math.ceil(((room.handReviewUntil ?? now) - now) / 1_000));
  const winners = new Set(result.winnerIds);
  const players = game.order.map(id => game.players[id]).filter(player => (
    player && !player.folded && (result.hands?.[player.id] || winners.has(player.id))
  ));
  const canContinue = room.mode === 'practice' && room.self?.playerId === room.hostPlayerId;

  return (
    <section className="hand-result" aria-label="本手结果" data-testid="hand-result">
      <header className="hand-result__heading">
        <h1>{result.reason === 'showdown' ? '摊牌' : '本手结束'} <small lang="en">{result.reason === 'showdown' ? 'Showdown' : 'Hand complete'}</small></h1>
        <span>底池 <strong>{result.pot.toLocaleString()}</strong></span>
      </header>
      <div className="hand-result__board community-cards" aria-label="公共牌">
        {Array.from({ length: 5 }, (_, index) => <Card key={index} code={game.board[index]} hidden={!game.board[index]} />)}
      </div>
      <div className="hand-result__players">
        {players.map(player => {
          const hand = result.hands?.[player.id];
          const label = hand ? HAND_NAMES[hand.category] : null;
          const winner = winners.has(player.id);
          return (
            <section className={`showdown-player${winner ? ' is-winner' : ''}`} key={player.id} aria-label={`${player.displayName}的摊牌`}>
              <div className="showdown-player__identity">
                <strong>{player.displayName}{room.self?.playerId === player.id && <small>（你）</small>}</strong>
                {winner && <WinnerMark />}
              </div>
              <div className="showdown-player__cards">
                {[0, 1].map(index => <Card key={index} code={player.holeCards?.[index]} hidden={!player.holeCards?.[index]} compact />)}
              </div>
              <div className="showdown-player__type">
                <strong>{label?.[0] ?? '未摊牌'}</strong>
                <span lang="en">{label?.[1] ?? 'No showdown'}</span>
              </div>
            </section>
          );
        })}
      </div>
      <footer className="hand-result__continue">
        {canContinue
          ? <button className="primary-button" type="button" disabled={disabled} onClick={onContinue}>{final ? '查看总排名 Results' : '下一手 Next hand'}</button>
          : <p>{room.mode === 'practice' ? '等待玩家继续' : seconds > 0 ? `${seconds} 秒后${final ? '查看总排名' : '下一手'}` : '正在同步牌局…'}</p>}
      </footer>
    </section>
  );
}
