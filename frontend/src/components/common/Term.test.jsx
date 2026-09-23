import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Term } from './Term.jsx';

describe('Term', () => {
  it('shows Chinese and international action terminology', () => {
    render(<Term id="raise" />);

    expect(screen.getByText('加注')).toBeVisible();
    expect(screen.getByText('Raise')).toBeVisible();
  });

  it('renders compact table-position terminology accessibly', () => {
    render(<Term id="bb" compact />);

    expect(screen.getByText('大盲')).toHaveAccessibleDescription('Big Blind / BB');
  });
});
