export const STORAGE_KEY = 'river.state.v1';
export const AVATAR_IDS = Object.freeze([
  'river-fox',
  'river-owl',
  'river-bear',
  'river-cat',
  'river-rabbit',
  'river-dog',
]);

export const DEFAULT_PREFERENCES = Object.freeze({
  theme: 'dark',
  deck: 'fourColor',
  muted: false,
  reducedMotion: false,
});

const DEFAULT_STATISTICS = Object.freeze({ matches: 0, wins: 0, handsWon: 0, biggestPot: 0 });
const recordedMatchIds = new Set();
const NICKNAME_PATTERN = /^[\p{Script=Han}A-Za-z0-9 _-]+$/u;

function defaultState() {
  return {
    version: 1,
    profile: null,
    preferences: { ...DEFAULT_PREFERENCES },
    statistics: { ...DEFAULT_STATISTICS },
  };
}

function browserStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function normalizeNickname(value) {
  if (typeof value !== 'string') throw new Error('INVALID_NICKNAME');
  const nickname = value.trim();
  if (nickname.length === 0 || [...nickname].length > 24 || !NICKNAME_PATTERN.test(nickname)) {
    throw new Error('INVALID_NICKNAME');
  }
  return nickname;
}

function normalizeProfile(value) {
  if (!value || typeof value !== 'object') throw new Error('INVALID_PROFILE');
  if (!AVATAR_IDS.includes(value.avatarId)) throw new Error('INVALID_AVATAR');
  return { nickname: normalizeNickname(value.nickname), avatarId: value.avatarId };
}

function normalizePreferences(value = {}) {
  return {
    theme: value.theme === 'light' ? 'light' : 'dark',
    deck: value.deck === 'twoColor' ? 'twoColor' : 'fourColor',
    muted: value.muted === true,
    reducedMotion: value.reducedMotion === true,
  };
}

function normalizeStatistics(value = {}) {
  const matches = Number.isSafeInteger(value.matches) && value.matches >= 0 ? value.matches : 0;
  const wins = Number.isSafeInteger(value.wins) && value.wins >= 0 && value.wins <= matches ? value.wins : 0;
  const handsWon = Number.isSafeInteger(value.handsWon) && value.handsWon >= 0 ? value.handsWon : 0;
  const biggestPot = Number.isSafeInteger(value.biggestPot) && value.biggestPot >= 0 ? value.biggestPot : 0;
  return { matches, wins, handsWon, biggestPot };
}

function persist(storage, state) {
  storage?.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    profile: state.profile,
    preferences: state.preferences,
    statistics: state.statistics,
  }));
  return state;
}

export function loadLocalState(storage = browserStorage()) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || parsed.version !== 1) return defaultState();
    return {
      version: 1,
      profile: parsed.profile ? normalizeProfile(parsed.profile) : null,
      preferences: normalizePreferences(parsed.preferences),
      statistics: normalizeStatistics(parsed.statistics),
    };
  } catch {
    return defaultState();
  }
}

export function saveProfile(profile, storage = browserStorage()) {
  const normalized = normalizeProfile(profile);
  persist(storage, { ...loadLocalState(storage), profile: normalized });
  return normalized;
}

export function savePreferences(preferences, storage = browserStorage()) {
  const normalized = normalizePreferences(preferences);
  persist(storage, { ...loadLocalState(storage), preferences: normalized });
  return normalized;
}

export function recordMatch(summary, storage = browserStorage()) {
  const state = loadLocalState(storage);
  if (summary?.matchId && recordedMatchIds.has(summary.matchId)) return state.statistics;
  if (summary?.matchId) recordedMatchIds.add(summary.matchId);
  const statistics = {
    matches: state.statistics.matches + 1,
    wins: state.statistics.wins + (summary?.placement === 1 || summary?.won === true ? 1 : 0),
    handsWon: state.statistics.handsWon + (Number.isSafeInteger(summary?.handsWon) ? summary.handsWon : 0),
    biggestPot: Math.max(state.statistics.biggestPot, Number.isSafeInteger(summary?.biggestPot) ? summary.biggestPot : 0),
  };
  persist(storage, { ...state, statistics });
  return statistics;
}
