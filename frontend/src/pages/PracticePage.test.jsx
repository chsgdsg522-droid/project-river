import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PracticePage } from './PracticePage.jsx';
import { GamePage } from './GamePage.jsx';

function gameFixture(mode = 'practice') {
  return {
    code: 'ABC234', handId: 'ABC234_m1_h1', revision: 2, mode, phase: 'playing', actionDeadline: null,
    self: { playerId: 'hero', role: 'player' },
    seats: [
      { seat: 0, playerId: 'hero', kind: 'human', connected: true, controller: 'human', displayName: '练习生' },
      ...Array.from({ length: 5 }, (_, index) => ({ seat: index + 1, playerId: `bot-${index}`, kind: 'bot', connected: true, controller: 'bot', displayName: `电脑${index + 1}` })),
    ],
    game: {
      phase: 'playing', handNumber: 1, street: 'flop', board: ['2c', '7d', 'Jh'], pot: 240,
      players: {
        hero: { id: 'hero', seat: 0, displayName: '练习生', stack: 920, streetCommitment: 80, folded: false, allIn: false, holeCards: ['As', 'Ah'] },
        ...Object.fromEntries(Array.from({ length: 5 }, (_, index) => [`bot-${index}`, { id: `bot-${index}`, seat: index + 1, displayName: `电脑${index + 1}`, stack: 1_000, streetCommitment: 0, folded: false, allIn: false }])),
      },
      actorId: 'bot-0', currentBet: 120, legalActions: { fold: true, check: false, callAmount: 40, bet: null, raise: null, allInTo: 1_000 },
      matchStatus: { handNumber: 1, complete: false }, lastHandResult: null,
    },
  };
}

const socket = { request() {}, nextActionId: () => 'action_test_0001' };

describe('PracticePage', () => {
  it('never renders strategic advice in a friend game', () => {
    render(<GamePage room={gameFixture('friends')} socket={socket} />);
    expect(screen.queryByText(/胜率|底池赔率|建议/)).not.toBeInTheDocument();
  });

  it('offers optional learning aids only in practice', async () => {
    render(<PracticePage room={gameFixture()} socket={socket} />);
    const toggle = screen.getByRole('switch', { name: '显示学习辅助' });
    expect(toggle).toBeVisible();
    expect(screen.queryByText('练习估算')).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByText('练习估算')).toBeVisible();
    expect(screen.getByText(/底池赔率/)).toBeVisible();
  });
});
