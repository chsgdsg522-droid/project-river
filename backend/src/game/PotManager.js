export function buildPots(players) {
  const contributors = players.filter(player => Number.isSafeInteger(player.totalCommitment) && player.totalCommitment > 0);
  const levels = [...new Set(contributors.map(player => player.totalCommitment))].sort((a, b) => a - b);
  const seatByPlayer = Object.fromEntries(players.map(player => [player.id, player.seat]));
  const pots = [];
  let previousLevel = 0;

  for (const level of levels) {
    const atLevel = contributors.filter(player => player.totalCommitment >= level);
    const amount = (level - previousLevel) * atLevel.length;
    if (amount > 0) {
      pots.push({
        amount,
        cap: level,
        eligible: atLevel.filter(player => !player.folded).map(player => player.id),
        seatByPlayer,
      });
    }
    previousLevel = level;
  }

  return pots;
}

function clockwiseDistance(seat, buttonSeat, tableSize) {
  const distance = (seat - buttonSeat + tableSize) % tableSize;
  return distance === 0 ? tableSize : distance;
}

export function awardPots(pots, rankedPlayerIds, buttonSeat) {
  const payouts = [];

  pots.forEach((pot, potIndex) => {
    const eligible = new Set(pot.eligible);
    const winningTier = rankedPlayerIds
      .map(tier => tier.filter(playerId => eligible.has(playerId)))
      .find(tier => tier.length > 0);
    if (!winningTier) throw new Error(`NO_ELIGIBLE_WINNER_FOR_POT_${potIndex}`);

    const seats = Object.values(pot.seatByPlayer).filter(Number.isSafeInteger);
    const tableSize = Math.max(6, seats.length === 0 ? 0 : Math.max(...seats) + 1);
    const orderedWinners = [...winningTier].sort((left, right) => (
      clockwiseDistance(pot.seatByPlayer[left], buttonSeat, tableSize)
      - clockwiseDistance(pot.seatByPlayer[right], buttonSeat, tableSize)
    ));
    const share = Math.floor(pot.amount / orderedWinners.length);
    const remainder = pot.amount % orderedWinners.length;

    orderedWinners.forEach((playerId, winnerIndex) => {
      payouts.push({
        playerId,
        amount: share + (winnerIndex < remainder ? 1 : 0),
        potIndex,
      });
    });
  });

  return payouts;
}
