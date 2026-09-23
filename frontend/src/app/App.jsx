import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { socketClient } from '../lib/socketClient.js';
import { GamePage } from '../pages/GamePage.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { RoomPage } from '../pages/RoomPage.jsx';
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

function Shell({ socket }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [connectionState, setConnectionState] = useState('idle');
  const [notice, setNotice] = useState(null);
  const [chatEvent, setChatEvent] = useState(null);
  const { preferences } = useApp();

  useEffect(() => socket.subscribe(message => {
    if (message.type === 'client.status') setConnectionState(message.payload.status);
    else if (message.type === 'client.error' || message.type === 'game.error') {
      setErrorCode(message.payload.code);
      if (message.payload.code === 'ROOM_NOT_FOUND') navigate('/');
    } else if (message.type === 'server.notice') setNotice(message.payload.code);
    else if (message.type === 'quickChat.event') setChatEvent(message.payload);
    else if (message.type === 'room.state') {
      setErrorCode(null);
      setRoom({ ...message.payload, revision: message.revision });
      const code = message.payload.code;
      if (message.payload.phase === 'waiting') navigate(`/room/${code}`);
      else if (message.payload.phase === 'playing') navigate(`/game/${code}`);
      else if (message.payload.phase === 'results') navigate(`/results/${code}`);
    }
  }), [navigate, socket]);

  useEffect(() => {
    if (!chatEvent) return undefined;
    const timer = setTimeout(() => setChatEvent(null), 2_500);
    return () => clearTimeout(timer);
  }, [chatEvent]);

  return (
    <div className="app-shell">
      <header className="shell-header">
        <NavLink className="wordmark" to="/" aria-label="Project River 首页">
          <span aria-hidden="true">R</span>
          <strong>Project River</strong>
        </NavLink>
        <nav aria-label="主导航">
          <NavLink to="/tutorial">规则速学</NavLink>
          <NavLink to="/practice">练习桌</NavLink>
        </nav>
      </header>
      <Routes location={location}>
        <Route path="/" element={<HomePage socket={socket} errorCode={errorCode} />} />
        <Route path="/room/:code" element={<RoomPage room={room} socket={socket} connectionState={connectionState} notice={notice} />} />
        <Route path="/game/:code" element={room ? <GamePage room={room} socket={socket} muted={preferences.muted} chatEvent={chatEvent} /> : <Placeholder title="正在恢复牌局" description="等待服务器同步安全牌桌状态。" />} />
        <Route path="/tutorial" element={<Placeholder title="规则速学" description="用一局牌掌握关键动作。" />} />
        <Route path="/practice" element={<Placeholder title="练习桌" description="与五种风格的电脑玩家练习。" />} />
        <Route path="/results/:code" element={<Placeholder title="本局结果" description="回顾十手牌的关键数据。" />} />
        <Route path="*" element={<Placeholder title="找不到页面" description="返回首页重新开始。" />} />
      </Routes>
    </div>
  );
}

export default function App({ socket = socketClient }) {
  return <Shell socket={socket} />;
}
