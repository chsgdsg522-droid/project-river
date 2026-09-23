import { HostControls } from '../components/room/HostControls.jsx';
import { InvitePanel } from '../components/room/InvitePanel.jsx';
import { SeatGrid } from '../components/room/SeatGrid.jsx';

export function RoomPage({ room, socket, connectionState = 'connected', notice = null, clipboard }) {
  if (!room) {
    return <main className="room-page room-page--empty"><p>正在恢复牌桌…</p></main>;
  }
  const selfId = room.self?.playerId;
  const isHost = selfId === room.hostPlayerId;
  const isSeated = room.seats.some(seat => seat.playerId === selfId);
  const wasKicked = room.self?.role === 'player' && !isSeated;

  const send = message => socket.request({ ...message, roomCode: room.code });
  return (
    <main className="room-page">
      <header className="room-heading">
        <div>
          <p>好友房</p>
          <h1>等大家入座</h1>
        </div>
        <span>{room.seats.filter(seat => seat.kind).length} / 6</span>
      </header>

      <div className="room-notices" aria-live="polite">
        {connectionState === 'reconnecting' && <p>正在重新连接…</p>}
        {notice === 'SERVER_RESTARTED' && <p>服务器已重启，请重新加入房间</p>}
        {room.self?.role === 'spectator' && <p>房间已满，你正在观战</p>}
        {wasKicked && <p>你已被移出房间</p>}
      </div>

      <div className="room-layout">
        <section className="room-seats" aria-labelledby="seats-title">
          <h2 id="seats-title" className="sr-only">座位</h2>
          <SeatGrid
            seats={room.seats}
            hostPlayerId={room.hostPlayerId}
            isHost={isHost}
            onKick={targetPlayerId => send({ type: 'room.kick', targetPlayerId })}
            onRemoveBot={seat => send({ type: 'room.bot.remove', seat })}
          />
        </section>
        <aside className="room-sidebar">
          <InvitePanel code={room.code} clipboard={clipboard} />
          {isHost && (
            <HostControls
              room={room}
              onAddBot={personaId => send({ type: 'room.bot.add', personaId })}
              onStart={() => send({ type: 'room.start' })}
            />
          )}
        </aside>
      </div>
    </main>
  );
}
