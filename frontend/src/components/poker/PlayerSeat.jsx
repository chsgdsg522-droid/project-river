export function PlayerSeat({ player, seat, isActor = false, isSelf = false, position }) {
  if (!player) {
    return <div className={`table-seat table-seat--empty table-seat--${position ?? seat?.seat}`}>空位</div>;
  }
  const takeover = seat?.kind === 'human' && (!seat.connected || seat.controller === 'bot');
  return (
    <section className={`table-seat table-seat--${position ?? seat?.seat} ${isActor ? 'is-actor' : ''} ${isSelf ? 'is-self' : ''}`} aria-label={`${player.displayName}的座位`}>
      <div className="table-seat__topline">
        <strong>{player.displayName}</strong>
        {isActor && <span>行动中</span>}
      </div>
      <div className="table-seat__stack">{player.stack.toLocaleString()}</div>
      {player.lastAction && <div className="table-seat__action">{player.lastAction.type} {player.lastAction.amount || ''}</div>}
      {player.folded && <div className="table-seat__state">已弃牌 Folded</div>}
      {player.allIn && <div className="table-seat__state">全下 All-in</div>}
      {takeover && <div className="table-seat__state">连接中断，电脑暂时代打</div>}
    </section>
  );
}
