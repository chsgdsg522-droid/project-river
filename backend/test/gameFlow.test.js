import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/Game.js';

function players(ids, stacks = {}) {
  return ids.map((id, seat) => ({
    id,
    displayName: id.toUpperCase(),
    seat,
    stack: stacks[id] ?? 1_000,
  }));
}

function riggedGame({ ids = ['a', 'b'], stacks = {}, buttonId = ids[0] } = {}) {
  return new Game({
    players: players(ids, stacks),
    buttonId,
    randomInt: () => 0,
  });
}

function playChecks(game, firstActor, secondActor) {
  game.dispatch(firstActor, { type: 'check' });
  game.dispatch(secondActor, { type: 'check' });
}

describe('Game hand flow', () => {
  it('makes the button post SB and act first preflop heads-up', () => {
    const game = riggedGame({ ids: ['a', 'b'], buttonId: 'a' });
    game.startMatch();

    expect(game.snapshot()).toMatchObject({
      phase: 'playing',
      handNumber: 1,
      street: 'preflop',
      buttonId: 'a',
      smallBlindId: 'a',
      bigBlindId: 'b',
      actorId: 'a',
      currentBet: 20,
    });
  });

  it('advances preflop through showdown with postflop action left of the button', () => {
    const game = riggedGame();
    game.startMatch();

    game.dispatch('a', { type: 'call' });
    game.dispatch('b', { type: 'check' });
    expect(game.snapshot()).toMatchObject({ street: 'flop', actorId: 'b' });
    expect(game.snapshot().board).toHaveLength(3);

    playChecks(game, 'b', 'a');
    expect(game.snapshot()).toMatchObject({ street: 'turn', actorId: 'b' });
    expect(game.snapshot().board).toHaveLength(4);

    playChecks(game, 'b', 'a');
    expect(game.snapshot()).toMatchObject({ street: 'river', actorId: 'b' });
    expect(game.snapshot().board).toHaveLength(5);

    playChecks(game, 'b', 'a');
    const finished = game.snapshot();
    expect(finished.phase).toBe('betweenHands');
    expect(finished.lastHandResult.reason).toBe('showdown');
    expect(Object.values(finished.players).reduce((sum, player) => sum + player.stack, 0)).toBe(2_000);
  });

  it('runs out the board when every remaining player is all-in', () => {
    const game = riggedGame();
    game.startMatch();

    game.dispatch('a', { type: 'allIn' });
    game.dispatch('b', { type: 'call' });

    expect(game.snapshot()).toMatchObject({ phase: 'results', street: 'showdown', actorId: null });
    expect(game.snapshot().matchStatus).toMatchObject({ complete: true, reason: 'lastPlayer' });
    expect(game.snapshot().board).toHaveLength(5);
    expect(Object.values(game.snapshot().players).every(player => player.stack >= 0)).toBe(true);
  });

  it('awards an uncontested pot immediately after every opponent folds', () => {
    const game = riggedGame();
    game.startMatch();

    game.dispatch('a', { type: 'fold' });

    expect(game.snapshot()).toMatchObject({
      phase: 'betweenHands',
      lastHandResult: { reason: 'fold', winnerIds: ['b'], pot: 30 },
    });
    expect(game.snapshot().players.b.stack).toBe(1_010);
  });

  it('rotates the button past an eliminated seat on the next hand', () => {
    const game = riggedGame({ ids: ['a', 'b', 'c'], stacks: { a: 0, b: 1_500, c: 1_500 }, buttonId: 'a' });
    game.startMatch();
    expect(game.snapshot().buttonId).toBe('b');

    game.dispatch('b', { type: 'fold' });
    game.startNextHand();

    expect(game.snapshot().buttonId).toBe('c');
  });

  it('starts a rematch with the same seats and restored stacks', () => {
    const game = riggedGame({ ids: ['a', 'b', 'c'] });
    game.players.a.stack = 2_500;
    game.players.b.stack = 500;
    game.players.c.stack = 0;

    game.resetMatch();

    expect(Object.values(game.snapshot().players).map(player => [player.id, player.seat, player.stack])).toEqual([
      ['a', 0, 1_000],
      ['b', 1, 1_000],
      ['c', 2, 1_000],
    ]);
    expect(game.snapshot()).toMatchObject({ handNumber: 0, phase: 'waiting' });
  });
});
