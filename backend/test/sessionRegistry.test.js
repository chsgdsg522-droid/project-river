import { describe, expect, it, vi } from 'vitest';
import { RoomManager } from '../src/RoomManager.js';
import { SessionRegistry } from '../src/SessionRegistry.js';

function socket() {
  return { close: vi.fn() };
}

describe('SessionRegistry', () => {
  it('issues an unguessable URL-safe token with at least 128 random bits', () => {
    const registry = new SessionRegistry();
    const token = registry.issue('hero');

    expect(token).toMatch(/^[a-zA-Z0-9_-]{22,}$/);
    expect(registry.playerForToken(token)).toBe('hero');
  });

  it('replaces the old socket when the same token attaches again', () => {
    const registry = new SessionRegistry();
    const token = registry.issue('hero');
    const oldSocket = socket();
    const newSocket = socket();
    registry.attach(token, oldSocket);

    const session = registry.attach(token, newSocket);

    expect(oldSocket.close).toHaveBeenCalledWith(4001, 'SESSION_REPLACED');
    expect(session).toMatchObject({ playerId: 'hero', connected: true, control: 'human' });
  });

  it('reserves human control before 30 seconds and permits one bot takeover at the boundary', () => {
    const registry = new SessionRegistry();
    const token = registry.issue('hero');
    const connection = socket();
    registry.attach(token, connection);
    registry.disconnect(connection, 1_000);

    expect(registry.takeOverExpired(30_999, 30_000, 'hand_1')).toEqual([]);
    expect(registry.takeOverExpired(31_000, 30_000, 'hand_1')).toEqual(['hero']);
    expect(registry.takeOverExpired(40_000, 30_000, 'hand_1')).toEqual([]);
    expect(registry.activeController('hero')).toBe('bot');
  });

  it('restores immediately before a new hand but waits after the bot starts it', () => {
    const registry = new SessionRegistry();
    const immediateToken = registry.issue('immediate');
    registry.forceBotControl(immediateToken, 'hand_1');
    expect(registry.claimControl(immediateToken, 40_000)).toMatchObject({ playerId: 'immediate', resumeAt: 'now' });
    expect(registry.activeController('immediate')).toBe('human');

    const boundaryToken = registry.issue('boundary');
    registry.forceBotControl(boundaryToken, 'hand_1');
    registry.noteBotStartedHand(boundaryToken, 'hand_2');
    expect(registry.claimControl(boundaryToken, 40_000)).toMatchObject({ playerId: 'boundary', resumeAt: 'nextHand' });
    expect(registry.activeController('boundary')).toBe('bot');
    registry.activatePendingAtBoundary(boundaryToken);
    expect(registry.activeController('boundary')).toBe('human');
  });

  it('transfers host and assigns one bot controller at the 30-second room boundary', () => {
    let now = 1_000;
    let id = 0;
    const manager = new RoomManager({
      now: () => now,
      randomCode: () => 'ABC234',
      createPlayerId: () => `player_${++id}`,
    });
    const { room, playerId: hostId } = manager.createRoom({ displayName: '房主', avatarId: 'river-fox' });
    const guest = manager.joinRoom(room.code, { displayName: '朋友', avatarId: 'river-owl' });
    manager.markDisconnected(room.code, hostId, now);

    now += 29_999;
    expect(manager.processDisconnectTimeouts(now)).toEqual([]);
    expect(room.hostPlayerId).toBe(hostId);
    now += 1;
    expect(manager.processDisconnectTimeouts(now)).toEqual([{ roomCode: room.code, playerId: hostId }]);
    expect(room.hostPlayerId).toBe(guest.playerId);
    expect(room.seats.find(seat => seat.playerId === hostId).controller).toBe('bot');
    expect(manager.processDisconnectTimeouts(now + 1)).toEqual([]);
  });
});
