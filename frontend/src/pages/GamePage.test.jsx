import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PlayerSeat } from '../components/poker/PlayerSeat.jsx';
import { GamePage } from './GamePage.jsx';

function gameRoomFixture(overrides = {}) {
  return {
    code: 'ABC234',
    handId: 'ABC234_m1_h2',
    revision: 12,
    phase: 'playing',
    hostPlayerId: 'hero',
    self: { playerId: 'hero', role: 'player' },
    seats: [
      { seat: 0, playerId: 'hero', kind: 'human', connected: true, controller: 'human', displayName: '河岸玩家', avatarId: 'river-fox' },
      { seat: 1, playerId: 'villain', kind: 'human', connected: false, controller: 'bot', displayName: '暂离朋友', avatarId: 'river-owl' },
      { seat: 2, playerId: 'bot-1', kind: 'bot', connected: true, controller: 'bot', displayName: '松果', avatarId: 'river-bear' },
      { seat: 3, playerId: null, kind: null },
      { seat: 4, playerId: null, kind: null },
      { seat: 5, playerId: null, kind: null },
    ],
    spectators: [],
    game: {
      phase: 'playing', handNumber: 2, street: 'flop', board: ['2c', '7d', 'Jh'],
      players: {
        hero: { id: 'hero', seat: 0, displayName: '河岸玩家', stack: 920, streetCommitment: 80, folded: false, allIn: false, holeCards: ['As', 'Ah'], lastAction: null },
        villain: { id: 'villain', seat: 1, displayName: '暂离朋友', stack: 900, streetCommitment: 80, folded: false, allIn: false, lastAction: null },
        'bot-1': { id: 'bot-1', seat: 2, displayName: '松果', stack: 880, streetCommitment: 80, folded: false, allIn: false, lastAction: null },
      },
      order: ['hero', 'villain', 'bot-1'], buttonId: 'villain', smallBlindId: 'bot-1', bigBlindId: 'hero',
      actorId: 'hero', currentBet: 80, pot: 240, legalActions: { fold: false, check: true, callAmount: null, bet: { minTo: 20, maxTo: 1_000 }, raise: null, allInTo: 1_000 },
      matchStatus: { handNumber: 2, complete: false }, lastHandResult: null,
    },
    actionDeadline: Date.now() + 15_000,
    ...overrides,
  };
}

function fakeSocket() {
  return { sent: [], nextActionId: () => 'action_test_0001', request(message) { this.sent.push(message); } };
}

function settledRoom({ reason = 'showdown', final = false, winners = ['hero'], mode = 'practice' } = {}) {
  const room = gameRoomFixture({ mode, handReviewUntil: mode === 'friends' ? Date.now() + 8_000 : null });
  room.game.phase = final ? 'results' : 'betweenHands';
  room.game.actorId = null;
  room.game.street = reason === 'showdown' ? 'showdown' : 'preflop';
  room.game.board = reason === 'showdown' ? ['2c', '7d', 'Jh', '4c', '9d'] : [];
  room.game.players.villain = { ...room.game.players.villain, revealed: reason === 'showdown', folded: reason === 'fold', ...(reason === 'showdown' ? { holeCards: ['Ks', 'Kh'] } : {}) };
  room.game.players['bot-1'].folded = true;
  room.game.lastHandResult = { reason, winnerIds: winners, pot: 240, hands: reason === 'showdown' ? {
    hero: { category: 1, label: 'One Pair' }, villain: { category: 1, label: 'One Pair' },
  } : {} };
  room.game.matchStatus.complete = final;
  return room;
}

describe('GamePage', () => {
  it('shows eligible showdown cards and bilingual hand types, with a winner marker and no folded cards', () => {
    render(<GamePage room={settledRoom()} socket={fakeSocket()} />);
    const result = within(screen.getByRole('region', { name: '本手结果' }));
    expect(result.getByLabelText('河岸玩家的摊牌')).toHaveTextContent('一对');
    expect(result.getByLabelText('暂离朋友的摊牌')).toHaveTextContent('One Pair');
    expect(result.getByLabelText('黑桃K')).toBeVisible();
    expect(result.getAllByLabelText('获胜 Winner')).toHaveLength(1);
    expect(result.queryByText('松果')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('牌局操作')).not.toBeInTheDocument();
  });

  it('marks every pot winner rather than forcing a single winner for tied or side-pot outcomes', () => {
    render(<GamePage room={settledRoom({ winners: ['hero', 'villain'] })} socket={fakeSocket()} />);
    expect(screen.getAllByLabelText('获胜 Winner')).toHaveLength(2);
  });

  it('keeps an uncontested win honest: no invented hand type or opponent card reveal', () => {
    render(<GamePage room={settledRoom({ reason: 'fold' })} socket={fakeSocket()} />);
    expect(screen.getByLabelText('获胜 Winner')).toBeVisible();
    expect(screen.getByText('未摊牌')).toBeVisible();
    expect(screen.queryByText('One Pair')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('黑桃K')).not.toBeInTheDocument();
  });

  it('continues a practice hand once using its hand ID and blocks continuing when disconnected', async () => {
    const socket = fakeSocket();
    const room = settledRoom();
    const { rerender } = render(<GamePage room={room} socket={socket} connectionState="reconnecting" />);
    expect(screen.getByRole('button', { name: '下一手 Next hand' })).toBeDisabled();
    rerender(<GamePage room={room} socket={socket} connectionState="connected" />);
    await userEvent.dblClick(screen.getByRole('button', { name: '下一手 Next hand' }));
    expect(socket.sent).toEqual([{ type: 'hand.continue', roomCode: room.code, handId: room.handId }]);
  });

  it('preserves the final hand before offering overall results, and cannot manually skip friend-room review', () => {
    const { rerender } = render(<GamePage room={settledRoom({ final: true })} socket={fakeSocket()} />);
    expect(screen.getByRole('region', { name: '本手结果' })).toBeVisible();
    expect(screen.getByRole('button', { name: '查看总排名 Results' })).toBeVisible();
    rerender(<GamePage room={settledRoom({ mode: 'friends' })} socket={fakeSocket()} />);
    expect(screen.queryByRole('button', { name: '下一手 Next hand' })).not.toBeInTheDocument();
    expect(screen.getByText(/秒后下一手/)).toBeVisible();
  });

  it('blocks actions and chat during reconnect, closes betting, then unlocks on a fresh same-revision snapshot', async () => {
    const socket = fakeSocket();
    const room = gameRoomFixture();
    const { rerender } = render(<GamePage room={room} socket={socket} />);
    await userEvent.click(screen.getByRole('button', { name: '下注 Bet' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    rerender(<GamePage room={room} socket={socket} connectionState="reconnecting" />);
    expect(screen.getByRole('status')).toHaveTextContent('正在重新连接');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '过牌 Check' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '快捷消息 你好' })).toBeDisabled();
    await userEvent.keyboard('c');
    expect(socket.sent).toEqual([]);
    rerender(<GamePage room={room} socket={socket} connectionState="syncing" />);
    expect(screen.getByRole('button', { name: '过牌 Check' })).toBeDisabled();
    rerender(<GamePage room={{ ...room }} socket={socket} connectionState="connected" />);
    await userEvent.click(screen.getByRole('button', { name: '过牌 Check' }));
    expect(socket.sent).toHaveLength(1);
    expect(screen.getByRole('button', { name: '过牌 Check' })).toBeDisabled();
    rerender(<GamePage room={{ ...room }} socket={socket} errorCode="STALE_REVISION" />);
    expect(screen.getByRole('button', { name: '过牌 Check' })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('牌局已更新');
  });

  it('handles a transport closing between render and click without leaving a pending action', async () => {
    const socket = { nextActionId: () => 'action_race_001', request() { throw new Error('SOCKET_NOT_CONNECTED'); } };
    const room = gameRoomFixture();
    const { rerender } = render(<GamePage room={room} socket={socket} />);
    await userEvent.click(screen.getByRole('button', { name: '过牌 Check' }));
    expect(screen.getByRole('status')).toHaveTextContent('正在重新连接');
    expect(screen.getByRole('button', { name: '过牌 Check' })).toBeDisabled();
    rerender(<GamePage room={{ ...room }} socket={fakeSocket()} />);
    expect(screen.getByRole('button', { name: '过牌 Check' })).toBeEnabled();
  });

  it('shows only the recipient cards and emits one server-shaped action', async () => {
    const socket = fakeSocket();
    render(<GamePage room={gameRoomFixture()} socket={socket} />);

    expect(screen.getByLabelText('你的手牌')).toHaveTextContent('A♠A♥');
    expect(screen.queryByText('K♠')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '过牌 Check' }));
    expect(socket.sent).toEqual([{
      type: 'game.action', roomCode: 'ABC234', handId: 'ABC234_m1_h2',
      actionId: 'action_test_0001', revision: 12, action: { type: 'check' },
    }]);
  });

  it('removes action controls for spectators and shows connection takeover state', () => {
    const room = gameRoomFixture({ self: { playerId: 'watcher', role: 'spectator' } });
    room.game.legalActions = null;
    render(<GamePage room={room} socket={fakeSocket()} />);

    expect(screen.queryByLabelText('牌局操作')).not.toBeInTheDocument();
    expect(screen.getByText('连接中断，电脑暂时代打')).toBeVisible();
    expect(screen.getByText('观战模式')).toBeVisible();
  });

  it('renders a hostile nickname as text', () => {
    const name = '<img src=x>河岸玩家-1234567890';
    render(<PlayerSeat player={{ id: 'x', displayName: name, stack: 1_000, streetCommitment: 0 }} seat={{ seat: 0, connected: true, controller: 'human' }} />);

    expect(screen.getByText(name)).toBeVisible();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('offers exactly twelve fixed quick-chat choices', () => {
    render(<GamePage room={gameRoomFixture()} socket={fakeSocket()} />);
    expect(screen.getAllByRole('button', { name: /^快捷消息/ })).toHaveLength(12);
  });
});
