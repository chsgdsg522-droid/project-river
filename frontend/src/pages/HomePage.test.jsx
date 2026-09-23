import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../app/AppProviders.jsx';
import { HomePage } from './HomePage.jsx';
import { parseRoomCode } from '../lib/socketClient.js';

function fakeSocket() {
  return {
    sent: [],
    connect: vi.fn().mockResolvedValue(undefined),
    request(message) { this.sent.push(message); },
  };
}

function renderHome(socket = fakeSocket()) {
  const storage = { getItem: () => null, setItem: vi.fn() };
  render(
    <MemoryRouter>
      <AppProviders storage={storage}>
        <HomePage socket={socket} />
      </AppProviders>
    </MemoryRouter>,
  );
  return socket;
}

describe('HomePage', () => {
  it('creates a room after choosing a valid local identity', async () => {
    const socket = renderHome();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('昵称'), '河岸玩家');
    await user.click(screen.getByRole('button', { name: '创建好友房' }));

    expect(socket.sent).toContainEqual({
      type: 'room.create',
      profile: { displayName: '河岸玩家', avatarId: 'river-fox' },
    });
  });

  it('shows the approved four entries in order and the play-money boundary', () => {
    renderHome();
    const labels = screen.getAllByRole('button').map(button => button.textContent.trim());
    expect(labels.slice(-4)).toEqual(['创建好友房', '加入房间', '单人练习', '新手教程']);
    expect(screen.getByText('仅使用虚拟筹码，不支持充值、提现或现实奖励。')).toBeVisible();
  });

  it('normalizes codes and rejects an invalid invitation before sending', async () => {
    expect(parseRoomCode('https://river.example/room/abc234')).toBe('ABC234');
    expect(parseRoomCode('io10zz')).toBeNull();
    const socket = renderHome();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('昵称'), '小河');
    await user.type(screen.getByLabelText('房间码或邀请链接'), 'not-a-room');
    await user.click(screen.getByRole('button', { name: '加入房间' }));

    expect(screen.getByText('请输入有效的 6 位房间码')).toBeVisible();
    expect(socket.sent).toEqual([]);
  });
});
