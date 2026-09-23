import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResultsPage } from './ResultsPage.jsx';

function summaryFixture() {
  return {
    matchId: 'ABC234_m1',
    handsPlayed: 10,
    largestPot: 620,
    players: [
      { playerId: 'a', displayName: '小河', rank: 1, chips: 1_500, handsWon: 3, biggestPot: 620, biggestRise: 700 },
      { playerId: 'b', displayName: '松果', rank: 1, chips: 1_500, handsWon: 2, biggestPot: 400, biggestRise: 500 },
      { playerId: 'c', displayName: '岩叔', rank: 3, chips: 0, handsWon: 1, biggestPot: 200, biggestRise: 80 },
    ],
  };
}

describe('ResultsPage', () => {
  it('renders tied ranks, records once, and keeps hand history out', () => {
    const onRecord = vi.fn();
    const { rerender } = render(<ResultsPage summary={summaryFixture()} selfId="a" isHost onRecord={onRecord} onRematch={() => {}} />);
    expect(screen.getAllByText('并列第 1 名')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /回放|牌谱|历史/ })).not.toBeInTheDocument();
    rerender(<ResultsPage summary={summaryFixture()} selfId="a" isHost onRecord={onRecord} onRematch={() => {}} />);
    expect(onRecord).toHaveBeenCalledOnce();
  });

  it('shows rematch only to the host', () => {
    const { rerender } = render(<ResultsPage summary={summaryFixture()} selfId="b" isHost={false} onRecord={() => {}} />);
    expect(screen.getByText('等待房主发起下一局')).toBeVisible();
    expect(screen.queryByRole('button', { name: '再来一局' })).not.toBeInTheDocument();
    rerender(<ResultsPage summary={summaryFixture()} selfId="a" isHost onRecord={() => {}} onRematch={() => {}} />);
    expect(screen.getByRole('button', { name: '再来一局' })).toBeVisible();
  });
});
