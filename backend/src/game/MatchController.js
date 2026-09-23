export class MatchController {
  blindsFor(handNumber) {
    if (!Number.isSafeInteger(handNumber) || handNumber < 1) {
      throw new RangeError('Hand number must be a positive integer');
    }
    if (handNumber <= 4) return { smallBlind: 10, bigBlind: 20 };
    if (handNumber <= 7) return { smallBlind: 20, bigBlind: 40 };
    return { smallBlind: 40, bigBlind: 80 };
  }

  rankingsFor(players) {
    const ordered = Object.values(players).sort((left, right) => right.stack - left.stack || left.seat - right.seat);
    let previousStack = null;
    let previousRank = 0;
    return ordered.map((player, index) => {
      const rank = player.stack === previousStack ? previousRank : index + 1;
      previousStack = player.stack;
      previousRank = rank;
      return { playerId: player.id, rank, chips: player.stack };
    });
  }

  afterHand(game, result) {
    game.largestPot = Math.max(game.largestPot ?? 0, result.pot);
    for (const player of Object.values(game.players)) {
      const stats = game.matchStats[player.id];
      stats.peakStack = Math.max(stats.peakStack, player.stack);
      if (result.winnerIds.includes(player.id)) {
        stats.handsWon += 1;
        stats.biggestPot = Math.max(stats.biggestPot, result.pot);
      }
    }

    const remaining = Object.values(game.players).filter(player => player.stack > 0);
    const reason = game.handNumber >= game.rules.maxHands
      ? 'tenHands'
      : remaining.length <= 1
        ? 'lastPlayer'
        : null;
    const complete = reason !== null;
    const rankings = complete ? this.rankingsFor(game.players) : null;
    const summary = complete ? {
      handsPlayed: game.handNumber,
      largestPot: game.largestPot,
      players: this.rankingsFor(game.players).map(ranking => ({
        ...ranking,
        handsWon: game.matchStats[ranking.playerId].handsWon,
        biggestPot: game.matchStats[ranking.playerId].biggestPot,
        biggestRise: game.matchStats[ranking.playerId].peakStack - game.rules.startingChips,
      })),
    } : null;

    return { handNumber: game.handNumber, complete, reason, rankings, summary };
  }

  reset(players, rules) {
    const resetPlayers = Object.fromEntries(Object.values(players)
      .sort((left, right) => left.seat - right.seat)
      .map(player => [player.id, {
        ...player,
        stack: rules.startingChips,
        holeCards: [],
        streetCommitment: 0,
        totalCommitment: 0,
        folded: false,
        allIn: false,
        revealed: false,
        lastAction: null,
      }]));
    return { handNumber: 0, phase: 'waiting', players: resetPlayers };
  }
}
