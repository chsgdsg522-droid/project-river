import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';

describe('Project River home', () => {
  it('states the play-money boundary before a player creates a room', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('仅使用虚拟筹码，不支持充值、提现或现实奖励。'),
    ).toBeInTheDocument();
  });
});
