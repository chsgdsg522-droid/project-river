import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TutorialPage } from './TutorialPage.jsx';

describe('TutorialPage', () => {
  it('provides six local interactive steps and can be skipped', async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<TutorialPage onFinish={onFinish} />);

    expect(screen.getByText('第 1 / 6 步')).toBeVisible();
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '查看你的两张底牌' }));
    expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '跳过教程' }));
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
