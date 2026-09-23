import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoomPage } from './RoomPage.jsx';

function waitingRoomFixture(overrides = {}) {
  return {
    code: 'ABC234',
    phase: 'waiting',
    hostPlayerId: 'host',
    self: { playerId: 'guest', role: 'player' },
    seats: [
      { seat: 0, playerId: 'host', kind: 'human', displayName: '房主', avatarId: 'river-fox', connected: true },
      { seat: 1, playerId: 'guest', kind: 'human', displayName: '朋友', avatarId: 'river-owl', connected: true },
      { seat: 2, playerId: 'bot-calm', kind: 'bot', personaId: 'calm', displayName: '稳健派', avatarId: 'river-bear', connected: true },
      { seat: 3, playerId: null, kind: null, displayName: null, avatarId: null, connected: false },
      { seat: 4, playerId: null, kind: null, displayName: null, avatarId: null, connected: false },
      { seat: 5, playerId: null, kind: null, displayName: null, avatarId: null, connected: false },
    ],
    spectators: [],
    ...overrides,
  };
}

function fakeSocket() {
  return { sent: [], request(message) { this.sent.push(message); } };
}

describe('RoomPage', () => {
  it('shows six seats and hides host actions from a guest', () => {
    render(<RoomPage room={waitingRoomFixture()} socket={fakeSocket()} />);

    expect(screen.getAllByTestId('room-seat')).toHaveLength(6);
    expect(screen.queryByRole('button', { name: '移除玩家' })).not.toBeInTheDocument();
  });

  it('shows spectator, reconnecting, restart, and kicked states', () => {
    const { rerender } = render(
      <RoomPage
        room={waitingRoomFixture({ self: { playerId: 'viewer', role: 'spectator' } })}
        socket={fakeSocket()}
        connectionState="reconnecting"
        notice="SERVER_RESTARTED"
      />,
    );
    expect(screen.getByText('房间已满，你正在观战')).toBeVisible();
    expect(screen.getByText('正在重新连接…')).toBeVisible();
    expect(screen.getByText('服务器已重启，请重新加入房间')).toBeVisible();

    rerender(<RoomPage room={waitingRoomFixture({ self: { playerId: 'gone', role: 'player' } })} socket={fakeSocket()} />);
    expect(screen.getByText('你已被移出房间')).toBeVisible();
  });

  it('copies with a fallback and waits for server state before removing a bot', async () => {
    const originalExecCommand = document.execCommand;
    document.execCommand = vi.fn(() => true);
    const socket = fakeSocket();
    const room = waitingRoomFixture({ self: { playerId: 'host', role: 'player' } });
    render(<RoomPage room={room} socket={socket} clipboard={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '复制房间码' }));
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    await user.click(screen.getByRole('button', { name: '移除电脑玩家 稳健派' }));
    expect(socket.sent).toContainEqual({ type: 'room.bot.remove', roomCode: 'ABC234', seat: 2 });
    expect(screen.getByText('稳健派')).toBeVisible();
    document.execCommand = originalExecCommand;
  });

  it('explains why a host cannot start with fewer than two participants', () => {
    const room = waitingRoomFixture({
      self: { playerId: 'host', role: 'player' },
      seats: [waitingRoomFixture().seats[0], ...Array.from({ length: 5 }, (_, index) => ({
        seat: index + 1, playerId: null, kind: null, displayName: null, avatarId: null, connected: false,
      }))],
    });
    render(<RoomPage room={room} socket={fakeSocket()} />);

    expect(screen.getByRole('button', { name: '开始牌局' })).toBeDisabled();
    expect(screen.getByText('至少需要两名参与者')).toBeVisible();
  });
});
