import { useState } from 'react';
import { Card } from '../components/poker/Card.jsx';
import { Term } from '../components/common/Term.jsx';

const STEPS = Object.freeze([
  { title: '先认识你的牌', body: '每位玩家有两张只有自己能看的底牌，桌面最多出现五张公共牌。', action: '查看你的两张底牌', visual: 'cards' },
  { title: '选出最好的五张', body: '从七张可用牌里组合出最强的五张。对子、两对、三条、顺子、同花依次变强。', action: '比较五张成牌', terms: ['showdown'] },
  { title: '认准行动位置', body: '庄家标记每手移动，小盲与大盲先投入筹码；翻牌后从庄家左侧开始行动。', action: '标记庄家与盲注', terms: ['dealer', 'sb', 'bb'] },
  { title: '只需掌握六个动作', body: '过牌不加筹码，跟注补齐，下注或加注提高门槛；不继续就弃牌。', action: '展开行动词汇', terms: ['fold', 'check', 'call', 'bet', 'raise', 'allIn'] },
  { title: '一手牌有四条街', body: '翻牌前之后依次是翻牌、转牌与河牌，仍有两人时可能进入摊牌。', action: '走过四条街', terms: ['preflop', 'flop', 'turn', 'river'] },
  { title: '看懂底池与 Raise to', body: '底池是本手累计筹码；Raise to 表示加注后的总投入，不是额外再加多少。', action: '试算一次加注', terms: ['pot', 'raise'] },
]);

export function TutorialPage({ onFinish }) {
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState(() => new Set());
  const step = STEPS[index];
  const interacted = completed.has(index);

  function interact() {
    setCompleted(current => new Set([...current, index]));
  }

  function next() {
    if (index === STEPS.length - 1) onFinish?.();
    else setIndex(value => value + 1);
  }

  return (
    <main className="learning-page tutorial-page">
      <header className="learning-heading">
        <p>约 3 分钟 · 本地完成</p>
        <h1>第一次坐上牌桌</h1>
        <button type="button" className="text-button" onClick={onFinish}>跳过教程</button>
      </header>
      <section className="tutorial-card" aria-live="polite">
        <span className="step-counter">第 {index + 1} / {STEPS.length} 步</span>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        {interacted && step.visual === 'cards' && <div className="tutorial-cards"><Card code="As" /><Card code="Kh" /></div>}
        {interacted && step.terms && <div className="tutorial-terms">{step.terms.map(id => <Term key={id} id={id} />)}</div>}
        <button type="button" className="tutorial-interaction" onClick={interact} aria-pressed={interacted}>{interacted ? '已完成' : step.action}</button>
      </section>
      <footer className="tutorial-footer">
        <button type="button" className="secondary-button" disabled={index === 0} onClick={() => setIndex(value => value - 1)}>上一步</button>
        <button type="button" className="primary-button" disabled={!interacted} onClick={next}>{index === STEPS.length - 1 ? '开始练习' : '下一步'}</button>
      </footer>
    </main>
  );
}
