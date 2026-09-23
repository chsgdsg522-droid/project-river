import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../app/AppProviders.jsx';
import { SettingsPanel } from '../components/common/SettingsPanel.jsx';
import { AVATAR_IDS } from '../lib/storage.js';
import { parseRoomCode } from '../lib/socketClient.js';

const AVATAR_LABELS = Object.freeze({
  'river-fox': '赤狐',
  'river-owl': '夜枭',
  'river-bear': '岩熊',
  'river-cat': '山猫',
  'river-rabbit': '白兔',
  'river-dog': '牧犬',
});

const ERROR_MESSAGES = Object.freeze({
  ROOM_NOT_FOUND: '没有找到这个房间，请检查房间码',
  CONNECTION_FAILED: '暂时无法连接服务器，请稍后重试',
  INVALID_DISPLAY_NAME: '昵称格式不正确',
});

export function HomePage({ socket, errorCode = null }) {
  const navigate = useNavigate();
  const { profile, preferences, updateProfile, updatePreferences } = useApp();
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [avatarId, setAvatarId] = useState(profile?.avatarId ?? AVATAR_IDS[0]);
  const [roomInput, setRoomInput] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (errorCode) setPending(null);
  }, [errorCode]);

  function validatedProfile() {
    const next = { nickname, avatarId };
    updateProfile(next);
    return { displayName: next.nickname.trim(), avatarId: next.avatarId };
  }

  async function send(type, roomCode) {
    setError('');
    setPending(type);
    try {
      const safeProfile = validatedProfile();
      await socket.connect();
      socket.request({ type, ...(roomCode ? { roomCode } : {}), profile: safeProfile });
    } catch (cause) {
      setError(cause.message === 'INVALID_NICKNAME' ? '昵称应为 1-24 个中文、字母、数字、空格、下划线或连字符' : '暂时无法连接服务器，请稍后重试');
      setPending(null);
    }
  }

  function joinRoom() {
    const roomCode = parseRoomCode(roomInput);
    if (!roomCode) {
      setError('请输入有效的 6 位房间码');
      return;
    }
    send('room.join', roomCode);
  }

  return (
    <main className="home-page">
      <section className="home-intro">
        <p className="home-intro__label">十手牌的私人牌局</p>
        <h1>专注每一次决定。</h1>
        <p className="home-intro__body">创建一张只属于朋友的牌桌，或先与五位风格不同的电脑玩家练习。</p>
        <p className="play-money-notice">仅使用虚拟筹码，不支持充值、提现或现实奖励。</p>
      </section>

      <section className="home-controls" aria-labelledby="identity-title">
        <div className="identity-editor">
          <h2 id="identity-title">你的牌桌身份</h2>
          <label className="field">
            <span>昵称</span>
            <input
              value={nickname}
              onChange={event => setNickname(event.target.value)}
              maxLength={24}
              autoComplete="nickname"
              placeholder="例如：河岸玩家"
            />
          </label>
          <fieldset className="avatar-picker">
            <legend>选择头像</legend>
            <div>
              {AVATAR_IDS.map((id, index) => (
                <button
                  key={id}
                  type="button"
                  className={avatarId === id ? 'is-selected' : ''}
                  aria-pressed={avatarId === id}
                  aria-label={`头像 ${AVATAR_LABELS[id]}`}
                  onClick={() => setAvatarId(id)}
                >
                  <span aria-hidden="true">{index + 1}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="home-actions" aria-label="开始游戏">
          <div className="primary-entry">
            <button type="button" className="entry-action entry-action--primary" disabled={pending !== null} onClick={() => send('room.create')}>
              创建好友房
            </button>
            <small>生成邀请链接，最多六人</small>
          </div>
          <div className="join-action">
            <label className="field">
              <span>房间码或邀请链接</span>
              <input value={roomInput} onChange={event => setRoomInput(event.target.value)} placeholder="ABC234" />
            </label>
            <button type="button" className="entry-action" disabled={pending !== null} onClick={joinRoom}>加入房间</button>
          </div>
          <button type="button" className="entry-action" onClick={() => navigate('/practice')}>单人练习</button>
          <button type="button" className="entry-action" onClick={() => navigate('/tutorial')}>新手教程</button>
        </div>

        {(error || errorCode) && <p className="form-error" role="alert">{error || ERROR_MESSAGES[errorCode] || '操作没有完成，请重试'}</p>}
      </section>

      <aside className="home-settings">
        <SettingsPanel preferences={preferences} onChange={updatePreferences} />
      </aside>
    </main>
  );
}
