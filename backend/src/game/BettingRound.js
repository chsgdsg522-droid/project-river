function canAct(player) {
  return player && !player.folded && !player.allIn && player.stack > 0;
}

export function nextActorId(state, fromId = state.actorId) {
  if (!Array.isArray(state.order) || state.order.length === 0) return null;
  const foundIndex = state.order.indexOf(fromId);
  const start = foundIndex < 0 ? state.order.length - 1 : foundIndex;

  for (let offset = 1; offset <= state.order.length; offset += 1) {
    const playerId = state.order[(start + offset) % state.order.length];
    if (canAct(state.players[playerId])) return playerId;
  }
  return null;
}

export function uncontestedWinner(state) {
  const contenders = state.order.filter(playerId => {
    const player = state.players[playerId];
    return player && !player.folded;
  });
  return contenders.length === 1 ? contenders[0] : null;
}

export function isBettingRoundComplete(state) {
  const actors = state.order.map(playerId => state.players[playerId]).filter(canAct);
  if (actors.length === 0) return true;
  return actors.every(player => state.acted.has(player.id) && player.streetCommitment === state.currentBet);
}

export function activePlayerIds(state) {
  return state.order.filter(playerId => canAct(state.players[playerId]));
}
