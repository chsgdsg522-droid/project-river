import { describe, expect, it } from 'vitest';
import { AVATAR_IDS, parseClientMessage, ProtocolError } from '../src/protocol.js';

const profile = { displayName: '河岸玩家-7', avatarId: 'river-fox' };

describe('parseClientMessage', () => {
  it('rejects an unknown message without reflecting attacker-controlled fields', () => {
    let error;
    try {
      parseClientMessage(JSON.stringify({ type: 'admin.win', cards: ['As'] }));
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ProtocolError);
    expect(error.code).toBe('UNSUPPORTED_MESSAGE');
    expect(error.message).not.toContain('As');
  });

  it('parses a strict raise-to action', () => {
    const message = {
      type: 'game.action',
      roomCode: 'ABC234',
      handId: 'hand_0001',
      actionId: 'click_0001',
      revision: 12,
      action: { type: 'raise', raiseTo: 320 },
    };

    expect(parseClientMessage(JSON.stringify(message))).toEqual(message);
  });

  it.each([
    ['malformed JSON', '{', 'MALFORMED_JSON'],
    ['oversized payload', JSON.stringify({ type: 'x', value: 'x'.repeat(8_200) }), 'PAYLOAD_TOO_LARGE'],
    ['ambiguous room code', JSON.stringify({ type: 'room.join', roomCode: 'ABCI23', profile }), 'INVALID_ROOM_CODE'],
    ['short action ID', JSON.stringify({ type: 'game.action', roomCode: 'ABC234', handId: 'hand_1', actionId: 'short', revision: 1, action: { type: 'call' } }), 'INVALID_ACTION_ID'],
    ['decimal raise', JSON.stringify({ type: 'game.action', roomCode: 'ABC234', handId: 'hand_1', actionId: 'click_0001', revision: 1, action: { type: 'raise', raiseTo: 30.5 } }), 'INVALID_RAISE_TO'],
    ['unknown action field', JSON.stringify({ type: 'game.action', roomCode: 'ABC234', handId: 'hand_1', actionId: 'click_0001', revision: 1, action: { type: 'call', cards: ['As'] } }), 'UNKNOWN_FIELD'],
    ['unknown top-level field', JSON.stringify({ type: 'room.start', roomCode: 'ABC234', admin: true }), 'UNKNOWN_FIELD'],
  ])('rejects %s', (_name, raw, code) => {
    expect(() => parseClientMessage(raw)).toThrowError(expect.objectContaining({ code }));
  });

  it.each([
    ['', 'river-fox'],
    ['a'.repeat(25), 'river-fox'],
    ['玩家<script>', 'river-fox'],
    ['玩家', 'remote-image'],
  ])('rejects unsafe profile values', (displayName, avatarId) => {
    const raw = JSON.stringify({ type: 'room.create', profile: { displayName, avatarId } });
    expect(() => parseClientMessage(raw)).toThrow(ProtocolError);
  });

  it('accepts the complete avatar allowlist and trims a valid nickname', () => {
    for (const avatarId of AVATAR_IDS) {
      const parsed = parseClientMessage(JSON.stringify({
        type: 'room.create',
        profile: { displayName: '  河岸 Player_7  ', avatarId },
      }));
      expect(parsed.profile).toEqual({ displayName: '河岸 Player_7', avatarId });
    }
  });
});
