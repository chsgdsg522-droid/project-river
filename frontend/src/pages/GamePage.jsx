import { useEffect, useRef, useState } from 'react';
import { ActionDock } from '../components/poker/ActionDock.jsx';
import { PokerTable } from '../components/poker/PokerTable.jsx';
import { QuickChat, QUICK_CHAT_LABELS } from '../components/poker/QuickChat.jsx';
import { useGameSound } from '../hooks/useGameSound.js';

export function GamePage({ room, socket, muted = false, chatEvent = null }) {
  const [pending, setPending] = useState(false);
  const previous = useRef({ handId: room.handId, actorId: room.game?.actorId, pot: room.game?.pot, result: room.game?.lastHandResult });
  const play = useGameSound({ muted });

  useEffect(() => setPending(false), [room.revision]);
  useEffect(() => {
    if (previous.current.handId !== room.handId) play('deal');
    else if (previous.current.pot !== room.game?.pot) play('chip');
    if (previous.current.actorId !== room.game?.actorId && room.game?.actorId === room.self?.playerId) play('turn');
    if (!previous.current.result && room.game?.lastHandResult?.winnerIds?.includes(room.self?.playerId)) play('win');
    previous.current = { handId: room.handId, actorId: room.game?.actorId, pot: room.game?.pot, result: room.game?.lastHandResult };
  }, [play, room]);

  if (!room.game) return <main className="game-page"><p>牌局正在准备中…</p></main>;
  const selfId = room.self?.playerId;
  const self = room.game.players[selfId] ?? null;
  const chatName = chatEvent ? room.seats.find(seat => seat.playerId === chatEvent.playerId)?.displayName : null;

  function sendAction(action) {
    if (pending) return;
    setPending(true);
    socket.request({
      type: 'game.action',
      roomCode: room.code,
      handId: room.handId,
      actionId: socket.nextActionId(),
      revision: room.revision,
      action,
    });
  }

  return (
    <main className="game-page">
      <header className="game-statusbar">
        <span>第 {room.game.handNumber} / 10 手</span>
        <strong>{room.code}</strong>
        {room.self?.role === 'spectator' && <span>观战模式</span>}
      </header>
      <PokerTable room={room} />
      {chatEvent && <p className="chat-toast" role="status">{chatName ? `${chatName}：` : ''}{QUICK_CHAT_LABELS[chatEvent.messageId]}</p>}
      {room.self?.role === 'player' && room.game.actorId === selfId && (
        <ActionDock
          legal={room.game.legalActions}
          pot={room.game.pot}
          streetCommitment={self?.streetCommitment ?? 0}
          callTo={room.game.currentBet}
          onAction={sendAction}
          disabled={pending}
        />
      )}
      <QuickChat
        disabled={pending}
        onSend={messageId => socket.request({ type: 'quickChat.send', roomCode: room.code, messageId })}
      />
    </main>
  );
}
