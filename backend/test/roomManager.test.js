import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/RoomManager.js';

const profile = displayName => ({ displayName, avatarId: 'river-fox' });

function managerAt(start = 1_000) {
  let now = start;
  let id = 0;
  const codes = ['ABC234', 'ABC234', 'DEF567', 'GHJ789'];
  return {
    manager: new RoomManager({
      now: () => now,
      randomCode: () => codes.shift() ?? 'KLM234',
      createPlayerId: () => `player_${++id}`,
    }),
    advance: milliseconds => { now += milliseconds; },
    now: () => now,
  };
}

describe('RoomManager', () => {
  it('creates a six-seat room with one human and five distinct bots', () => {
    const { manager } = managerAt();
    const { room, playerId } = manager.createRoom(profile('房主'));

    expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(room.hostPlayerId).toBe(playerId);
    expect(room.seats).toHaveLength(6);
    expect(room.seats.filter(seat => seat.kind === 'human')).toHaveLength(1);
    expect(new Set(room.seats.filter(seat => seat.kind === 'bot').map(seat => seat.personaId)).size).toBe(5);
  });

  it('retries a colliding room code', () => {
    const { manager } = managerAt();
    expect(manager.createRoom(profile('一号')).room.code).toBe('ABC234');
    expect(manager.createRoom(profile('二号')).room.code).toBe('DEF567');
  });

  it('replaces the highest-numbered bot when a human joins a waiting room', () => {
    const { manager } = managerAt();
    const { room } = manager.createRoom(profile('房主'));
    const joined = manager.joinRoom(room.code, profile('朋友'));

    expect(joined).toMatchObject({ role: 'player', seat: 5 });
    expect(room.seats[5]).toMatchObject({ kind: 'human', playerId: joined.playerId });
    expect(room.seats.filter(seat => seat.kind === 'bot')).toHaveLength(4);
  });

  it('requires at least one human and two total participants to start', () => {
    const { manager } = managerAt();
    const first = manager.createRoom(profile('房主'));
    for (let seat = 5; seat >= 2; seat -= 1) manager.removeBot(first.room.code, first.playerId, seat);
    expect(() => manager.startRoom(first.room.code, first.playerId)).not.toThrow();

    const second = manager.createRoom(profile('独自一人'));
    for (let seat = 5; seat >= 1; seat -= 1) manager.removeBot(second.room.code, second.playerId, seat);
    expect(() => manager.startRoom(second.room.code, second.playerId)).toThrow('NOT_ENOUGH_PLAYERS');
  });

  it('puts mid-match joins into spectator state until rematch', () => {
    const { manager } = managerAt();
    const { room, playerId } = manager.createRoom(profile('房主'));
    manager.startRoom(room.code, playerId);

    const joined = manager.joinRoom(room.code, profile('迟到玩家'));
    expect(joined.role).toBe('spectator');
    expect(room.spectators.map(value => value.playerId)).toContain(joined.playerId);
  });

  it('sends a seventh waiting-room human to spectating', () => {
    const { manager } = managerAt();
    const { room } = manager.createRoom(profile('房主'));
    for (let number = 2; number <= 6; number += 1) {
      expect(manager.joinRoom(room.code, profile(`玩家${number}`)).role).toBe('player');
    }
    expect(manager.joinRoom(room.code, profile('第七人')).role).toBe('spectator');
  });

  it('allows only the host to control seats and never kick themselves', () => {
    const { manager } = managerAt();
    const { room, playerId: hostId } = manager.createRoom(profile('房主'));
    const guest = manager.joinRoom(room.code, profile('朋友'));

    expect(() => manager.removeBot(room.code, guest.playerId, 4)).toThrow('HOST_ONLY');
    expect(() => manager.kick(room.code, hostId, hostId)).toThrow('CANNOT_KICK_HOST');
    expect(manager.kick(room.code, hostId, guest.playerId)).toMatchObject({ playerId: guest.playerId });
  });

  it('retains a room before 30 idle minutes and expires it at the boundary', () => {
    const clock = managerAt();
    const { room, playerId } = clock.manager.createRoom(profile('房主'));
    clock.manager.markDisconnected(room.code, playerId, clock.now());

    clock.advance(30 * 60_000 - 1);
    expect(clock.manager.expireIdleRooms(clock.now())).toEqual([]);
    expect(clock.manager.getRoom(room.code)).toBe(room);

    clock.advance(1);
    expect(clock.manager.expireIdleRooms(clock.now())).toEqual([room.code]);
    expect(clock.manager.getRoom(room.code)).toBeNull();
  });

  it('selects the earliest joined connected human as the next host', () => {
    const clock = managerAt();
    const { room, playerId: hostId } = clock.manager.createRoom(profile('房主'));
    clock.advance(10);
    const firstGuest = clock.manager.joinRoom(room.code, profile('先加入'));
    clock.advance(10);
    const secondGuest = clock.manager.joinRoom(room.code, profile('后加入'));
    clock.manager.markDisconnected(room.code, hostId, clock.now());

    expect(clock.manager.selectNextHost(room)).toBe(firstGuest.playerId);
    clock.manager.markDisconnected(room.code, firstGuest.playerId, clock.now());
    expect(clock.manager.selectNextHost(room)).toBe(secondGuest.playerId);
  });
});
