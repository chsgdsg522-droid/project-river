import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionDock, presetRaiseTo } from './ActionDock.jsx';

function raiseFixture(overrides = {}) {
  return {
    fold: true,
    check: false,
    callAmount: 0,
    bet: null,
    raise: { minTo: 160, maxTo: 1_000 },
    allInTo: 1_000,
    ...overrides,
  };
}

describe('ActionDock', () => {
  it('labels and submits a total raise-to amount', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<ActionDock legal={raiseFixture()} pot={240} streetCommitment={80} callTo={80} onAction={onAction} />);

    await user.click(screen.getByRole('button', { name: '加注 Raise' }));
    await user.click(screen.getByRole('button', { name: '底池 Pot' }));
    expect(screen.getByText('加注至 Raise to 320')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '确认加注至 320' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'raise', raiseTo: 320 });
  });

  it('uses only actions supplied by the server', () => {
    render(<ActionDock legal={{ fold: true, check: false, callAmount: 80, bet: null, raise: null, allInTo: 80 }} onAction={() => {}} />);

    expect(screen.queryByRole('button', { name: /加注/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跟注 Call 80' })).toBeEnabled();
  });

  it('calculates presets from the pot after calling and clamps to server limits', () => {
    expect(presetRaiseTo({ preset: 0.5, pot: 240, streetCommitment: 40, callTo: 80, minTo: 160, maxTo: 1_000 })).toBe(220);
    expect(presetRaiseTo({ preset: 1, pot: 900, streetCommitment: 0, callTo: 100, minTo: 200, maxTo: 650 })).toBe(650);
    expect(presetRaiseTo({ preset: 'allIn', pot: 1, streetCommitment: 0, callTo: 0, minTo: 20, maxTo: 777 })).toBe(777);
  });
});
