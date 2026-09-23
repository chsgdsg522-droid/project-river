import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/RoomManager.js';
import { projectRoom } from '../src/RoomView.js';

describe('practice rooms', () => {
  it('creates and starts one human with five bots on the authoritative engine', () => {
    const manager = new RoomManager({
      randomCode: () => 'ABC234',
      createPlayerId: () => 'learner',
      gameRandomInt: () => 0,
    });
    const { room, playerId } = manager.createPracticeRoom({ displayName: '练习生', avatarId: 'river-fox' });

    expect(room.mode).toBe('practice');
    expect(room.phase).toBe('playing');
    expect(room.seats.filter(seat => seat.kind === 'human')).toHaveLength(1);
    expect(room.seats.filter(seat => seat.kind === 'bot')).toHaveLength(5);
    expect(projectRoom(room, { playerId, role: 'player' })).toMatchObject({ mode: 'practice', self: { playerId } });
  });
});
