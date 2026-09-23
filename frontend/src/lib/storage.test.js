import { describe, expect, it } from 'vitest';
import {
  AVATAR_IDS,
  loadLocalState,
  recordMatch,
  savePreferences,
  saveProfile,
} from './storage.js';

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

describe('versioned local state', () => {
  it('falls back safely when local storage is corrupt', () => {
    const storage = fakeStorage({ 'river.state.v1': '{broken' });

    expect(loadLocalState(storage)).toEqual(expect.objectContaining({
      profile: null,
      statistics: { matches: 0, wins: 0, handsWon: 0, biggestPot: 0 },
    }));
  });

  it('validates and trims local profiles without storing session data', () => {
    const storage = fakeStorage();
    const profile = saveProfile({ nickname: '  河牌 Alice_7  ', avatarId: AVATAR_IDS[2] }, storage);

    expect(profile).toEqual({ nickname: '河牌 Alice_7', avatarId: AVATAR_IDS[2] });
    const serialized = storage.getItem('river.state.v1');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('roomCode');
    expect(() => saveProfile({ nickname: 'bad$name', avatarId: AVATAR_IDS[0] }, storage)).toThrow('INVALID_NICKNAME');
    expect(() => saveProfile({ nickname: '玩'.repeat(25), avatarId: AVATAR_IDS[0] }, storage)).toThrow('INVALID_NICKNAME');
  });

  it('persists only validated preferences and aggregate match totals', () => {
    const storage = fakeStorage();
    savePreferences({ theme: 'light', deck: 'fourColor', muted: true, reducedMotion: true }, storage);
    recordMatch({ won: true, roomCode: 'SECRET', hands: ['As', 'Kd'] }, storage);

    const state = loadLocalState(storage);
    expect(state.preferences).toEqual({ theme: 'light', deck: 'fourColor', muted: true, reducedMotion: true });
    expect(state.statistics).toEqual({ matches: 1, wins: 1, handsWon: 0, biggestPot: 0 });
    expect(JSON.stringify(state)).not.toContain('SECRET');
    expect(JSON.stringify(state)).not.toContain('As');
  });

  it('deduplicates the same match in the current session and stores only aggregates', () => {
    const storage = fakeStorage();
    const summary = { matchId: 'ABC234_m99', placement: 1, handsWon: 3, biggestPot: 620 };

    recordMatch(summary, storage);
    recordMatch(summary, storage);

    expect(loadLocalState(storage).statistics).toEqual({ matches: 1, wins: 1, handsWon: 3, biggestPot: 620 });
    expect(storage.getItem('river.state.v1')).not.toContain('ABC234_m99');
  });
});
