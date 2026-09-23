import { createEnvelope } from './protocol.js';

const SUIT_CODES = Object.freeze({ clubs: 'c', diamonds: 'd', hearts: 'h', spades: 's' });

function cardCode(card) {
  if (typeof card === 'string') return card;
  return `${card.rank}${SUIT_CODES[card.suit]}`;
}

export function projectPlayer(source, recipientId, showdownIds) {
  const canSee = source.id === recipientId || showdownIds.has(source.id);
  return {
    id: source.id,
    seat: source.seat,
    displayName: source.displayName,
    avatarId: source.avatarId,
    stack: source.stack,
    streetCommitment: source.streetCommitment,
    folded: source.folded,
    allIn: source.allIn,
    revealed: showdownIds.has(source.id),
    lastAction: source.lastAction ? { type: source.lastAction.type, amount: source.lastAction.amount } : null,
    ...(canSee ? { holeCards: source.holeCards.map(cardCode) } : {}),
  };
}

function safeResult(result) {
  if (!result) return null;
  return {
    reason: result.reason,
    winnerIds: [...result.winnerIds],
    pot: result.pot,
  };
}

function safeMatchStatus(status) {
  if (!status) return null;
  return {
    handNumber: status.handNumber,
    complete: status.complete,
    reason: status.reason,
    rankings: status.rankings?.map(ranking => ({ ...ranking })) ?? null,
    summary: status.summary ? {
      handsPlayed: status.summary.handsPlayed,
      largestPot: status.summary.largestPot,
      players: status.summary.players.map(player => ({ ...player })),
    } : null,
  };
}

function projectSeat(seat, players) {
  const player = seat.playerId ? players[seat.playerId] : null;
  return {
    seat: seat.seat,
    playerId: seat.playerId ?? null,
    kind: seat.kind ?? null,
    personaId: seat.personaId ?? null,
    displayName: player?.displayName ?? seat.displayName ?? null,
    avatarId: player?.avatarId ?? seat.avatarId ?? null,
    connected: seat.connected ?? true,
    controller: seat.controller ?? (seat.kind === 'bot' ? 'bot' : 'human'),
  };
}

export function projectRoom(room, recipient) {
  const snapshot = typeof room.game?.snapshot === 'function' ? room.game.snapshot() : room.game ?? null;
  if (!snapshot) {
    return {
      code: room.code,
      handId: room.handId ?? null,
      phase: room.phase,
      mode: room.mode,
      hostPlayerId: room.hostPlayerId,
      self: { playerId: recipient.playerId, role: recipient.role },
      seats: room.seats.map(seat => projectSeat(seat, {})),
      spectators: room.spectators.map(value => ({
        playerId: value.playerId,
        displayName: value.displayName,
        avatarId: value.avatarId,
      })),
      game: null,
    };
  }

  const showdownIds = new Set(Object.values(snapshot.players)
    .filter(player => snapshot.street === 'showdown' && player.revealed && !player.folded)
    .map(player => player.id));
  const players = Object.fromEntries(Object.entries(snapshot.players).map(([playerId, player]) => [
    playerId,
    projectPlayer(player, recipient.playerId, showdownIds),
  ]));

  return {
    code: room.code,
    handId: room.handId ?? null,
    phase: room.phase,
    mode: room.mode,
    hostPlayerId: room.hostPlayerId,
    self: { playerId: recipient.playerId, role: recipient.role },
    seats: room.seats.map(seat => projectSeat(seat, players)),
    spectators: room.spectators.map(value => ({
      playerId: value.playerId,
      displayName: value.displayName,
      avatarId: value.avatarId,
    })),
    game: {
      phase: snapshot.phase,
      handNumber: snapshot.handNumber,
      street: snapshot.street,
      board: snapshot.board.map(cardCode),
      players,
      order: [...snapshot.order],
      buttonId: snapshot.buttonId,
      smallBlindId: snapshot.smallBlindId,
      bigBlindId: snapshot.bigBlindId,
      smallBlind: snapshot.smallBlind,
      bigBlind: snapshot.bigBlind,
      actorId: snapshot.actorId,
      currentBet: snapshot.currentBet,
      pot: snapshot.pot,
      legalActions: recipient.role === 'player' && recipient.playerId
        ? room.game.legalActionsFor(recipient.playerId)
        : null,
      lastHandResult: safeResult(snapshot.lastHandResult),
      matchStatus: safeMatchStatus(snapshot.matchStatus),
    },
  };
}

export function createRoomStateEnvelope(room, recipient) {
  return createEnvelope('room.state', room.revision, projectRoom(room, recipient));
}
