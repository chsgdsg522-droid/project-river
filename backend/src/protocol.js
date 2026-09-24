const MAX_PAYLOAD_BYTES = 8 * 1024;
const ROOM_CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const SAFE_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const ACTION_ID = /^[a-zA-Z0-9_-]{8,64}$/;
const TOKEN = /^[a-zA-Z0-9_-]{20,256}$/;
const DISPLAY_NAME = /^[\p{L}\p{N}\p{Script=Han} _-]+$/u;

export const AVATAR_IDS = Object.freeze([
  'river-fox',
  'river-owl',
  'river-bear',
  'river-cat',
  'river-rabbit',
  'river-dog',
]);

export const QUICK_CHAT_IDS = Object.freeze([
  'hello',
  'nice-hand',
  'good-luck',
  'thinking',
  'wow',
  'oops',
  'thanks',
  'well-played',
  'laugh',
  'clap',
  'fire',
  'wave',
]);

export class ProtocolError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProtocolError';
    this.code = code;
  }
}

function assertObject(value, code = 'INVALID_MESSAGE') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProtocolError(code);
}

function assertOnlyKeys(value, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new ProtocolError('UNKNOWN_FIELD');
  }
}

function parseProfile(value) {
  assertObject(value, 'INVALID_PROFILE');
  assertOnlyKeys(value, ['displayName', 'avatarId']);
  const displayName = typeof value.displayName === 'string' ? value.displayName.trim() : '';
  if ([...displayName].length < 1 || [...displayName].length > 24 || !DISPLAY_NAME.test(displayName)) {
    throw new ProtocolError('INVALID_DISPLAY_NAME');
  }
  if (!AVATAR_IDS.includes(value.avatarId)) throw new ProtocolError('INVALID_AVATAR');
  return { displayName, avatarId: value.avatarId };
}

function assertRoomCode(roomCode) {
  if (typeof roomCode !== 'string' || !ROOM_CODE.test(roomCode)) throw new ProtocolError('INVALID_ROOM_CODE');
}

function assertSafeId(value, code) {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) throw new ProtocolError(code);
}

function parseAction(action) {
  assertObject(action, 'INVALID_ACTION');
  const amountActions = ['bet', 'raise'];
  const simpleActions = ['fold', 'check', 'call', 'allIn'];
  if (![...amountActions, ...simpleActions].includes(action.type)) throw new ProtocolError('INVALID_ACTION');
  assertOnlyKeys(action, amountActions.includes(action.type) ? ['type', 'raiseTo'] : ['type']);
  if (amountActions.includes(action.type)) {
    if (!Number.isSafeInteger(action.raiseTo) || action.raiseTo < 0) throw new ProtocolError('INVALID_RAISE_TO');
    return { type: action.type, raiseTo: action.raiseTo };
  }
  return { type: action.type };
}

function parseByType(message) {
  switch (message.type) {
    case 'room.create':
    case 'practice.create':
      assertOnlyKeys(message, ['type', 'profile']);
      return { type: message.type, profile: parseProfile(message.profile) };
    case 'room.join':
      assertOnlyKeys(message, ['type', 'roomCode', 'profile']);
      assertRoomCode(message.roomCode);
      return { type: message.type, roomCode: message.roomCode, profile: parseProfile(message.profile) };
    case 'room.start':
    case 'match.rematch':
      assertOnlyKeys(message, ['type', 'roomCode']);
      assertRoomCode(message.roomCode);
      return { type: message.type, roomCode: message.roomCode };
    case 'room.kick':
      assertOnlyKeys(message, ['type', 'roomCode', 'targetPlayerId']);
      assertRoomCode(message.roomCode);
      assertSafeId(message.targetPlayerId, 'INVALID_PLAYER_ID');
      return { type: message.type, roomCode: message.roomCode, targetPlayerId: message.targetPlayerId };
    case 'room.bot.add':
      assertOnlyKeys(message, ['type', 'roomCode', 'personaId']);
      assertRoomCode(message.roomCode);
      assertSafeId(message.personaId, 'INVALID_PERSONA_ID');
      return { type: message.type, roomCode: message.roomCode, personaId: message.personaId };
    case 'room.bot.remove':
      assertOnlyKeys(message, ['type', 'roomCode', 'seat']);
      assertRoomCode(message.roomCode);
      if (!Number.isSafeInteger(message.seat) || message.seat < 0 || message.seat > 5) throw new ProtocolError('INVALID_SEAT');
      return { type: message.type, roomCode: message.roomCode, seat: message.seat };
    case 'hand.continue':
      assertOnlyKeys(message, ['type', 'roomCode', 'handId']);
      assertRoomCode(message.roomCode);
      assertSafeId(message.handId, 'INVALID_HAND_ID');
      return { type: message.type, roomCode: message.roomCode, handId: message.handId };
    case 'game.action':
      assertOnlyKeys(message, ['type', 'roomCode', 'handId', 'actionId', 'revision', 'action']);
      assertRoomCode(message.roomCode);
      assertSafeId(message.handId, 'INVALID_HAND_ID');
      if (typeof message.actionId !== 'string' || !ACTION_ID.test(message.actionId)) throw new ProtocolError('INVALID_ACTION_ID');
      if (!Number.isSafeInteger(message.revision) || message.revision < 0) throw new ProtocolError('INVALID_REVISION');
      return {
        type: message.type,
        roomCode: message.roomCode,
        handId: message.handId,
        actionId: message.actionId,
        revision: message.revision,
        action: parseAction(message.action),
      };
    case 'quickChat.send':
      assertOnlyKeys(message, ['type', 'roomCode', 'messageId']);
      assertRoomCode(message.roomCode);
      if (!QUICK_CHAT_IDS.includes(message.messageId)) throw new ProtocolError('INVALID_QUICK_CHAT');
      return { type: message.type, roomCode: message.roomCode, messageId: message.messageId };
    case 'session.resume':
      assertOnlyKeys(message, ['type', 'token']);
      if (typeof message.token !== 'string' || !TOKEN.test(message.token)) throw new ProtocolError('INVALID_SESSION_TOKEN');
      return { type: message.type, token: message.token };
    default:
      throw new ProtocolError('UNSUPPORTED_MESSAGE');
  }
}

export function parseClientMessage(raw) {
  const bytes = Buffer.isBuffer(raw) ? raw.byteLength : Buffer.byteLength(String(raw), 'utf8');
  if (bytes > MAX_PAYLOAD_BYTES) throw new ProtocolError('PAYLOAD_TOO_LARGE');

  let message;
  try {
    message = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
  } catch {
    throw new ProtocolError('MALFORMED_JSON');
  }
  assertObject(message);
  if (typeof message.type !== 'string') throw new ProtocolError('MISSING_MESSAGE_TYPE');
  return parseByType(message);
}

export function createEnvelope(type, revision, payload) {
  return { type, revision, payload };
}
