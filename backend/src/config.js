export const DEFAULT_RULES = Object.freeze({
  seats: 6,
  startingChips: 1_000,
  maxHands: 10,
  actionMs: 15_000,
  reconnectMs: 30_000,
  roomIdleMs: 30 * 60_000,
});

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_ROOM_CODE_ATTEMPTS = 100;
