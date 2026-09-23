import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRoomStateEnvelope, projectRoom } from '../src/RoomView.js';

function gameSnapshot({ street = 'flop', folded = false } = {}) {
  return {
    phase: street === 'showdown' ? 'betweenHands' : 'playing',
    handNumber: 3,
    street,
    board: [{ rank: '2', suit: 'clubs' }, { rank: '7', suit: 'diamonds' }, { rank: 'J', suit: 'hearts' }],
    players: {
      hero: {
        id: 'hero', displayName: '英雄', avatarId: 'river-fox', seat: 0, stack: 940,
        streetCommitment: 60, folded: false, allIn: false, revealed: street === 'showdown',
        holeCards: [{ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'hearts' }],
      },
      villain: {
        id: 'villain', displayName: '对手', avatarId: 'river-owl', seat: 1, stack: 900,
        streetCommitment: 100, folded, allIn: false, revealed: street === 'showdown' && !folded,
        holeCards: [{ rank: 'K', suit: 'spades' }, { rank: 'K', suit: 'hearts' }],
      },
    },
    order: ['hero', 'villain'],
    handOrder: ['hero', 'villain'],
    buttonId: 'hero',
    smallBlindId: 'hero',
    bigBlindId: 'villain',
    smallBlind: 10,
    bigBlind: 20,
    actorId: 'hero',
    currentBet: 100,
    lastFullRaise: 40,
    pot: 160,
    lastHandResult: street === 'showdown' ? { reason: 'showdown', winnerIds: ['hero'], pot: 160, hands: { hero: { label: 'One Pair' }, villain: { label: 'One Pair' } } } : null,
    matchStatus: { handNumber: 3, complete: false, reason: null, rankings: null, summary: null },
  };
}

function room(options) {
  const snapshot = gameSnapshot(options);
  return {
    code: 'ABC234',
    phase: snapshot.phase,
    mode: 'friends',
    revision: 9,
    hostPlayerId: 'hero',
    seats: [
      { seat: 0, playerId: 'hero', kind: 'human' },
      { seat: 1, playerId: 'villain', kind: 'human' },
    ],
    spectators: [{ playerId: 'watcher', displayName: '观战者', avatarId: 'river-bear' }],
    game: {
      snapshot: () => snapshot,
      legalActionsFor: playerId => playerId === 'hero' ? { fold: true, check: false, callAmount: 40, bet: null, raise: null, allInTo: 1_000 } : null,
    },
  };
}

const player = playerId => ({ playerId, role: 'player' });
const spectator = () => ({ playerId: null, role: 'spectator' });

function sourceFiles(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('projectRoom', () => {
  it('projects different hole cards for owner, opponent, and spectator', () => {
    const heroView = projectRoom(room(), player('hero'));
    const spectatorView = projectRoom(room(), spectator());

    expect(heroView.game.players.hero.holeCards).toEqual(['As', 'Ah']);
    expect(heroView.game.players.villain.holeCards).toBeUndefined();
    expect(spectatorView.game.players.hero.holeCards).toBeUndefined();
    expect(JSON.stringify(heroView)).not.toContain('Ks');
    expect(JSON.stringify(heroView)).not.toContain('Kh');
  });

  it('reveals only showdown-eligible hands and never folded cards', () => {
    const view = projectRoom(room({ street: 'showdown', folded: true }), spectator());

    expect(view.game.players.hero.holeCards).toEqual(['As', 'Ah']);
    expect(view.game.players.villain.holeCards).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain('Ks');
    expect(view.game.lastHandResult).toEqual({ reason: 'showdown', winnerIds: ['hero'], pot: 160 });
  });

  it('includes legal actions only for the receiving player', () => {
    expect(projectRoom(room(), player('hero')).game.legalActions).toMatchObject({ callAmount: 40 });
    expect(projectRoom(room(), spectator()).game.legalActions).toBeNull();
  });

  it('exposes connection and bot-takeover state without changing seat ownership', () => {
    const disconnectedRoom = room();
    Object.assign(disconnectedRoom.seats[0], { connected: false, controller: 'bot' });

    expect(projectRoom(disconnectedRoom, player('hero')).seats[0]).toMatchObject({
      playerId: 'hero',
      kind: 'human',
      connected: false,
      controller: 'bot',
    });
  });

  it('returns an outbound envelope with the room revision', () => {
    const source = room();
    source.handId = 'ABC234_m1_h3';
    expect(createRoomStateEnvelope(source, player('hero'))).toMatchObject({
      type: 'room.state',
      revision: 9,
      payload: { code: 'ABC234', handId: 'ABC234_m1_h3' },
    });
  });

  it('keeps unrestricted snapshots and card-bearing logs out of server source', () => {
    const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));
    const paths = sourceFiles(sourceRoot);
    const contents = paths.map(path => readFileSync(path, 'utf8')).join('\n');

    expect(contents).not.toMatch(/socket\.send\s*\(\s*JSON\.stringify\s*\(\s*game\.snapshot\s*\(/);
    expect(contents).not.toMatch(/console\.log\([^\n]*holeCards/);
    expect(paths.some(path => path.endsWith('dealerMessages.js'))).toBe(false);
  });
});
