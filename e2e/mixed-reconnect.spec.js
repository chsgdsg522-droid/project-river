import { expect, test } from '@playwright/test';
import { createTwoPlayerRoom, finishByFolding } from './helpers.js';

test('two humans and four real bots finish ten hands after a forced WebSocket disconnect', async ({ browser }) => {
  test.setTimeout(240_000);
  let hostState;
  let guestState;
  let guestConnection;
  let holdSnapshots = false;
  const heldSnapshots = [];
  const resumedPlayers = [];
  const disconnectedPlayers = new Set();
  const seenHands = new Set();
  const errors = [];
  const game = await createTwoPlayerRoom(browser, {
    keepBots: true,
    async configurePages(host, guest) {
      host.on('pageerror', error => errors.push(error.message));
      guest.on('pageerror', error => errors.push(error.message));
      host.on('websocket', ws => ws.on('framereceived', ({ payload }) => {
        const message = JSON.parse(payload);
        if (message.type === 'room.state') {
          hostState = message.payload;
          for (const seat of hostState.seats) {
            if (seat.kind === 'human' && !seat.connected) disconnectedPlayers.add(seat.playerId);
          }
          if (hostState.game) seenHands.add(hostState.game.handNumber);
        }
      }));
      // Forward real server messages without manufacturing game/session state.
      // Closing BOTH sides proves server disconnect + a new resume handshake;
      // holding only snapshots checks that an open socket cannot unlock stale UI.
      await guest.routeWebSocket('ws://127.0.0.1:8080/**', ws => {
        const server = ws.connectToServer();
        guestConnection = { ws, server };
        server.onMessage(raw => {
          const message = JSON.parse(raw);
          if (message.type === 'session.ready') resumedPlayers.push(message.payload.playerId);
          if (message.type === 'room.state') {
            guestState = message.payload;
            if (holdSnapshots) { heldSnapshots.push({ ws, raw }); return; }
          }
          ws.send(raw);
        });
      });
    },
  });

  try {
    expect(hostState.seats.filter(seat => seat.kind === 'human')).toHaveLength(2);
    expect(hostState.seats.filter(seat => seat.kind === 'bot')).toHaveLength(4);
    await game.host.getByRole('button', { name: '开始牌局' }).click();
    await expect(game.guest.getByTestId('self-hole-cards')).toBeVisible();
    const playerId = guestState.self.playerId;
    const cards = [...guestState.game.players[playerId].holeCards];
    holdSnapshots = true;
    const disconnected = guestConnection;
    // The server leg uses the browser's native close(): use its permitted
    // application-code range, not a reserved server-only code such as 1012.
    await Promise.all([disconnected.server.close({ code: 4000 }), disconnected.ws.close({ code: 4000 })]);
    await expect.poll(() => disconnectedPlayers.has(playerId)).toBe(true);
    await expect(game.guest.getByRole('status')).toContainText('正在重新连接');
    await expect.poll(() => resumedPlayers.length).toBe(2);
    await expect.poll(() => heldSnapshots.length).toBeGreaterThan(0);
    expect(resumedPlayers).toEqual([playerId, playerId]);
    await expect(game.guest.getByRole('button', { name: '快捷消息 你好' })).toBeDisabled();
    holdSnapshots = false;
    for (const { ws, raw } of heldSnapshots.splice(0)) ws.send(raw);
    await expect(game.guest.getByText(/正在重新连接/)).toHaveCount(0);
    await expect(game.guest.getByRole('button', { name: '快捷消息 你好' })).toBeEnabled();
    expect(guestState.game.players[playerId].holeCards).toEqual(cards);

    await finishByFolding(game.host, game.guest, { maxSteps: 700 });
    await expect(game.guest.getByRole('heading', { name: '十手牌，落定。' })).toBeVisible();
    expect(hostState.game.matchStatus.summary.handsPlayed).toBe(10);
    expect([...seenHands].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(hostState.game.matchStatus.summary.players.reduce((sum, player) => sum + player.chips, 0)).toBe(6_000);
    expect(errors).toEqual([]);
    await game.host.getByRole('button', { name: '再来一局' }).click();
    await expect(game.guest.getByRole('heading', { name: '等大家入座' })).toBeVisible();
  } finally {
    await game.hostContext.close();
    await game.guestContext.close();
  }
});
