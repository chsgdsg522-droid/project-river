import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { SettingsPanel } from '../components/common/SettingsPanel.jsx';
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

function Home() {
  const { preferences, updatePreferences } = useApp();
  return (
    <main className="shell-main shell-main--home">
      <section className="foundation-intro">
        <p className="foundation-intro__label">十手牌的私人牌局</p>
        <h1>专注每一次决定。</h1>
        <p>Project River 为朋友局和单人练习提供清晰、克制的德州扑克体验。</p>
        <p className="play-money-notice">仅使用虚拟筹码，不支持充值、提现或现实奖励。</p>
      </section>
      <SettingsPanel preferences={preferences} onChange={updatePreferences} />
    </main>
  );
}

function Shell() {
  const location = useLocation();
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
        <Route path="/" element={<Home />} />
        <Route path="/room/:code" element={<Placeholder title="等待入座" description="牌桌准备中。" />} />
        <Route path="/game/:code" element={<Placeholder title="牌局进行中" description="牌桌界面准备中。" />} />
        <Route path="/tutorial" element={<Placeholder title="规则速学" description="用一局牌掌握关键动作。" />} />
        <Route path="/practice" element={<Placeholder title="练习桌" description="与五种风格的电脑玩家练习。" />} />
        <Route path="/results/:code" element={<Placeholder title="本局结果" description="回顾十手牌的关键数据。" />} />
        <Route path="*" element={<Placeholder title="找不到页面" description="返回首页重新开始。" />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return <Shell />;
}
