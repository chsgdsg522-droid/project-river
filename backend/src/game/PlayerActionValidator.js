import { activePlayerIds, nextActorId } from './BettingRound.js';

export class GameRuleError extends Error {
  constructor(code) {
    super(code);
    this.name = 'GameRuleError';
    this.code = code;
  }
}

function cloneState(state) {
  return {
    ...state,
    players: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, { ...player }])),
    order: [...state.order],
    acted: new Set(state.acted),
    raisingOpenFor: new Set(state.raisingOpenFor),
  };
}

function requirePlayer(state, playerId) {
  const player = state.players[playerId];
  if (!player) throw new GameRuleError('PLAYER_NOT_FOUND');
  if (player.folded || player.allIn || player.stack <= 0) throw new GameRuleError('PLAYER_CANNOT_ACT');
  if (state.actorId && state.actorId !== playerId) throw new GameRuleError('NOT_YOUR_TURN');
  return player;
}

function validateRaiseTo(raiseTo, maxTo) {
  if (!Number.isSafeInteger(raiseTo) || raiseTo < 0) throw new GameRuleError('INVALID_RAISE_TO');
  if (raiseTo > maxTo) throw new GameRuleError('INSUFFICIENT_CHIPS');
}

export function getLegalActions(state, playerId) {
  const player = state.players[playerId];
  if (!player || player.folded || player.allIn || player.stack <= 0) return null;

  const amountFacing = Math.max(0, state.currentBet - player.streetCommitment);
  const callAmount = Math.min(player.stack, amountFacing);
  const maxTo = player.streetCommitment + player.stack;
  const minTo = state.currentBet === 0 ? state.bigBlind : state.currentBet + state.lastFullRaise;

  return {
    fold: amountFacing > 0,
    check: amountFacing === 0,
    callAmount: amountFacing > 0 ? callAmount : null,
    bet: state.currentBet === 0 && maxTo >= state.bigBlind
      ? { minTo: state.bigBlind, maxTo }
      : null,
    raise: state.currentBet > 0 && state.raisingOpenFor.has(playerId) && maxTo > state.currentBet
      ? { minTo: Math.min(minTo, maxTo), maxTo, reopened: maxTo >= minTo }
      : null,
    allInTo: maxTo,
  };
}

function invest(player, targetCommitment) {
  const amount = targetCommitment - player.streetCommitment;
  player.stack -= amount;
  player.streetCommitment = targetCommitment;
  player.totalCommitment += amount;
  if (player.stack === 0) player.allIn = true;
  return amount;
}

function closeAction(next, playerId) {
  next.acted.add(playerId);
  next.raisingOpenFor.delete(playerId);
  next.actorId = nextActorId(next, playerId);
}

function reopenAfterFullRaise(next, playerId) {
  next.acted = new Set([playerId]);
  next.raisingOpenFor = new Set(activePlayerIds(next).filter(id => id !== playerId));
  next.actorId = nextActorId(next, playerId);
}

export function applyAction(state, playerId, action) {
  requirePlayer(state, playerId);
  const next = cloneState(state);
  const player = next.players[playerId];
  const legal = getLegalActions(next, playerId);
  let amount = 0;
  let fullRaise = false;

  if (action.type === 'fold') {
    if (!legal.fold) throw new GameRuleError('FOLD_NOT_AVAILABLE');
    player.folded = true;
    closeAction(next, playerId);
  } else if (action.type === 'check') {
    if (!legal.check) throw new GameRuleError('CHECK_NOT_AVAILABLE');
    closeAction(next, playerId);
  } else if (action.type === 'call') {
    if (legal.callAmount === null) throw new GameRuleError('CALL_NOT_AVAILABLE');
    amount = invest(player, player.streetCommitment + legal.callAmount);
    closeAction(next, playerId);
  } else if (action.type === 'bet' || action.type === 'raise') {
    const limits = action.type === 'bet' ? legal.bet : legal.raise;
    if (!limits) throw new GameRuleError(`${action.type.toUpperCase()}_NOT_AVAILABLE`);
    validateRaiseTo(action.raiseTo, limits.maxTo);
    if (action.raiseTo < limits.minTo) throw new GameRuleError('RAISE_BELOW_MINIMUM');
    const previousBet = next.currentBet;
    amount = invest(player, action.raiseTo);
    next.currentBet = action.raiseTo;
    next.lastFullRaise = action.raiseTo - previousBet;
    fullRaise = true;
    reopenAfterFullRaise(next, playerId);
  } else if (action.type === 'allIn') {
    const target = legal.allInTo;
    const previousBet = next.currentBet;
    amount = invest(player, target);
    if (target > previousBet) {
      const raiseSize = target - previousBet;
      next.currentBet = target;
      fullRaise = previousBet === 0 ? raiseSize >= next.bigBlind : raiseSize >= next.lastFullRaise;
      if (fullRaise) {
        next.lastFullRaise = raiseSize;
        reopenAfterFullRaise(next, playerId);
      } else {
        closeAction(next, playerId);
      }
    } else {
      closeAction(next, playerId);
    }
  } else {
    throw new GameRuleError('UNKNOWN_ACTION');
  }

  player.lastAction = { type: action.type, amount, raiseTo: player.streetCommitment };
  return {
    state: next,
    event: { type: action.type, playerId, amount, raiseTo: player.streetCommitment, fullRaise },
  };
}

export function validateAction(state, playerId) {
  try {
    const player = requirePlayer(state, playerId);
    return { player, toCall: Math.max(0, state.currentBet - player.streetCommitment) };
  } catch {
    return null;
  }
}
