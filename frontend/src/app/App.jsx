import { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { parseRoomCode, socketClient } from '../lib/socketClient.js';
import { GamePage } from '../pages/GamePage.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { PracticePage } from '../pages/PracticePage.jsx';
import { ResultsPage } from '../pages/ResultsPage.jsx';
import { RoomPage } from '../pages/RoomPage.jsx';
import { TutorialPage } from '../pages/TutorialPage.jsx';
import { useApp } from './AppProviders.jsx';

function Placeholder({ title, description }) {
  return (
    <section className="route-placeholder">
      <p className="route-placeholder__label">Project River</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

function JoinEntry({ socket, errorCode }) {
  const { code } = useParams();
  return <HomePage key={code} socket={socket} errorCode={errorCode} initialRoomCode={parseRoomCode(code) ?? ''} />;
}

function Shell({ socket }) {
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [connectionState, setConnectionState] = useState('idle');
  const [notice, setNotice] = useState(null);
  const [chatEvent, setChatEvent] = useState(null);
  const { preferences, profile, addMatch } = useApp();

  useEffect(() => socket.subscribe(message => {
    // An open transport is not yet a restored room. Wait for its fresh snapshot.
    if (message.type === 'client.status') setConnectionState(message.payload.status === 'connected' ? 'syncing' : message.payload.status);
    else if (message.type === 'client.error' || message.type === 'game.error') {
      setErrorCode(message.payload.code);
      if (['ROOM_NOT_FOUND', 'SESSION_NOT_FOUND', 'SESSION_REPLACED'].includes(message.payload.code)) {
        socket.close();
        setRoom(null);
        navigate('/');
      }
    } else if (message.type === 'server.notice') setNotice(message.payload.code);
    else if (message.type === 'quickChat.event') setChatEvent(message.payload);
    else if (message.type === 'room.state') {
      setConnectionState('connected');
      setErrorCode(null);
      setRoom({ ...message.payload, revision: message.revision });
      const code = message.payload.code;
      if (message.payload.phase === 'waiting') navigate(`/room/${code}`, { replace: true });
      else if (message.payload.phase === 'playing') navigate(message.payload.mode === 'practice' ? '/practice' : `/game/${code}`, { replace: true });
      else if (message.payload.phase === 'results') navigate(`/results/${code}`, { replace: true });
    }
  }), [navigate, socket]);

  useEffect(() => {
    if (!chatEvent) return undefined;
    const timer = setTimeout(() => setChatEvent(null), 2_500);
    return () => clearTimeout(timer);
  }, [chatEvent]);

  // Navigating away (including browser history) explicitly abandons the
  // memory-only session; later broadcasts must not pull the player back.
  useEffect(() => {
    const changedPath = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    if (!changedPath || !room) return;
    const roomPaths = [`/room/${room.code}`, `/game/${room.code}`, `/results/${room.code}`];
    if (room.mode === 'practice') roomPaths.push('/practice');
    if (!roomPaths.includes(location.pathname)) leaveRoom();
  }, [location.pathname, room, socket]);

  function leaveRoom() {
    socket.close();
    setRoom(null);
    setChatEvent(null);
    setNotice(null);
    setErrorCode(null);
  }

  function returnHome() {
    leaveRoom();
    navigate('/');
  }

  const rawSummary = room?.game?.matchStatus?.summary ?? null;
  const summary = rawSummary ? {
    ...rawSummary,
    players: rawSummary.players.map(player => ({
      ...player,
      displayName: room.seats.find(seat => seat.playerId === player.playerId)?.displayName ?? player.playerId,
    })),
  } : null;

  return (
    <div className="app-shell">
      <header className="shell-header">
        <NavLink className="wordmark" to="/" aria-label="Project River 首页" onClick={leaveRoom}>
          <span aria-hidden="true">R</span>
          <strong>Project River</strong>
        </NavLink>
        <nav aria-label="主导航">
          <NavLink to="/tutorial" onClick={leaveRoom}>规则速学</NavLink>
          <NavLink to="/practice" onClick={() => { if (room?.mode !== 'practice') leaveRoom(); }}>练习桌</NavLink>
        </nav>
      </header>
      <Routes location={location}>
        <Route path="/" element={<HomePage socket={socket} errorCode={errorCode} />} />
        <Route path="/room/:code" element={room ? <RoomPage room={room} socket={socket} connectionState={connectionState} notice={notice} /> : <JoinEntry socket={socket} errorCode={errorCode} />} />
        <Route path="/game/:code" element={room ? <GamePage room={room} socket={socket} muted={preferences.muted} chatEvent={chatEvent} connectionState={connectionState} errorCode={errorCode} /> : <JoinEntry socket={socket} errorCode={errorCode} />} />
        <Route path="/tutorial" element={<TutorialPage onFinish={() => navigate('/practice')} />} />
        <Route path="/practice" element={profile ? <PracticePage room={room?.mode === 'practice' ? room : null} socket={socket} profile={profile} muted={preferences.muted} chatEvent={chatEvent} connectionState={connectionState} errorCode={errorCode} /> : <HomePage socket={socket} errorCode={errorCode} />} />
        <Route path="/results/:code" element={room ? <ResultsPage summary={summary} selfId={room?.self?.playerId} isHost={room?.hostPlayerId === room?.self?.playerId} onRecord={addMatch} onRematch={() => socket.request({ type: 'match.rematch', roomCode: room.code })} onHome={returnHome} /> : <JoinEntry socket={socket} errorCode={errorCode} />} />
        <Route path="*" element={<Placeholder title="找不到页面" description="返回首页重新开始。" />} />
      </Routes>
    </div>
  );
}

export default function App({ socket = socketClient }) {
  return <Shell socket={socket} />;
}
