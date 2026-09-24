# Project River

Project River is a responsive Texas Hold'em game for private friend rooms, solo practice, and beginner learning. It uses virtual chips only and does not support deposits, withdrawals, cash prizes, or real-world rewards.

The MVP is designed for six seats, one to six human players, bot-filled open seats, and a fixed ten-hand match. Chinese is the primary interface language, with international poker terms shown alongside key actions.

Every hand ends on a visual result screen: eligible showdown cards, Chinese/English hand types, and a winner trophy. Practice waits for **Next hand** (or **Results** after the final hand); friend rooms retain each result for eight seconds. Folded cards stay private, and an uncontested win is marked **No showdown**.

## Status

Development is local-first. Rooms live only in server memory and disappear when the server restarts. No public deployment is configured yet.

Player identity, display preferences, and aggregate match totals stay in that browser's local storage. Room membership and live game state stay in server memory. Project River has no account system, public lobby, free-text chat, permanent hand history, or real-money feature.

## Requirements

- Node.js 20.19+, 22.12+, or 24+ (matching the Vite/Vitest supported versions)
- npm 10 or newer

## Install

```bash
npm install
```

## Develop

Run the backend and frontend in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Then open `http://127.0.0.1:5173`. The backend health endpoint is `http://127.0.0.1:8080/health`.

## Verify

```bash
npm test
npm run build
npm run test:e2e
npm run check
```

The Playwright suite starts fresh backend and frontend processes automatically and runs Chromium, WebKit, and Firefox projects. Stop development/preview servers on ports 8080 and 5173 first; tests intentionally do not reuse them. See [docs/TESTING.md](docs/TESTING.md) for coverage and the honest manual-browser record.

## Privacy and limitations

The optional anonymous telemetry endpoint accepts only allowlisted error/performance fields. It must never receive nicknames, cards, room or session tokens, chat, or hand histories. See [docs/PRIVACY.md](docs/PRIVACY.md).

This MVP is intentionally ephemeral: restarting the backend loses all rooms and active matches. It is not configured for production hosting, durable storage, authentication, moderation, or money movement.

Live-session tokens are held only in page memory. Temporary transport loss can resume that session; refreshing or leaving the page abandons it. A refreshed invitation/game link offers rejoining, which may enter as a spectator during a match. The optional practice percentage is an unvalidated visible-card heuristic, not an actual win-probability calculation. Remaining release acceptance is tracked in [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

## Open-source origin

Project River is derived from the MIT-licensed [Elite Poker](https://github.com/opadips/Elite-Poker) project. See [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE) for attribution and license details.
