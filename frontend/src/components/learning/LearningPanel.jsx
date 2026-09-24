import { useEffect, useState } from 'react';
import { estimateVisibleEquity } from './equityWorker.js';

export function LearningPanel({ id, mode, holeCards = [], board = [], pot = 0, callAmount = 0 }) {
  const [equity, setEquity] = useState(null);

  useEffect(() => {
    if (mode !== 'practice') return undefined;
    if (typeof Worker === 'undefined') {
      setEquity(estimateVisibleEquity({ holeCards, board }));
      return undefined;
    }
    const worker = new Worker(new URL('./equityWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = event => setEquity(event.data.equity);
    worker.postMessage({ holeCards, board });
    return () => worker.terminate();
  }, [board, holeCards, mode]);

  if (mode !== 'practice') return null;
  const potOdds = callAmount > 0 ? Math.round((callAmount / (pot + callAmount)) * 100) : 0;
  return (
    <aside id={id} className="learning-panel" aria-label="练习估算">
      <div><span>练习估算</span><strong>{equity === null ? '计算中' : `${equity}%`}</strong></div>
      <div><span>底池赔率 <small lang="en">Pot odds</small></span><strong>{potOdds}%</strong></div>
      <p>仅根据当前可见牌做教学估算，不代表最佳行动。</p>
    </aside>
  );
}
