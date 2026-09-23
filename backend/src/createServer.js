import { createHash } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import { BotController } from './bots/BotController.js';
import { DEFAULT_RULES } from './config.js';
import { createRoomStateEnvelope } from './RoomView.js';
import { RoomManager } from './RoomManager.js';
import { SessionRegistry } from './SessionRegistry.js';
import { TurnClock } from './TurnClock.js';
import { createEnvelope, parseClientMessage, ProtocolError } from './protocol.js';

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function roomHash(code) {
  return createHash('sha256').update(code).digest('hex').slice(0, 12);
}

function validateTelemetry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const allowed = ['kind', 'name', 'durationMs', 'route', 'browserFamily'];
  if (Object.keys(value).some(key => !allowed.includes(key))) return null;
  if (!['error', 'performance'].includes(value.kind)) return null;
  if (typeof value.name !== 'string' || !/^[a-zA-Z0-9 .:_-]{1,64}$/.test(value.name)) return null;
  if (typeof value.route !== 'string' || !/^\/[a-zA-Z0-9/_-]{0,127}$/.test(value.route)) return null;
  if (typeof value.browserFamily !== 'string' || !/^[a-zA-Z0-9 ._-]{1,32}$/.test(value.browserFamily)) return null;
  if (value.durationMs !== undefined
    && (!Number.isFinite(value.durationMs) || value.durationMs < 0 || value.durationMs > 600_000)) return null;
  return {
    kind: value.kind,
    name: value.name,
    ...(value.durationMs === undefined ? {} : { durationMs: value.durationMs }),
    route: value.route,
    browserFamily: value.browserFamily,
  };
}

function closeHttpServer(httpServer) {
  if (!httpServer.listening) return Promise.resolve();
  return new Promise((resolve, reject) => httpServer.close(error => (error ? reject(error) : resolve())));
}

function closeWebSocketServer(wsServer) {
  for (const client of wsServer.clients) client.terminate();
  return new Promise(resolve => wsServer.close(() => resolve()));
}

export function createServer({
  port = 0,
  host = '127.0.0.1',
  now = Date.now,
  randomCode,
  createPlayerId,
  randomInt,
  botRandom,
  telemetrySink = () => {},
  logger = () => {},
  setTimeout: schedule = setTimeout,
  clearTimeout: cancel = clearTimeout,
  setInterval: repeat = setInterval,
  clearInterval: cancelRepeat = clearInterval,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true, credentials: false }));
  const httpServer = createHttpServer(app);
  const wsServer = new WebSocketServer({ server: httpServer, maxPayload: 8 * 1024 });
  const rooms = new RoomManager({ now, randomCode, createPlayerId, gameRandomInt: randomInt, rules: DEFAULT_RULES });
  const sessions = new SessionRegistry();
  const turnClock = new TurnClock({ now, setTimeout: schedule, clearTimeout: cancel });
  const contexts = new Map();
  const handTimers = new Map();
  const telemetryWindows = new Map();
  let maintenanceTimer = null;
  let stopped = false;

  function log(event, fields = {}) {
    logger({ event, ...fields });
  }

  function safeSend(socket, message) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  function broadcastRoom(room) {
    for (const [socket, context] of contexts) {
      if (context.roomCode !== room.code || socket.readyState !== WebSocket.OPEN) continue;
      safeSend(socket, createRoomStateEnvelope(room, {
        playerId: context.playerId,
        role: context.role,
      }));
    }
  }

  function cancelHandTimer(code) {
    const timeoutId = handTimers.get(code);
    if (timeoutId !== undefined) cancel(timeoutId);
    handTimers.delete(code);
  }

  function scheduleAutomation(room) {
    turnClock.cancel(room.code);
    cancelHandTimer(room.code);
    room.actionDeadline = null;
    if (room.phase !== 'playing' || !room.game) return;
    if (room.game.phase === 'betweenHands') {
      const timeoutId = schedule(() => {
        handTimers.delete(room.code);
        try {
          rooms.startNextHand(room.code);
          scheduleAutomation(room);
          broadcastRoom(room);
        } catch (error) {
          log('next_hand_error', { roomHash: roomHash(room.code), errorCode: error.code ?? 'UNKNOWN' });
        }
      }, 1_000);
      handTimers.set(room.code, timeoutId);
      return;
    }
    if (room.game.phase !== 'playing') return;
    const actorId = room.game.snapshot().actorId;
    const seat = room.seats.find(value => value.playerId === actorId);
    if (seat?.kind === 'bot' || seat?.controller === 'bot') {
      bots.maybeAct(room);
      return;
    }
    room.actionDeadline = now() + DEFAULT_RULES.actionMs;
    turnClock.start({
      roomCode: room.code,
      handId: room.handId,
      actorId,
      deadline: room.actionDeadline,
      onExpire: () => {
        try {
          rooms.applyTimeout(room.code);
          scheduleAutomation(room);
          broadcastRoom(room);
        } catch (error) {
          log('turn_timeout_error', { roomHash: roomHash(room.code), errorCode: error.code ?? 'UNKNOWN' });
        }
      },
    });
  }

  const bots = new BotController({
    roomManager: rooms,
    random: botRandom,
    setTimeout: schedule,
    clearTimeout: cancel,
    onStateChange: room => {
      scheduleAutomation(room);
      broadcastRoom(room);
    },
  });

  function bindPlayer(socket, { room, playerId, role }) {
    const token = sessions.issue(playerId);
    sessions.attach(token, socket);
    contexts.set(socket, { playerId, roomCode: room.code, role, token, messageTimes: [], lastChatAt: -Infinity });
    safeSend(socket, createEnvelope('session.ready', room.revision, { token, playerId, roomCode: room.code, role }));
    broadcastRoom(room);
  }

  function contextFor(socket) {
    const context = contexts.get(socket);
    if (!context) throw codedError('SESSION_REQUIRED');
    return context;
  }

  function requireSameRoom(context, roomCode) {
    if (context.roomCode !== roomCode) throw codedError('ROOM_ACCESS_DENIED');
  }

  function findRoomForPlayer(playerId) {
    for (const room of rooms.rooms.values()) {
      const seat = room.seats.find(value => value.playerId === playerId);
      if (seat) return { room, role: 'player' };
      if (room.spectators.some(value => value.playerId === playerId)) return { room, role: 'spectator' };
    }
    return null;
  }

  function checkSocketRate(context) {
    const cutoff = now() - 1_000;
    context.messageTimes = context.messageTimes.filter(timestamp => timestamp > cutoff);
    context.messageTimes.push(now());
    return context.messageTimes.length <= 20;
  }

  function handleMessage(socket, raw) {
    const startedAt = now();
    try {
      const existing = contexts.get(socket);
      if (existing && !checkSocketRate(existing)) {
        socket.close(4008, 'RATE_LIMITED');
        return;
      }
      const message = parseClientMessage(raw);
      if (message.type === 'room.create') {
        if (existing) throw codedError('SESSION_ALREADY_BOUND');
        const created = rooms.createRoom(message.profile);
        bindPlayer(socket, { ...created, role: 'player' });
        return;
      }
      if (message.type === 'room.join') {
        if (existing) throw codedError('SESSION_ALREADY_BOUND');
        bindPlayer(socket, rooms.joinRoom(message.roomCode, message.profile));
        return;
      }
      if (message.type === 'session.resume') {
        const playerId = sessions.playerForToken(message.token);
        const found = playerId ? findRoomForPlayer(playerId) : null;
        if (!found) throw codedError('SESSION_NOT_FOUND');
        sessions.attach(message.token, socket);
        const claim = sessions.claimControl(message.token, now());
        rooms.markConnected(found.room.code, playerId);
        if (claim.resumeAt === 'now') rooms.restoreHumanControl(found.room.code, playerId);
        contexts.set(socket, { playerId, roomCode: found.room.code, role: found.role, token: message.token, messageTimes: [], lastChatAt: -Infinity });
        safeSend(socket, createEnvelope('session.ready', found.room.revision, { token: message.token, playerId, roomCode: found.room.code, role: found.role, resumeAt: claim.resumeAt }));
        broadcastRoom(found.room);
        return;
      }

      const context = contextFor(socket);
      requireSameRoom(context, message.roomCode);
      const room = rooms.requireRoom(message.roomCode);
      if (message.type === 'room.start') rooms.startRoom(room.code, context.playerId);
      else if (message.type === 'room.kick') rooms.kick(room.code, context.playerId, message.targetPlayerId);
      else if (message.type === 'room.bot.add') rooms.addBot(room.code, context.playerId, message.personaId);
      else if (message.type === 'room.bot.remove') rooms.removeBot(room.code, context.playerId, message.seat);
      else if (message.type === 'match.rematch') rooms.rematch(room.code, context.playerId);
      else if (message.type === 'game.action') rooms.applyGameAction(context.playerId, message);
      else if (message.type === 'quickChat.send') {
        if (now() - context.lastChatAt < 1_500) throw codedError('QUICK_CHAT_RATE_LIMITED');
        context.lastChatAt = now();
        const event = createEnvelope('quickChat.event', room.revision, { playerId: context.playerId, messageId: message.messageId });
        for (const [client, clientContext] of contexts) {
          if (clientContext.roomCode === room.code) safeSend(client, event);
        }
        return;
      }
      scheduleAutomation(room);
      broadcastRoom(room);
      log('message', { roomHash: roomHash(room.code), messageType: message.type, durationMs: now() - startedAt });
    } catch (error) {
      const code = error instanceof ProtocolError ? error.code : error.code ?? error.message ?? 'UNKNOWN_ERROR';
      safeSend(socket, createEnvelope('game.error', 0, { code }));
      log('message_error', { errorCode: code, durationMs: now() - startedAt });
    }
  }

  wsServer.on('connection', socket => {
    socket.on('message', raw => handleMessage(socket, raw));
    socket.on('close', () => {
      const context = contexts.get(socket);
      sessions.disconnect(socket, now());
      contexts.delete(socket);
      if (!context) return;
      const room = rooms.getRoom(context.roomCode);
      if (!room) return;
      rooms.markDisconnected(room.code, context.playerId, now());
      broadcastRoom(room);
    });
  });

  const telemetryParser = express.json({ limit: '2kb', strict: true });
  app.get('/health', (_request, response) => response.json({ ok: true }));
  app.post('/telemetry', telemetryParser, (request, response) => {
    const key = request.ip;
    const cutoff = now() - 60_000;
    const timestamps = (telemetryWindows.get(key) ?? []).filter(timestamp => timestamp > cutoff);
    if (timestamps.length >= 30) return response.sendStatus(429);
    timestamps.push(now());
    telemetryWindows.set(key, timestamps);
    const event = validateTelemetry(request.body);
    if (!event) return response.sendStatus(400);
    telemetrySink(event);
    return response.sendStatus(204);
  });
  app.use((error, _request, response, _next) => {
    if (error?.type === 'entity.too.large') return response.sendStatus(413);
    return response.sendStatus(400);
  });

  function runMaintenance(at = now()) {
    const takeovers = rooms.processDisconnectTimeouts(at);
    for (const takeover of takeovers) {
      const token = sessions.tokenForPlayer(takeover.playerId);
      const room = rooms.getRoom(takeover.roomCode);
      if (token && room) sessions.forceBotControl(token, room.handId);
      if (room) {
        scheduleAutomation(room);
        broadcastRoom(room);
      }
    }
    const expired = rooms.expireIdleRooms(at);
    for (const code of expired) {
      turnClock.cancel(code);
      bots.cancel(code);
      cancelHandTimer(code);
    }
    return { takeovers, expired };
  }

  const services = { rooms, sessions, turnClock, bots, contexts, runMaintenance };

  return {
    app,
    httpServer,
    wsServer,
    services,
    async start() {
      if (httpServer.listening) throw codedError('SERVER_ALREADY_STARTED');
      await new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, resolve);
      });
      maintenanceTimer = repeat(() => runMaintenance(now()), 1_000);
      maintenanceTimer.unref?.();
      const address = httpServer.address();
      return {
        port: address.port,
        url: `http://${host}:${address.port}`,
        wsUrl: `ws://${host}:${address.port}`,
      };
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      if (maintenanceTimer !== null) cancelRepeat(maintenanceTimer);
      for (const code of handTimers.keys()) cancelHandTimer(code);
      turnClock.close();
      bots.close();
      await closeWebSocketServer(wsServer);
      await closeHttpServer(httpServer);
      contexts.clear();
    },
  };
}
