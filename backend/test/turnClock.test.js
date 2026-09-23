import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TurnClock } from '../src/TurnClock.js';

describe('TurnClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it('expires at 15,000ms but not at 14,999ms', () => {
    const onExpire = vi.fn();
    const clock = new TurnClock({ now: () => Date.now() });
    clock.start({ roomCode: 'ABC234', handId: 'hand_1', actorId: 'a', deadline: 15_000, onExpire });

    vi.advanceTimersByTime(14_999);
    expect(onExpire).not.toHaveBeenCalled();
    expect(clock.remaining('ABC234', Date.now())).toBe(1);

    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(clock.remaining('ABC234', Date.now())).toBe(0);
  });

  it('ignores a stale timeout after the actor changes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const clock = new TurnClock({ now: () => Date.now() });
    clock.start({ roomCode: 'ABC234', handId: 'hand_1', actorId: 'a', deadline: 15_000, onExpire: first });
    clock.start({ roomCode: 'ABC234', handId: 'hand_1', actorId: 'b', deadline: 20_000, onExpire: second });

    vi.advanceTimersByTime(15_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancels a room timer without affecting another room', () => {
    const first = vi.fn();
    const second = vi.fn();
    const clock = new TurnClock({ now: () => Date.now() });
    clock.start({ roomCode: 'ABC234', handId: 'h1', actorId: 'a', deadline: 10, onExpire: first });
    clock.start({ roomCode: 'DEF567', handId: 'h2', actorId: 'b', deadline: 10, onExpire: second });
    clock.cancel('ABC234');

    vi.advanceTimersByTime(10);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
