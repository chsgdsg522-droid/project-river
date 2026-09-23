# Project River

Project River is a responsive Texas Hold'em game for private friend rooms, solo practice, and beginner learning. It uses virtual chips only and does not support deposits, withdrawals, cash prizes, or real-world rewards.

The MVP is designed for six seats, one to six human players, bot-filled open seats, and a fixed ten-hand match. Chinese is the primary interface language, with international poker terms shown alongside key actions.

## Status

Development is local-first. Rooms live only in server memory and disappear when the server restarts. No public deployment is configured yet.

## Requirements

- Node.js 20 or newer
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

## Verify

```bash
npm test
npm run build
npm run test:e2e
npm run check
```

## Open-source origin

Project River is derived from the MIT-licensed [Elite Poker](https://github.com/opadips/Elite-Poker) project. See [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE) for attribution and license details.
