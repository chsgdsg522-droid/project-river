export function activeIds(order, players) {
  return order.filter(playerId => players[playerId]?.stack > 0);
}

export function nextActiveId(order, players, fromId, { includeFrom = false } = {}) {
  const startIndex = order.indexOf(fromId);
  const start = startIndex < 0 ? order.length - 1 : startIndex;
  const firstOffset = includeFrom ? 0 : 1;
  for (let offset = firstOffset; offset < order.length + firstOffset; offset += 1) {
    const playerId = order[(start + offset) % order.length];
    if (players[playerId]?.stack > 0) return playerId;
  }
  return null;
}

export function resolveButton(order, players, preferredId, rotate) {
  if (!rotate && players[preferredId]?.stack > 0) return preferredId;
  return nextActiveId(order, players, preferredId);
}

export function positionsFor(order, players, buttonId) {
  const active = activeIds(order, players);
  if (active.length < 2) throw new Error('NOT_ENOUGH_PLAYERS');

  if (active.length === 2) {
    const bigBlindId = nextActiveId(order, players, buttonId);
    return { smallBlindId: buttonId, bigBlindId, preflopActorId: buttonId };
  }

  const smallBlindId = nextActiveId(order, players, buttonId);
  const bigBlindId = nextActiveId(order, players, smallBlindId);
  return {
    smallBlindId,
    bigBlindId,
    preflopActorId: nextActiveId(order, players, bigBlindId),
  };
}

export function postBlind(player, blind) {
  const amount = Math.min(player.stack, blind);
  player.stack -= amount;
  player.streetCommitment += amount;
  player.totalCommitment += amount;
  if (player.stack === 0) player.allIn = true;
  return amount;
}

export function dealHoleCards(deck, order, players, buttonId) {
  const active = activeIds(order, players);
  const firstId = nextActiveId(order, players, buttonId);
  const firstIndex = active.indexOf(firstId);
  const dealOrder = [...active.slice(firstIndex), ...active.slice(0, firstIndex)];

  for (let round = 0; round < 2; round += 1) {
    for (const playerId of dealOrder) players[playerId].holeCards.push(deck.draw());
  }
}
