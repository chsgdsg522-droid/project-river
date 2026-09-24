import { useEffect, useRef, useState } from 'react';
import { LearningPanel } from '../components/learning/LearningPanel.jsx';
import { GamePage } from './GamePage.jsx';

export function PracticePage({ room, socket, profile, muted = false, chatEvent = null, connectionState = 'connected', errorCode = null }) {
  const [showLearning, setShowLearning] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (room?.mode === 'practice' || !profile || requested.current) return;
    requested.current = true;
    socket.connect().then(() => socket.request({
      type: 'practice.create',
      profile: { displayName: profile.nickname, avatarId: profile.avatarId },
    })).catch(() => { requested.current = false; });
  }, [profile, room, socket]);

  if (!room || room.mode !== 'practice') {
    return <main className="route-placeholder"><p className="route-placeholder__label">Practice</p><h1>正在布置练习桌</h1><p>五位电脑玩家马上入座。</p></main>;
  }
  const self = room.game?.players?.[room.self?.playerId];
  const reviewing = Boolean(room.game?.lastHandResult);
  return (
    <>
      <GamePage room={room} socket={socket} muted={muted} chatEvent={chatEvent} connectionState={connectionState} errorCode={errorCode} />
      {!reviewing && <label className="learning-toggle">
        <input type="checkbox" role="switch" checked={showLearning} onChange={event => setShowLearning(event.target.checked)} />
        <span>显示学习辅助</span>
      </label>}
      {showLearning && !reviewing && <LearningPanel mode={room.mode} holeCards={self?.holeCards} board={room.game?.board} pot={room.game?.pot} callAmount={room.game?.legalActions?.callAmount} />}
    </>
  );
}
