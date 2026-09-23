import { randomBytes } from 'node:crypto';

function sessionError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export class SessionRegistry {
  constructor({ createToken = () => randomBytes(16).toString('base64url') } = {}) {
    this.createToken = createToken;
    this.sessions = new Map();
    this.playerTokens = new Map();
    this.socketTokens = new Map();
  }

  issue(playerId) {
    const prior = this.playerTokens.get(playerId);
    if (prior) this.sessions.delete(prior);
    let token;
    do token = this.createToken(); while (this.sessions.has(token));
    if (typeof token !== 'string' || token.length < 22) throw sessionError('WEAK_SESSION_TOKEN');
    this.sessions.set(token, {
      token,
      playerId,
      socket: null,
      connected: false,
      disconnectedAt: null,
      control: 'human',
      takeoverHandId: null,
      botStartedLaterHand: false,
      pendingHuman: false,
    });
    this.playerTokens.set(playerId, token);
    return token;
  }

  require(token) {
    const session = this.sessions.get(token);
    if (!session) throw sessionError('INVALID_SESSION_TOKEN');
    return session;
  }

  playerForToken(token) {
    return this.sessions.get(token)?.playerId ?? null;
  }

  attach(token, socket) {
    const session = this.require(token);
    if (session.socket && session.socket !== socket) {
      this.socketTokens.delete(session.socket);
      session.socket.close?.(4001, 'SESSION_REPLACED');
    }
    session.socket = socket;
    session.connected = true;
    session.disconnectedAt = null;
    this.socketTokens.set(socket, token);
    return this.publicSession(session);
  }

  disconnect(socket, at = Date.now()) {
    const token = this.socketTokens.get(socket);
    if (!token) return null;
    const session = this.sessions.get(token);
    this.socketTokens.delete(socket);
    if (session.socket === socket) {
      session.socket = null;
      session.connected = false;
      session.disconnectedAt = at;
    }
    return this.publicSession(session);
  }

  takeOverExpired(at, reconnectMs, handId) {
    const playerIds = [];
    for (const session of this.sessions.values()) {
      if (!session.connected
        && session.control === 'human'
        && session.disconnectedAt !== null
        && at - session.disconnectedAt >= reconnectMs) {
        session.control = 'bot';
        session.takeoverHandId = handId;
        session.botStartedLaterHand = false;
        playerIds.push(session.playerId);
      }
    }
    return playerIds;
  }

  forceBotControl(token, handId) {
    const session = this.require(token);
    session.control = 'bot';
    session.takeoverHandId = handId;
    session.botStartedLaterHand = false;
  }

  noteBotStartedHand(token, handId) {
    const session = this.require(token);
    if (session.control === 'bot' && session.takeoverHandId !== handId) session.botStartedLaterHand = true;
  }

  claimControl(token, _at = Date.now()) {
    const session = this.require(token);
    if (session.control !== 'bot' || !session.botStartedLaterHand) {
      session.control = 'human';
      session.pendingHuman = false;
      return { playerId: session.playerId, resumeAt: 'now' };
    }
    session.pendingHuman = true;
    return { playerId: session.playerId, resumeAt: 'nextHand' };
  }

  activatePendingAtBoundary(token) {
    const session = this.require(token);
    if (!session.pendingHuman) return false;
    session.control = 'human';
    session.pendingHuman = false;
    session.botStartedLaterHand = false;
    session.takeoverHandId = null;
    return true;
  }

  activeController(playerId) {
    const token = this.playerTokens.get(playerId);
    return token ? this.sessions.get(token)?.control ?? null : null;
  }

  publicSession(session) {
    return {
      playerId: session.playerId,
      connected: session.connected,
      disconnectedAt: session.disconnectedAt,
      control: session.control,
      pendingHuman: session.pendingHuman,
    };
  }
}
