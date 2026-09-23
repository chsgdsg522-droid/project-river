import { DEFAULT_RULES } from '../config.js';
import { Deck } from './Deck.js';
import { compareHands, evaluateBest } from './HandEvaluator.js';
import { activeIds, dealHoleCards, nextActiveId, positionsFor, postBlind, resolveButton } from './HandLifecycle.js';
import { isBettingRoundComplete, uncontestedWinner } from './BettingRound.js';
import { MatchController } from './MatchController.js';
import { Player } from './Player.js';
import { applyAction, getLegalActions } from './PlayerActionValidator.js';
import { awardPots, buildPots } from './PotManager.js';

function copyPlayer(player) {
  return {
    id: player.id,
    displayName: player.displayName,
    seat: player.seat,
    stack: player.stack,
    holeCards: player.holeCards.map(card => ({ ...card })),
    streetCommitment: player.streetCommitment,
    totalCommitment: player.totalCommitment,
    folded: player.folded,
    allIn: player.allIn,
    revealed: player.revealed,
    lastAction: player.lastAction ? { ...player.lastAction } : null,
  };
}

export class Game {
  constructor({ players, rules = {}, randomInt, buttonId = null, matchController = new MatchController() } = {}) {
    if (!Array.isArray(players) || players.length < 2 || players.length > 6) {
      throw new RangeError('Game requires between two and six players');
    }

    this.rules = Object.freeze({ ...DEFAULT_RULES, ...rules });
    this.randomInt = randomInt;
    this.matchController = matchController;
    this.order = [...players].sort((left, right) => left.seat - right.seat).map(player => player.id);
    this.handOrder = [];
    this.players = Object.fromEntries(players.map(input => {
      const player = new Player(input.id, input.displayName, {
        seat: input.seat,
        stack: input.stack ?? this.rules.startingChips,
      });
      return [player.id, player];
    }));
    this.initialButtonId = buttonId ?? this.order[0];
    this.buttonId = this.initialButtonId;
    this.handNumber = 0;
    this.phase = 'waiting';
    this.street = null;
    this.board = [];
    this.deck = null;
    this.smallBlindId = null;
    this.bigBlindId = null;
    this.smallBlind = 0;
    this.bigBlind = 0;
    this.actorId = null;
    this.currentBet = 0;
    this.lastFullRaise = 0;
    this.acted = new Set();
    this.raisingOpenFor = new Set();
    this.lastHandResult = null;
    this.matchStatus = { handNumber: 0, complete: false, reason: null, rankings: null, summary: null };
    this.matchStats = this.createMatchStats();
    this.largestPot = 0;
  }

  createMatchStats() {
    return Object.fromEntries(this.order.map(playerId => [playerId, {
      handsWon: 0,
      biggestPot: 0,
      peakStack: this.players[playerId].stack,
    }]));
  }

  startMatch() {
    if (this.phase !== 'waiting' || this.handNumber !== 0) throw new Error('MATCH_ALREADY_STARTED');
    this.startHand(false);
    return this.snapshot();
  }

  startNextHand() {
    if (this.phase !== 'betweenHands') throw new Error('NEXT_HAND_NOT_AVAILABLE');
    this.startHand(true);
    return this.snapshot();
  }

  startHand(rotateButton) {
    if (activeIds(this.order, this.players).length < 2) throw new Error('NOT_ENOUGH_PLAYERS');
    this.buttonId = resolveButton(this.order, this.players, this.buttonId, rotateButton);
    this.handNumber += 1;
    this.phase = 'playing';
    this.street = 'preflop';
    this.board = [];
    this.lastHandResult = null;
    this.deck = new Deck({ randomInt: this.randomInt });

    for (const player of Object.values(this.players)) player.resetForNewHand();
    this.handOrder = activeIds(this.order, this.players);

    const positions = positionsFor(this.order, this.players, this.buttonId);
    this.smallBlindId = positions.smallBlindId;
    this.bigBlindId = positions.bigBlindId;
    ({ smallBlind: this.smallBlind, bigBlind: this.bigBlind } = this.matchController.blindsFor(this.handNumber));
    postBlind(this.players[this.smallBlindId], this.smallBlind);
    postBlind(this.players[this.bigBlindId], this.bigBlind);
    dealHoleCards(this.deck, this.order, this.players, this.buttonId);

    this.currentBet = Math.max(
      this.players[this.smallBlindId].streetCommitment,
      this.players[this.bigBlindId].streetCommitment,
    );
    this.lastFullRaise = this.bigBlind;
    this.acted = new Set();
    this.raisingOpenFor = new Set(this.actionableIds());
    this.actorId = this.players[positions.preflopActorId].allIn
      ? nextActiveId(this.order, this.actionablePlayerMap(), positions.preflopActorId)
      : positions.preflopActorId;
  }

  actionablePlayerMap() {
    return Object.fromEntries(this.order.map(playerId => [playerId, {
      stack: this.players[playerId].folded || this.players[playerId].allIn ? 0 : this.players[playerId].stack,
    }]));
  }

  actionableIds() {
    return this.order.filter(playerId => {
      const player = this.players[playerId];
      return player.stack > 0 && !player.folded && !player.allIn;
    });
  }

  bettingState() {
    return {
      players: Object.fromEntries(this.order.map(playerId => [playerId, copyPlayer(this.players[playerId])])),
      order: [...this.handOrder],
      actorId: this.actorId,
      currentBet: this.currentBet,
      lastFullRaise: this.lastFullRaise,
      bigBlind: this.bigBlind,
      acted: new Set(this.acted),
      raisingOpenFor: new Set(this.raisingOpenFor),
    };
  }

  applyBettingState(state) {
    for (const playerId of this.order) Object.assign(this.players[playerId], state.players[playerId]);
    this.actorId = state.actorId;
    this.currentBet = state.currentBet;
    this.lastFullRaise = state.lastFullRaise;
    this.acted = state.acted;
    this.raisingOpenFor = state.raisingOpenFor;
  }

  legalActionsFor(playerId) {
    return getLegalActions(this.bettingState(), playerId);
  }

  dispatch(playerId, action) {
    if (this.phase !== 'playing') throw new Error('HAND_NOT_IN_PROGRESS');
    const result = applyAction(this.bettingState(), playerId, action);
    this.applyBettingState(result.state);

    const soleWinner = uncontestedWinner(this.bettingState());
    if (soleWinner) {
      this.finishUncontested(soleWinner);
      return result.event;
    }

    if (isBettingRoundComplete(this.bettingState())) this.completeStreet();
    return result.event;
  }

  completeStreet() {
    const contenders = this.order.filter(playerId => !this.players[playerId].folded);
    const canAct = contenders.filter(playerId => !this.players[playerId].allIn && this.players[playerId].stack > 0);

    if (canAct.length <= 1 && contenders.some(playerId => this.players[playerId].allIn)) {
      this.runOutAndShowdown();
      return;
    }
    if (this.street === 'river') {
      this.runShowdown();
      return;
    }

    this.advanceStreet();
  }

  advanceStreet() {
    if (this.street === 'preflop') {
      this.board.push(this.deck.draw(), this.deck.draw(), this.deck.draw());
      this.street = 'flop';
    } else if (this.street === 'flop') {
      this.board.push(this.deck.draw());
      this.street = 'turn';
    } else if (this.street === 'turn') {
      this.board.push(this.deck.draw());
      this.street = 'river';
    } else {
      throw new Error('INVALID_STREET_ADVANCE');
    }

    for (const player of Object.values(this.players)) player.resetForNewStreet();
    this.currentBet = 0;
    this.lastFullRaise = this.bigBlind;
    this.acted = new Set();
    this.raisingOpenFor = new Set(this.actionableIds());
    this.actorId = this.nextActionableAfter(this.buttonId);

    if (this.actionableIds().length <= 1) this.runOutAndShowdown();
  }

  nextActionableAfter(fromId) {
    const start = this.order.indexOf(fromId);
    for (let offset = 1; offset <= this.order.length; offset += 1) {
      const playerId = this.order[(start + offset) % this.order.length];
      if (this.actionableIds().includes(playerId)) return playerId;
    }
    return null;
  }

  runOutAndShowdown() {
    if (this.board.length === 0) this.board.push(this.deck.draw(), this.deck.draw(), this.deck.draw());
    while (this.board.length < 5) this.board.push(this.deck.draw());
    this.runShowdown();
  }

  runShowdown() {
    const contenders = this.order.filter(playerId => !this.players[playerId].folded);
    const hands = Object.fromEntries(contenders.map(playerId => [
      playerId,
      evaluateBest([...this.players[playerId].holeCards, ...this.board]),
    ]));
    const ranked = [...contenders].sort((left, right) => (
      compareHands(hands[right], hands[left]) || this.players[left].seat - this.players[right].seat
    ));
    const tiers = [];
    for (const playerId of ranked) {
      const currentTier = tiers.at(-1);
      if (!currentTier || compareHands(hands[playerId], hands[currentTier[0]]) !== 0) tiers.push([playerId]);
      else currentTier.push(playerId);
    }

    const pots = buildPots(Object.values(this.players));
    const payouts = awardPots(pots, tiers, this.players[this.buttonId].seat);
    for (const payout of payouts) this.players[payout.playerId].stack += payout.amount;
    for (const playerId of contenders) this.players[playerId].revealed = true;
    const winnerIds = [...new Set(payouts.filter(payout => payout.amount > 0).map(payout => payout.playerId))];
    this.street = 'showdown';
    this.finishHand({
      reason: 'showdown',
      winnerIds,
      pot: pots.reduce((sum, pot) => sum + pot.amount, 0),
      payouts,
      hands,
    });
  }

  finishUncontested(playerId) {
    const pot = Object.values(this.players).reduce((sum, player) => sum + player.totalCommitment, 0);
    this.players[playerId].stack += pot;
    this.finishHand({
      reason: 'fold',
      winnerIds: [playerId],
      pot,
      payouts: [{ playerId, amount: pot, potIndex: 0 }],
      hands: {},
    });
  }

  finishHand(result) {
    this.actorId = null;
    this.lastHandResult = result;
    this.matchStatus = this.matchController.afterHand(this, result);
    this.phase = this.matchStatus.complete ? 'results' : 'betweenHands';
  }

  resetMatch() {
    const reset = this.matchController.reset(this.players, this.rules);
    this.players = Object.fromEntries(Object.values(reset.players).map(input => {
      const player = new Player(input.id, input.displayName, { seat: input.seat, stack: input.stack });
      return [player.id, player];
    }));
    this.handNumber = reset.handNumber;
    this.phase = reset.phase;
    this.buttonId = this.initialButtonId;
    this.street = null;
    this.board = [];
    this.handOrder = [];
    this.actorId = null;
    this.lastHandResult = null;
    this.matchStatus = { handNumber: 0, complete: false, reason: null, rankings: null, summary: null };
    this.matchStats = this.createMatchStats();
    this.largestPot = 0;
  }

  snapshot() {
    return {
      phase: this.phase,
      handNumber: this.handNumber,
      street: this.street,
      board: this.board.map(card => ({ ...card })),
      players: Object.fromEntries(this.order.map(playerId => [playerId, copyPlayer(this.players[playerId])])),
      order: [...this.order],
      handOrder: [...this.handOrder],
      buttonId: this.buttonId,
      smallBlindId: this.smallBlindId,
      bigBlindId: this.bigBlindId,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      actorId: this.actorId,
      currentBet: this.currentBet,
      lastFullRaise: this.lastFullRaise,
      pot: Object.values(this.players).reduce((sum, player) => sum + player.totalCommitment, 0),
      lastHandResult: this.lastHandResult,
      matchStatus: this.matchStatus,
    };
  }
}
