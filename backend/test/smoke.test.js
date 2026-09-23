import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../src/config.js';

describe('Project River defaults', () => {
  it('drives a six-seat ten-hand match with the agreed stack and timer', () => {
    expect(DEFAULT_RULES).toMatchObject({
      seats: 6,
      startingChips: 1000,
      maxHands: 10,
      actionMs: 15_000,
    });
  });
});
