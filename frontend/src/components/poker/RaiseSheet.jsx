import { useState } from 'react';

const PRESETS = Object.freeze([
  [0.5, '½底池 ½ Pot'],
  [0.75, '¾底池 ¾ Pot'],
  [1, '底池 Pot'],
  ['allIn', '全下 All-in'],
]);

export function RaiseSheet({ actionType, pot, streetCommitment, callTo, minTo, maxTo, presetRaiseTo, onConfirm, onClose }) {
  const [raiseTo, setRaiseTo] = useState(minTo);
  const title = actionType === 'bet' ? '下注至 Bet to' : '加注至 Raise to';
  return (
    <section className="raise-sheet" role="dialog" aria-label={actionType === 'bet' ? '下注金额' : '加注金额'}>
      <div className="raise-sheet__heading">
        <output>{title} {raiseTo}</output>
        <button type="button" onClick={onClose}>关闭</button>
      </div>
      <div className="raise-presets">
        {PRESETS.map(([preset, label]) => (
          <button key={preset} type="button" onClick={() => setRaiseTo(presetRaiseTo({ preset, pot, streetCommitment, callTo, minTo, maxTo }))}>{label}</button>
        ))}
      </div>
      <label className="raise-range">
        <span>总投入筹码 Total commitment</span>
        <input type="range" min={minTo} max={maxTo} step="1" value={raiseTo} onChange={event => setRaiseTo(Number(event.target.value))} />
      </label>
      <button type="button" className="raise-confirm" aria-label={`确认${actionType === 'bet' ? '下注' : '加注'}至 ${raiseTo}`} onClick={() => onConfirm({ type: actionType, raiseTo })}>确认 {raiseTo}</button>
    </section>
  );
}
