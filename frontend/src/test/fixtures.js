export const profileFixture = Object.freeze({ nickname: '河牌小林', avatarId: 'delta' });

export const preferencesFixture = Object.freeze({
  theme: 'dark',
  deck: 'fourColor',
  muted: false,
  reducedMotion: false,
});

export function roomFixture(overrides = {}) {
  return {
    code: 'RIVER7',
    phase: 'waiting',
    seats: [],
    spectators: [],
    ...overrides,
  };
}
