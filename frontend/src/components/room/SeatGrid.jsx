function Avatar({ id, name }) {
  const marker = id?.replace('river-', '').slice(0, 1).toUpperCase() ?? '?';
  return <span className={`seat-avatar seat-avatar--${id ?? 'empty'}`} aria-hidden="true">{marker || name?.slice(0, 1)}</span>;
}

export function SeatGrid({ seats, hostPlayerId, isHost, onKick, onRemoveBot }) {
  const ordered = Array.from({ length: 6 }, (_, seatNumber) => seats.find(seat => seat.seat === seatNumber) ?? {
    seat: seatNumber, playerId: null, kind: null, displayName: null, connected: false,
  });
  return (
    <ol className="seat-grid" aria-label="六个座位">
      {ordered.map(seat => (
        <li key={seat.seat} className={`room-seat room-seat--${seat.kind ?? 'empty'}`} data-testid="room-seat">
          <span className="seat-number">{seat.seat + 1}</span>
          {seat.kind ? (
            <>
              <Avatar id={seat.avatarId} name={seat.displayName} />
              <span className="seat-copy">
                <strong>{seat.displayName}</strong>
                <small>
                  {seat.playerId === hostPlayerId ? '房主' : seat.kind === 'bot' ? '电脑玩家' : seat.connected ? '已连接' : '连接中断'}
                </small>
              </span>
              {isHost && seat.kind === 'bot' && (
                <button type="button" className="seat-remove" aria-label={`移除电脑玩家 ${seat.displayName}`} onClick={() => onRemoveBot(seat.seat)}>移除</button>
              )}
              {isHost && seat.kind === 'human' && seat.playerId !== hostPlayerId && (
                <button type="button" className="seat-remove" aria-label={`移除玩家 ${seat.displayName}`} onClick={() => onKick(seat.playerId)}>移除</button>
              )}
            </>
          ) : (
            <span className="seat-empty">等待玩家</span>
          )}
        </li>
      ))}
    </ol>
  );
}
