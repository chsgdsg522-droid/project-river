import { useEffect, useRef, useState } from 'react';
import { ActionDock } from '../components/poker/ActionDock.jsx';
import { PokerTable } from '../components/poker/PokerTable.jsx';
import { QuickChat, QUICK_CHAT_LABELS } from '../components/poker/QuickChat.jsx';
import { useGameSound } from '../hooks/useGameSound.js';

const ACTION_ERRORS = {
  STALE_REVISION: '牌局已更新，请按最新牌面重新操作。',
  STALE_HAND: '已进入新一手，请按最新牌面操作。',
  NOT_YOUR_TURN: '还未轮到你，请等待其他玩家。',
  HUMAN_CONTROL_PENDING: '电脑正在代打，本手结束后恢复操作。',
  QUICK_CHAT_RATE_LIMITED: '消息发送太快，请稍等再发。',
};

export function GamePage({ room, socket, muted = false, chatEvent = null, connectionState = 'connected', errorCode = null }) {
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const previous = useRef({ handId: room.handId, actorId: room.game?.actorId, pot: room.game?.pot, result: room.game?.lastHandResult });
  const play = useGameSound({ muted });

  // Rejections and reconnects can return a fresh snapshot at the same revision.
  useEffect(() => { setPending(false); setRequestError(null); }, [room]);
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
  const disconnected = connectionState !== 'connected' || requestError === 'SOCKET_NOT_CONNECTED';
  const disabled = pending || disconnected;
  const visibleError = requestError ?? errorCode;

  function request(message) {
    try {
      socket.request(message);
    } catch (error) {
      setPending(false);
      setRequestError(error.message);
    }
  }

  function sendAction(action) {
    if (disabled) return;
    setPending(true);
    setRequestError(null);
    request({
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
      {disconnected && <p className="room-notices" role="status">正在重新连接并同步牌局…操作已暂停，请勿刷新页面。</p>}
      {!disconnected && visibleError && <p className="room-notices" role="alert">{ACTION_ERRORS[visibleError] ?? '操作未成功，请检查当前牌局后重试。'}</p>}
      <PokerTable room={room} />
      {chatEvent && <p className="chat-toast" role="status">{chatName ? `${chatName}：` : ''}{QUICK_CHAT_LABELS[chatEvent.messageId]}</p>}
      {room.self?.role === 'player' && room.game.actorId === selfId && (
        <ActionDock
          legal={room.game.legalActions}
          pot={room.game.pot}
          streetCommitment={self?.streetCommitment ?? 0}
          callTo={room.game.currentBet}
          onAction={sendAction}
          disabled={disabled}
        />
      )}
      <QuickChat
        disabled={disabled}
        onSend={messageId => { if (!disabled) request({ type: 'quickChat.send', roomCode: room.code, messageId }); }}
      />
    </main>
  );
}
