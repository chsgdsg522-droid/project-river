import { Card } from './Card.jsx';
import { HandInfo } from './HandInfo.jsx';
import { PlayerSeat } from './PlayerSeat.jsx';
import { TurnTimer } from './TurnTimer.jsx';

export function PokerTable({ room }) {
  const { game } = room;
  const selfId = room.self?.playerId;
  const self = game.players[selfId] ?? null;
  const seats = Array.from({ length: 6 }, (_, position) => room.seats.find(seat => seat.seat === position) ?? { seat: position, kind: null });
  return (
    <section className="poker-table" aria-label="德州扑克牌桌">
      <div className="table-oval" aria-hidden="true" />
      {seats.map(seat => (
        <PlayerSeat
          key={seat.seat}
          seat={seat}
          position={seat.seat}
          player={seat.playerId ? game.players[seat.playerId] : null}
          isActor={game.actorId === seat.playerId}
          isSelf={selfId === seat.playerId}
        />
      ))}
      <div className="table-center">
        <HandInfo street={game.street} holeCards={self?.holeCards} board={game.board} />
        <div className="community-cards" aria-label="公共牌">
          {Array.from({ length: 5 }, (_, index) => <Card key={index} code={game.board[index]} hidden={!game.board[index]} />)}
        </div>
        <div className="pot-label">底池 <span lang="en">Pot</span> <strong>{game.pot}</strong></div>
      </div>
      {self?.holeCards && (
        <div className="self-hand" aria-label="你的手牌">
          {self.holeCards.map(code => <Card key={code} code={code} />)}
        </div>
      )}
      {game.actorId === selfId && room.actionDeadline && <TurnTimer deadline={room.actionDeadline} />}
    </section>
  );
}
