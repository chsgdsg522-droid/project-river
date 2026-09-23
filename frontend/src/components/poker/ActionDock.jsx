import { useEffect, useState } from 'react';
import { Term } from '../common/Term.jsx';
import { RaiseSheet } from './RaiseSheet.jsx';

export function presetRaiseTo({ preset, pot, streetCommitment, callTo, minTo, maxTo }) {
  if (preset === 'allIn') return maxTo;
  const callAmount = Math.max(0, callTo - streetCommitment);
  const target = callTo + Math.round((pot + callAmount) * preset);
  return Math.max(minTo, Math.min(maxTo, target));
}

export function ActionDock({ legal, pot = 0, streetCommitment = 0, callTo = streetCommitment + (legal?.callAmount ?? 0), onAction, disabled = false }) {
  const [raiseOpen, setRaiseOpen] = useState(false);
  const amountAction = legal?.bet ? 'bet' : legal?.raise ? 'raise' : null;
  const limits = amountAction ? legal[amountAction] : null;

  useEffect(() => { if (disabled) setRaiseOpen(false); }, [disabled]);

  useEffect(() => {
    function keydown(event) {
      if (disabled || !legal || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target?.closest?.('[role="dialog"]') || target?.matches?.('input, textarea, select')) return;
      const key = event.key.toLowerCase();
      if (key === 'f' && legal.fold) onAction({ type: 'fold' });
      else if (key === 'c' && legal.check) onAction({ type: 'check' });
      else if (key === 'c' && legal.callAmount !== null) onAction({ type: 'call' });
      else if (key === 'r' && amountAction) setRaiseOpen(true);
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [amountAction, disabled, legal, onAction]);

  if (!legal) return null;
  return (
    <section className="action-dock" aria-label="牌局操作" data-testid="action-dock">
      <div className="action-dock__buttons">
        {legal.fold && <button type="button" disabled={disabled} onClick={() => onAction({ type: 'fold' })}><Term id="fold" /></button>}
        {legal.check
          ? <button type="button" disabled={disabled} onClick={() => onAction({ type: 'check' })}><Term id="check" /></button>
          : legal.callAmount !== null && <button type="button" disabled={disabled} aria-label={`跟注 Call ${legal.callAmount}`} onClick={() => onAction({ type: 'call' })}><Term id="call" /> <strong>{legal.callAmount}</strong></button>}
        {amountAction && <button type="button" disabled={disabled} onClick={() => setRaiseOpen(true)}><Term id={amountAction} /></button>}
      </div>
      {raiseOpen && limits && !disabled && (
        <RaiseSheet
          actionType={amountAction}
          pot={pot}
          streetCommitment={streetCommitment}
          callTo={callTo}
          minTo={limits.minTo}
          maxTo={limits.maxTo}
          presetRaiseTo={presetRaiseTo}
          onConfirm={action => { setRaiseOpen(false); onAction(action); }}
          onClose={() => setRaiseOpen(false)}
        />
      )}
    </section>
  );
}
