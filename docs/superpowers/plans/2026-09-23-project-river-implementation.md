# Project River Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally runnable, responsive, play-money-only six-seat Texas Hold'em web game with private rooms, bots, a fixed ten-hand match, beginner teaching, and secure per-player realtime state.

**Architecture:** Start from the MIT-licensed Elite Poker code, keep its React/Vite and Node/Express/WebSocket shape, and replace its public-lobby/casino features with focused private-room modules. The server remains authoritative: a pure game engine emits state, room/session services own realtime lifecycle, and a recipient-aware projector prevents hidden information from crossing the socket boundary. Practice mode uses a normal private server room populated by bots, so friend games and practice cannot drift into two rule implementations.

**Tech Stack:** Node.js 20+, JavaScript ESM, React 18, Vite 4, React Router 6, Express 4, `ws` 8, Tailwind CSS 3, Vitest, React Testing Library, `@testing-library/user-event`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-project-river-design.md`

## Global Constraints

- Preserve the upstream MIT `LICENSE`, original copyright notice, and an explicit Elite Poker attribution in `README.md`.
- The product uses virtual chips only: no recharge, withdrawal, cash prizes, real-world rewards, or real-money mechanics.
- Chinese is the primary UI language; the poker terms Fold, Check, Call, Bet, Raise, All-in, Pot, Flop, Turn, River, Showdown, Dealer/D, SB, and BB appear bilingually.
- One table has at most 6 seats, each participant starts with 1,000 chips, and one match lasts at most 10 hands.
- Blinds are 10/20 for hands 1–4, 20/40 for hands 5–7, and 40/80 for hands 8–10.
- Each action has 15 seconds; timeout checks when legal and folds otherwise.
- A disconnected human keeps the seat for 30 seconds, then a bot takes over; a returning human resumes immediately before a new hand starts or at the following hand boundary.
- A room with no connected human for 30 minutes is destroyed.
- No database is introduced in the MVP; rooms are in memory and profile, preferences, and aggregate statistics are local to the browser.
- Friend games never show equity or recommended strategy. Practice mode may show equity, pot odds, and explanations.
- The browser must never receive another player's unrevealed hole cards; logs must never include hole cards, nicknames, free-form chat, or a full hand history.
- Support current Chrome, Safari, Edge, and Firefox, including a complete 320px-wide mobile layout.
- Support dark/light themes, two-color/four-color cards, mute, reduced motion, keyboard actions, and touch targets of at least 44px.
- No free-text chat, accounts, public lobby, matchmaking, side bets, achievements, persistent hand replay, or multi-mode tournament system.
- Do not add production hosting until the deployment budget and provider are separately approved.

## Review Focus

1. A short all-in below the minimum full raise must not reopen raising for players who already acted; calling and folding must remain legal.
2. Every player and spectator must receive a different safe view: only the owner sees live hole cards, folded cards stay hidden, and only showdown-eligible cards are revealed.
3. Duplicate or stale actions caused by double-clicks and delayed sockets must change chips and turn state at most once and return the newest safe state.
4. Disconnects exactly at action and hand boundaries must not create two actors, skip a turn, lose host ownership incorrectly, or let a human and bot control one seat simultaneously.
5. A 24-character mixed Chinese/Latin nickname containing HTML metacharacters must render as inert text without overflowing the 320px game layout.

---

## File Structure

All paths below are relative to the new Project River repository root created from `work/elite-poker-reference`.

```text
LICENSE                              Upstream MIT license, unchanged
NOTICE.md                            Fork attribution and third-party notice
README.md                            Product boundaries and local commands
package.json                         npm workspaces and repository-wide checks
backend/
  package.json                       backend scripts and test dependencies
  server.js                          production entry point only
  src/createServer.js                Express/WebSocket composition root
  src/config.js                      validated environment/default values
  src/protocol.js                    inbound message parsing and outbound event names
  src/RoomManager.js                 private room lifecycle and expiry
  src/SessionRegistry.js             socket, player token, and reconnect ownership
  src/RoomView.js                    recipient-aware state projection
  src/TurnClock.js                   single authoritative 15-second action timer
  src/game/Game.js                   authoritative hand state machine
  src/game/Deck.js                   injectable secure shuffle
  src/game/HandEvaluator.js          five-to-seven-card comparison
  src/game/Player.js                 seat/chips/bet/fold/all-in state
  src/game/BettingRound.js           action order and raise reopening rules
  src/game/PlayerActionValidator.js  legal actions and raise-to limits
  src/game/PotManager.js             main/side pots and split payouts
  src/game/MatchController.js        ten-hand schedule, elimination, summary, rematch
  src/bots/personas.js               five named bot parameter sets
  src/bots/BotPolicy.js              visible-state-only decision function
  src/bots/BotController.js          scheduled bot turns and takeover control
  test/                              backend unit and integration tests
frontend/
  package.json                       UI scripts and test dependencies
  src/main.jsx                       browser entry
  src/app/App.jsx                    routes and providers
  src/app/AppProviders.jsx           theme, preferences, profile, and socket contexts
  src/pages/HomePage.jsx             create/join/practice/tutorial entry points
  src/pages/RoomPage.jsx             six-seat waiting room
  src/pages/GamePage.jsx             responsive live table
  src/pages/TutorialPage.jsx         scripted three-minute lesson
  src/pages/ResultsPage.jsx          final ranking and rematch
  src/components/poker/              cards, seats, board, action dock, raise sheet
  src/components/room/               seat grid, invite panel, host controls
  src/components/common/             avatar, dialog, bilingual term, settings
  src/features/practice/             practice helpers and optional learning panel
  src/lib/socketClient.js            reconnecting client and action IDs
  src/lib/storage.js                 validated local profile/preferences/statistics
  src/lib/terms.js                   bilingual term dictionary
  src/styles/tokens.css              dark/light design tokens
  src/styles/game.css                responsive table and action layout
  src/test/                          UI setup, fixtures, and component tests
e2e/
  match.spec.js                      two-browser ten-hand journey
  responsive.spec.js                 320px and desktop behavior
  privacy.spec.js                    socket payload privacy checks
playwright.config.js                 starts both local services
```

## Milestone 1 — Trusted Rules Core

### Task 1: Import the MIT Base and Establish the Test Harness

**Files:**
- Create: `package.json`
- Create: `NOTICE.md`
- Create: `README.md`
- Create: `docs/superpowers/specs/2026-09-23-project-river-design.md` by copying the approved spec without changing its decisions
- Create: `docs/superpowers/plans/2026-09-23-project-river-implementation.md` by copying this approved plan
- Move: `backend/game/*.js` to `backend/src/game/*.js`
- Move: backend runtime modules retained by later tasks into `backend/src/`
- Create: `backend/src/config.js`
- Create: `backend/test/smoke.test.js`
- Create: `frontend/src/test/setup.js`
- Create: `frontend/src/app/App.jsx`
- Create: `frontend/src/app/App.test.jsx`
- Create: `playwright.config.js`
- Modify: `backend/package.json`
- Modify: `frontend/package.json`
- Preserve: `LICENSE`

**Interfaces:**
- Consumes: the checked-out Elite Poker source at tag `1.0.2` / commit `4e38645`.
- Produces: root commands `npm run test`, `npm run build`, and `npm run test:e2e`; backend tests run in Node and frontend tests run in jsdom.

- [ ] **Step 1: Create the repository from the audited source**

Copy tracked files from `work/elite-poker-reference` into the implementation worktree without copying its `.git` directory. Confirm `LICENSE` still contains the upstream MIT notice, then initialize the user's public repository only if it is not already a Git repository.

Copy the approved spec and this plan from the task output directory into the exact `docs/superpowers/...` paths named above so both documents travel with the implementation. Move the retained backend source under `backend/src/`, update relative imports, and leave tests under `backend/test/`; do not keep a second live copy under `backend/game/`.

Run: `git status --short && git rev-parse --show-toplevel`

Expected: the implementation root is reported and no file outside that root is staged.

- [ ] **Step 2: Write failing backend and frontend smoke tests**

```js
// backend/test/smoke.test.js
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../src/config.js';

describe('Project River defaults', () => {
  it('pins the agreed match rules', () => {
    expect(DEFAULT_RULES).toMatchObject({ seats: 6, startingChips: 1000, maxHands: 10, actionMs: 15000 });
  });
});
```

```jsx
// frontend/src/app/App.test.jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';

it('shows the play-money boundary on the home route', () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(screen.getByText('仅使用虚拟筹码，不支持充值、提现或现实奖励。')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the tests and confirm the harness is missing**

Run: `npm test`

Expected: FAIL because the root workspace scripts, Vitest setup, `DEFAULT_RULES`, or the new App module do not exist yet.

- [ ] **Step 4: Add workspace scripts, test dependencies, and fixed defaults**

```json
{
  "name": "project-river",
  "private": true,
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "test": "npm run test -w backend && npm run test -w frontend",
    "build": "npm run build -w frontend",
    "test:e2e": "playwright test",
    "check": "npm test && npm run build"
  },
  "devDependencies": { "@playwright/test": "^1.55.0" }
}
```

```js
// backend/src/config.js
export const DEFAULT_RULES = Object.freeze({
  seats: 6,
  startingChips: 1000,
  maxHands: 10,
  actionMs: 15_000,
  reconnectMs: 30_000,
  roomIdleMs: 30 * 60_000,
});
```

Add `vitest` to both workspaces; add `jsdom`, React Testing Library, `jest-dom`, and `user-event` to the frontend. Configure frontend test setup to import `@testing-library/jest-dom/vitest`. Replace the old landing route with the exact play-money sentence used by the test.

- [ ] **Step 5: Document provenance and local commands**

`NOTICE.md` must identify Elite Poker, its repository URL, tag/commit, MIT license, and that Project River changes the product scope and interface. `README.md` must state the virtual-chip boundary and give exact install, development, test, build, and E2E commands.

- [ ] **Step 6: Verify and commit the foundation**

Run: `npm install && npm test && npm run build`

Expected: both smoke tests PASS and Vite produces `frontend/dist`.

```bash
git add LICENSE NOTICE.md README.md package.json package-lock.json backend frontend playwright.config.js
git commit -m "chore: establish Project River test baseline"
```

### Task 2: Make Decks and Hand Evaluation Deterministic and Testable

**Files:**
- Modify: `backend/src/game/Deck.js`
- Modify: `backend/src/game/HandEvaluator.js`
- Create: `backend/src/game/random.js`
- Create: `backend/test/deck.test.js`
- Create: `backend/test/handEvaluator.test.js`

**Interfaces:**
- Consumes: `crypto.randomInt(maxExclusive)` through an adapter.
- Produces: `createDeck(): Card[]`, `shuffle(cards, randomInt): Card[]`, `evaluateBest(cards): HandRank`, and `compareHands(a, b): -1 | 0 | 1`.
- `Card` is `{ rank: '2'|'3'|...|'A', suit: 'clubs'|'diamonds'|'hearts'|'spades' }`.
- `HandRank` is `{ category: 0|1|2|3|4|5|6|7|8, kickers: number[], label: string }`; higher comparison value wins.

- [ ] **Step 1: Pin shuffle injection and evaluator edge cases with failing tests**

```js
it('uses the supplied random source for every Fisher-Yates swap', () => {
  const calls = [];
  const result = shuffle(['A', 'B', 'C'], max => (calls.push(max), 0));
  expect(calls).toEqual([3, 2]);
  expect(result).toEqual(['B', 'C', 'A']);
});

it('uses the board when it is the best five-card hand', () => {
  const board = cards('Ah Kh Qh Jh Th');
  expect(compareHands(evaluateBest([...board, ...cards('2c 3d')]), evaluateBest([...board, ...cards('4s 5s')]))).toBe(0);
});

it('orders wheel straight below six-high straight', () => {
  expect(compareHands(evaluateBest(cards('As 2d 3c 4h 5s 9d Tc')), evaluateBest(cards('2s 3d 4c 5h 6s 9c Td')))).toBe(-1);
});
```

- [ ] **Step 2: Run the focused tests to observe the current defects**

Run: `npm test -w backend -- deck.test.js handEvaluator.test.js`

Expected: FAIL because shuffle is coupled to `Math.random`, the new API does not exist, or an evaluator regression is exposed.

- [ ] **Step 3: Implement a secure, injectable Fisher-Yates shuffle and normalized ranks**

```js
// backend/src/game/random.js
import { randomInt as nodeRandomInt } from 'node:crypto';
export const secureRandomInt = maxExclusive => nodeRandomInt(maxExclusive);

// backend/src/game/Deck.js
export function shuffle(input, randomInt = secureRandomInt) {
  const cards = [...input];
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
```

Keep evaluator output free of UI strings except the stable `label`; test all nine hand categories, kicker ordering, board ties, and seven-card selection.

- [ ] **Step 4: Verify and commit**

Run: `npm test -w backend -- deck.test.js handEvaluator.test.js`

Expected: PASS with 52 unique cards, deterministic injected shuffles, and all comparison cases.

```bash
git add backend/src/game backend/test/deck.test.js backend/test/handEvaluator.test.js
git commit -m "feat: harden deck and hand evaluation"
```

### Task 3: Implement Legal Actions, Raise-to Semantics, and Side Pots

**Files:**
- Modify: `backend/src/game/Player.js`
- Modify: `backend/src/game/BettingRound.js`
- Modify: `backend/src/game/PlayerActionValidator.js`
- Modify: `backend/src/game/PotManager.js`
- Create: `backend/test/legalActions.test.js`
- Create: `backend/test/bettingRound.test.js`
- Create: `backend/test/potManager.test.js`

**Interfaces:**
- Consumes: player street commitments, stacks, folded/all-in flags, current highest street bet, and last full raise size.
- Produces: `getLegalActions(state, playerId): LegalActions` where `LegalActions` is `{ fold: boolean, check: boolean, callAmount: number|null, bet: {minTo:number,maxTo:number}|null, raise: {minTo:number,maxTo:number,reopened:boolean}|null, allInTo:number }`.
- Produces: `applyAction(state, playerId, action): ActionResult`, where `action` is `{ type:'fold'|'check'|'call'|'bet'|'raise'|'allIn', raiseTo?:number }` and `ActionResult` is `{ state, event }` or throws `GameRuleError` without mutating input.
- Produces: `buildPots(players): Pot[]` and `awardPots(pots, rankedPlayerIds, buttonSeat): Payout[]`; odd chips move clockwise from the button among tied winners.

- [ ] **Step 1: Write failing action and pot tests, including Review Focus item 1**

```js
it('does not reopen raising after a short all-in', () => {
  const state = bettingState({ currentBet: 100, lastFullRaise: 60, acted: ['a'], stacks: { a: 900, b: 30, c: 900 } });
  const after = applyAction(state, 'b', { type: 'allIn' }).state;
  const legal = getLegalActions(after, 'a');
  expect(legal.callAmount).toBe(30);
  expect(legal.raise).toBeNull();
  expect(legal.fold).toBe(true);
});

it('interprets raiseTo as the total street commitment', () => {
  const state = bettingState({ currentBet: 80, lastFullRaise: 80, committed: { hero: 80 }, stacks: { hero: 920 } });
  const after = applyAction(state, 'hero', { type: 'raise', raiseTo: 320 }).state;
  expect(after.players.hero.streetCommitment).toBe(320);
  expect(after.players.hero.stack).toBe(680);
});

it('builds and splits nested all-in pots without losing a chip', () => {
  const pots = buildPots(playersWithCommitments({ a: 100, b: 250, c: 250 }));
  expect(pots.map(p => p.amount)).toEqual([300, 300]);
  expect(awardPots(pots, [['a'], ['b', 'c']], 5).reduce((n, p) => n + p.amount, 0)).toBe(600);
});
```

- [ ] **Step 2: Confirm failures against the inherited increment-based behavior**

Run: `npm test -w backend -- legalActions.test.js bettingRound.test.js potManager.test.js`

Expected: FAIL on `raiseTo`, short-all-in reopening, or deterministic odd-chip payout.

- [ ] **Step 3: Implement immutable validation before mutation**

```js
export function getLegalActions(state, playerId) {
  const player = state.players[playerId];
  const callAmount = Math.min(player.stack, Math.max(0, state.currentBet - player.streetCommitment));
  const maxTo = player.streetCommitment + player.stack;
  const minTo = state.currentBet === 0 ? state.bigBlind : state.currentBet + state.lastFullRaise;
  return {
    fold: state.currentBet > player.streetCommitment,
    check: state.currentBet === player.streetCommitment,
    callAmount: state.currentBet > player.streetCommitment ? callAmount : null,
    bet: state.currentBet === 0 && maxTo >= minTo ? { minTo, maxTo } : null,
    raise: state.raisingOpenFor.has(playerId) && maxTo > state.currentBet
      ? { minTo: Math.min(minTo, maxTo), maxTo, reopened: maxTo >= minTo }
      : null,
    allInTo: maxTo,
  };
}
```

Validate integer, finite, non-negative chip amounts; reject checks facing a bet, undercalls except exact all-in, and raises above stack. Update the last full raise only when the increment reaches the previous minimum. Build pots from commitment levels and never award folded players.

- [ ] **Step 4: Add conservation and invalid-input assertions**

Extend the tests to assert total chips before/after every action and payout, rejection of `NaN`, decimal, negative, and over-stack amounts, early win when all opponents fold, and a three-layer side pot with a tied main pot.

- [ ] **Step 5: Verify and commit**

Run: `npm test -w backend -- legalActions.test.js bettingRound.test.js potManager.test.js`

Expected: PASS; every fixture conserves chips exactly.

```bash
git add backend/src/game backend/test/legalActions.test.js backend/test/bettingRound.test.js backend/test/potManager.test.js
git commit -m "feat: enforce holdem betting and side-pot rules"
```

### Task 4: Complete Hand Flow, Heads-up Order, and the Ten-Hand Match

**Files:**
- Modify: `backend/src/game/Game.js`
- Modify: `backend/src/game/HandLifecycle.js`
- Create: `backend/src/game/MatchController.js`
- Create: `backend/test/gameFlow.test.js`
- Create: `backend/test/matchController.test.js`

**Interfaces:**
- Consumes: Task 2 deck/evaluator and Task 3 betting/pot APIs.
- Produces: `new Game({ players, rules, randomInt })`, `game.startMatch()`, `game.dispatch(playerId, action)`, and `game.snapshot()`.
- Produces: `MatchController.blindsFor(handNumber): {smallBlind:number,bigBlind:number}`, `afterHand(game, result): MatchStatus`, and `reset(players): GameState`.
- `MatchStatus` is `{ handNumber, complete, reason:'tenHands'|'lastPlayer'|null, rankings: Ranking[]|null, summary: MatchSummary|null }`.

- [ ] **Step 1: Write failing heads-up and match schedule tests**

```js
it('makes the button post SB and act first preflop heads-up', () => {
  const game = riggedGame({ seats: ['a', 'b'], button: 'a' });
  game.startMatch();
  expect(game.snapshot()).toMatchObject({ buttonId: 'a', smallBlindId: 'a', bigBlindId: 'b', actorId: 'a' });
});

it.each([[1,10,20], [4,10,20], [5,20,40], [7,20,40], [8,40,80], [10,40,80]])(
  'uses the correct blinds for hand %i', (hand, sb, bb) => {
    expect(new MatchController().blindsFor(hand)).toEqual({ smallBlind: sb, bigBlind: bb });
  }
);

it('ends after hand ten with tied ranks preserved', () => {
  const status = finishMatchWithStacks({ a: 1500, b: 1500, c: 0 }, 10);
  expect(status.rankings.map(r => [r.playerId, r.rank])).toEqual([['a', 1], ['b', 1], ['c', 3]]);
});
```

- [ ] **Step 2: Run and confirm inherited lifecycle violations**

Run: `npm test -w backend -- gameFlow.test.js matchController.test.js`

Expected: FAIL because the inherited code resets busted stacks, lacks the ten-hand schedule, or mishandles heads-up blinds.

- [ ] **Step 3: Make Game the only hand state machine**

```js
export class MatchController {
  blindsFor(handNumber) {
    if (handNumber <= 4) return { smallBlind: 10, bigBlind: 20 };
    if (handNumber <= 7) return { smallBlind: 20, bigBlind: 40 };
    return { smallBlind: 40, bigBlind: 80 };
  }

  isComplete(game) {
    return game.handNumber >= 10 || game.players.filter(p => p.stack > 0).length <= 1;
  }
}
```

Remove every automatic stack reset. Rotate the button over eliminated seats, implement heads-up preflop/postflop order, end a hand after one eligible player remains, and retain only aggregate match counters: hands won, largest pot, and peak chip increase. `snapshot()` must remain an internal full state and must not be sent directly over WebSocket.

- [ ] **Step 4: Test all street boundaries and rematch reset**

Add scripted checks for preflop → flop → turn → river → showdown, all-in runout without extra actions, eliminated-player skipping, early match completion, and `reset()` restoring 1,000 chips while preserving seat ownership.

- [ ] **Step 5: Verify and commit**

Run: `npm test -w backend -- gameFlow.test.js matchController.test.js`

Expected: PASS with no negative stacks and a stable result summary after the tenth hand.

```bash
git add backend/src/game backend/test/gameFlow.test.js backend/test/matchController.test.js
git commit -m "feat: add ten-hand match lifecycle"
```

## Milestone 2 — Safe Realtime Rooms

### Task 5: Define the Protocol and Recipient-safe Views

**Files:**
- Create: `backend/src/protocol.js`
- Create: `backend/src/RoomView.js`
- Create: `backend/test/protocol.test.js`
- Create: `backend/test/roomView.test.js`
- Remove after migration: `backend/src/game/dealerMessages.js`

**Interfaces:**
- Consumes: `Game.snapshot()` only inside the server process.
- Produces: `parseClientMessage(raw): ClientMessage`, where client message types are `room.create`, `room.join`, `room.start`, `room.kick`, `room.bot.add`, `room.bot.remove`, `game.action`, `quickChat.send`, `match.rematch`, and `session.resume`.
- Every `game.action` is `{type:'game.action', roomCode, handId, actionId, action:{type,raiseTo?}}`.
- Produces: `projectRoom(room, recipient): RoomView`; `recipient` is `{playerId:string|null, role:'player'|'spectator'}`.
- Outbound envelope is `{type, revision, payload}` and every room-scoped response includes the current `revision`.

- [ ] **Step 1: Write protocol rejection and hidden-card tests, including Review Focus item 2**

```js
it('rejects an unknown message type without echoing input', () => {
  expect(() => parseClientMessage(JSON.stringify({ type: 'admin.win', cards: ['As'] }))).toThrow('UNSUPPORTED_MESSAGE');
});

it('projects different hole cards for owner, opponent, and spectator', () => {
  const room = roomAtFlop({ hero: ['As', 'Ah'], villain: ['Ks', 'Kh'] });
  expect(projectRoom(room, player('hero')).game.players.hero.holeCards).toEqual(['As', 'Ah']);
  expect(projectRoom(room, player('hero')).game.players.villain.holeCards).toBeUndefined();
  expect(projectRoom(room, spectator()).game.players.hero.holeCards).toBeUndefined();
});

it('reveals only showdown-eligible hands and never folded cards', () => {
  const view = projectRoom(roomAtShowdown({ live: ['As','Ah'], folded: ['Ks','Kh'] }), spectator());
  expect(view.game.players.live.holeCards).toEqual(['As','Ah']);
  expect(view.game.players.folded.holeCards).toBeUndefined();
});
```

- [ ] **Step 2: Run and expose the inherited broadcast leak**

Run: `npm test -w backend -- protocol.test.js roomView.test.js`

Expected: FAIL because inherited `getState()` contains all hole cards or no strict parser exists.

- [ ] **Step 3: Implement allowlisted parsing and a fresh projected object**

```js
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
    ...(canSee ? { holeCards: [...source.holeCards] } : {}),
  };
}
```

Reject payloads larger than 8 KiB, malformed JSON, missing fields, unknown keys on security-sensitive actions, room codes outside `[A-Z2-9]{6}`, action IDs outside `[a-zA-Z0-9_-]{8,64}`, and `raiseTo` values that are not safe non-negative integers. Validate a trimmed nickname as 1–24 Unicode code points containing only Chinese characters, letters, numbers, spaces, `_`, or `-`, and require one of the six bundled avatar IDs. Construct views field-by-field; never clone the internal snapshot and delete secrets afterward.

- [ ] **Step 4: Add a source scan guard**

Add a test that reads `backend/src` and fails if `socket.send(JSON.stringify(game.snapshot()))`, `console.log` with `holeCards`, or the removed unrestricted dealer message module reappears.

- [ ] **Step 5: Verify and commit**

Run: `npm test -w backend -- protocol.test.js roomView.test.js`

Expected: PASS and serialized opponent/spectator payloads contain neither card codes nor a `holeCards` key before showdown.

```bash
git add backend/src/protocol.js backend/src/RoomView.js backend/test
git rm backend/src/game/dealerMessages.js
git commit -m "feat: add safe recipient-specific game protocol"
```

### Task 6: Build Private Rooms, Seats, Host Controls, and Spectating

**Files:**
- Create: `backend/src/RoomManager.js`
- Create: `backend/test/roomManager.test.js`
- Modify: `backend/src/config.js`
- Remove after migration: `backend/LobbyManager.js`
- Remove after migration: `backend/handlers/lobbyHandlers.js`
- Remove: `backend/WaitlistManager.js`
- Remove: `backend/LobbyChatStore.js`

**Interfaces:**
- Consumes: `new Game(...)`, `DEFAULT_RULES`, and an injected `randomCode()`/clock.
- Produces: `createRoom(hostProfile): {room, playerToken}`, `joinRoom(code, profile): JoinResult`, `startRoom(code, actorId)`, `kick(code, actorId, targetId)`, `addBot(code, actorId, personaId)`, `removeBot(code, actorId, seat)`, `queueSpectator(code, profile)`, `rematch(code, actorId)`, and `expireIdleRooms(now)`.
- `Room` contains `code`, `phase:'waiting'|'playing'|'results'`, six ordered seats, spectators, `hostPlayerId`, `revision`, timestamps, a `Game|null`, and aggregate-only result data.

- [ ] **Step 1: Write failing private-room tests**

```js
it('creates a six-seat room with one human and five distinct bots', () => {
  const { room } = manager.createRoom(profile('host'));
  expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
  expect(room.seats).toHaveLength(6);
  expect(room.seats.filter(s => s.kind === 'human')).toHaveLength(1);
  expect(new Set(room.seats.filter(s => s.kind === 'bot').map(s => s.personaId)).size).toBe(5);
});

it('requires at least one human and two total participants to start', () => {
  const { room } = manager.createRoom(profile('host'));
  removeBotsUntil(room, 1);
  expect(() => manager.startRoom(room.code, room.hostPlayerId)).not.toThrow();
  removeLastOpponent(room);
  expect(() => manager.startRoom(room.code, room.hostPlayerId)).toThrow('NOT_ENOUGH_PLAYERS');
});

it('puts mid-match joins into spectator state until rematch', () => {
  const { room } = startedRoom(manager);
  const joined = manager.joinRoom(room.code, profile('late'));
  expect(joined.role).toBe('spectator');
});
```

- [ ] **Step 2: Confirm the public-lobby model cannot pass**

Run: `npm test -w backend -- roomManager.test.js`

Expected: FAIL because `RoomManager` and six-character private codes do not exist.

- [ ] **Step 3: Implement collision-safe private rooms and explicit authorization**

```js
createRoom(profile) {
  const code = this.generateUniqueCode();
  const host = this.createHumanSeat(profile, 0);
  const bots = this.personas.map((personaId, index) => this.createBotSeat(personaId, index + 1));
  const room = { code, phase: 'waiting', seats: [host, ...bots], spectators: [], hostPlayerId: host.playerId, revision: 1, game: null };
  this.rooms.set(code, room);
  return { room, playerToken: this.issueToken(host.playerId) };
}
```

Generate codes from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` with cryptographic randomness and retry collisions. Only the host may start, kick, add/remove bots, or rematch. A host cannot kick themselves. While waiting, each newly joined human replaces the highest-numbered bot seat; only a table already containing six humans sends another joiner to spectating. During a match every joiner spectates. On rematch, promote queued spectators into open seats in join order before filling remaining seats with the selected bots.

- [ ] **Step 4: Test room expiry and host transfer prerequisites**

Assert an occupied/connected room is retained, an empty room at 29:59 is retained, and an empty room at 30:00 is deleted. Assert host selection uses the earliest `joinedAt` among connected humans.

- [ ] **Step 5: Verify and remove out-of-scope lobby modules**

Run: `npm test -w backend -- roomManager.test.js`

Expected: PASS with no public room listing API and no password/waitlist/free-chat dependency.

```bash
git add backend/src/RoomManager.js backend/src/config.js backend/test/roomManager.test.js
git rm backend/LobbyManager.js backend/handlers/lobbyHandlers.js backend/WaitlistManager.js backend/LobbyChatStore.js
git commit -m "feat: replace public lobbies with private rooms"
```

### Task 7: Add Idempotent Actions, Sessions, Reconnect, and One Turn Clock

**Files:**
- Create: `backend/src/SessionRegistry.js`
- Create: `backend/src/TurnClock.js`
- Create: `backend/test/sessionRegistry.test.js`
- Create: `backend/test/turnClock.test.js`
- Create: `backend/test/actionIdempotency.test.js`
- Modify: `backend/src/RoomManager.js`
- Remove after migration: `backend/ClientRegistry.js`
- Remove after migration: `backend/utils/timerUtils.js`

**Interfaces:**
- Consumes: room/player IDs and parsed `game.action` messages.
- Produces: `SessionRegistry.issue(playerId): string`, `attach(token, socket): Session`, `disconnect(socket, now)`, and `claimControl(token, now): {playerId,resumeAt:'now'|'nextHand'}`.
- Produces: `TurnClock.start({roomCode, handId, actorId, deadline, onExpire})`, `cancel(roomCode)`, and `remaining(roomCode, now): number`.
- `RoomManager.applyGameAction(playerId, message)` stores up to 256 recent `(handId, actionId)` results per player and returns the prior result for duplicates.

- [ ] **Step 1: Write failing idempotency and boundary-race tests, including Review Focus items 3 and 4**

```js
it('applies a duplicated socket action exactly once', () => {
  const message = actionMessage({ handId: 'h3', actionId: 'click_0001', type: 'call' });
  const first = manager.applyGameAction('hero', message);
  const second = manager.applyGameAction('hero', message);
  expect(second).toEqual(first);
  expect(manager.room('ABC234').game.player('hero').stack).toBe(980);
});

it('ignores a stale timeout after the actor changes', () => {
  clock.start({ roomCode: 'ABC234', handId: 'h1', actorId: 'a', deadline: 15000, onExpire });
  advanceGameActorTo('b');
  timers.advanceTimersByTime(15000);
  expect(onExpire).not.toHaveBeenCalled();
});

it('gives a reconnecting human one controller at a hand boundary', () => {
  disconnectAtRiver('hero', 30_001);
  finishCurrentHandWithBot('hero');
  const session = registry.claimControl(heroToken, now());
  expect(session.resumeAt).toBe('nextHand');
  expect(activeControllersFor('hero')).toEqual(['human']);
});
```

- [ ] **Step 2: Run tests with fake timers**

Run: `npm test -w backend -- sessionRegistry.test.js turnClock.test.js actionIdempotency.test.js`

Expected: FAIL because disconnect currently removes players immediately, timers are hard-coded/polled, and actions are not deduplicated.

- [ ] **Step 3: Implement token ownership and generation-guarded timers**

```js
start({ roomCode, handId, actorId, deadline, onExpire }) {
  this.cancel(roomCode);
  const generation = Symbol(roomCode);
  const timeoutId = this.setTimeout(() => {
    const current = this.entries.get(roomCode);
    if (current?.generation === generation && current.handId === handId && current.actorId === actorId) onExpire();
  }, Math.max(0, deadline - this.now()));
  this.entries.set(roomCode, { generation, handId, actorId, deadline, timeoutId });
}
```

Tokens must contain at least 128 random bits and are never placed in logs. Mark disconnection time without clearing the seat. Before 30 seconds, a turn timeout checks or folds as usual. At 30 seconds, assign exactly one bot controller. Reattachment replaces the old socket; if the bot has started the next hand, queue human control for the next hand. Transfer host only when the 30-second reservation ends, selecting the earliest joined connected human.

- [ ] **Step 4: Add stale-hand and out-of-order action checks**

Assert wrong `handId`, wrong actor, old room revision, and reused `actionId` with different contents return error codes `STALE_HAND`, `NOT_YOUR_TURN`, `STALE_REVISION`, and `ACTION_ID_CONFLICT`; none changes chips. Assert timeout action is Check when legal and Fold otherwise.

- [ ] **Step 5: Verify and commit**

Run: `npm test -w backend -- sessionRegistry.test.js turnClock.test.js actionIdempotency.test.js`

Expected: PASS under fake time at 14,999 ms, 15,000 ms, 29,999 ms, and 30,000 ms boundaries.

```bash
git add backend/src backend/test
git rm backend/ClientRegistry.js backend/utils/timerUtils.js
git commit -m "feat: make realtime control reconnect-safe and idempotent"
```

### Task 8: Add Five Visible-information-only Bot Personas

**Files:**
- Create: `backend/src/bots/personas.js`
- Create: `backend/src/bots/BotPolicy.js`
- Create: `backend/src/bots/BotController.js`
- Create: `backend/test/botPolicy.test.js`
- Create: `backend/test/botSimulation.test.js`
- Modify: `backend/src/RoomManager.js`

**Interfaces:**
- Consumes: `decideBotAction({personaId, visibleState, legalActions, random}): GameAction`; `visibleState` is the same shape a player view exposes plus the bot's own cards.
- Produces: five stable personas: `songguo` (loose), `yanshu` (tight), `xiaoman` (aggressive), `ace` (balanced/position-aware), and `youyou` (variable/slow-play).
- `BotController.maybeAct(room)` schedules one decision for the current bot actor and cancels it when room/hand/actor changes.

- [ ] **Step 1: Write failing legality, information-boundary, and distribution tests**

```js
it.each(['songguo','yanshu','xiaoman','ace','youyou'])('%s always returns a legal action', personaId => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const input = generatedVisibleDecision(seed);
    expect(actionIsLegal(decideBotAction({ personaId, ...input }), input.legalActions)).toBe(true);
  }
});

it('cannot receive opponent hole cards', () => {
  const visibleState = projectRoom(botRoomAtTurn(), player('bot-a')).game;
  expect(Object.values(visibleState.players).filter(p => p.id !== 'bot-a').every(p => !('holeCards' in p))).toBe(true);
});

it('produces observable persona differences over fixed seeds', () => {
  const stats = simulateBotDecisions({ decisions: 5000, seed: 42 });
  expect(stats.songguo.vpip).toBeGreaterThan(stats.yanshu.vpip + 0.12);
  expect(stats.xiaoman.raiseRate).toBeGreaterThan(stats.yanshu.raiseRate + 0.08);
});
```

- [ ] **Step 2: Run and confirm bots are absent**

Run: `npm test -w backend -- botPolicy.test.js botSimulation.test.js`

Expected: FAIL because persona policy and bot controller are undefined.

- [ ] **Step 3: Implement bounded heuristic scores and legal-action clamping**

```js
export const PERSONAS = Object.freeze({
  songguo: { displayName: '松果', looseness: 0.78, aggression: 0.38, volatility: 0.14 },
  yanshu:  { displayName: '岩叔', looseness: 0.34, aggression: 0.30, volatility: 0.06 },
  xiaoman: { displayName: '小满', looseness: 0.58, aggression: 0.76, volatility: 0.18 },
  ace:     { displayName: '阿策', looseness: 0.50, aggression: 0.55, volatility: 0.08 },
  youyou:  { displayName: '悠悠', looseness: 0.52, aggression: 0.48, volatility: 0.28 },
});
```

Derive a coarse hand-strength bucket from the bot's cards and board, then adjust for position, call-to-pot ratio, number of opponents, and persona. Select only from `legalActions`; use server `raiseTo` values clamped to `[minTo,maxTo]`. Schedule bot decisions between 450 and 1,200 ms using an injected random source, but use zero delay in simulation tests.

- [ ] **Step 4: Run a full-match stress simulation**

Simulate at least 5,000 deterministic six-bot matches. Assert every match completes within a bounded number of actions, total chips remain 6,000, stacks never go negative, no illegal action is attempted, and persona metrics satisfy the tested separations.

- [ ] **Step 5: Verify and commit**

Run: `npm test -w backend -- botPolicy.test.js botSimulation.test.js`

Expected: PASS and the 5,000-match simulation completes locally without open timers.

```bash
git add backend/src/bots backend/src/RoomManager.js backend/test/botPolicy.test.js backend/test/botSimulation.test.js
git commit -m "feat: add five distinct poker bot personas"
```

### Task 9: Compose the WebSocket Server and Remove Out-of-scope Services

**Files:**
- Create: `backend/src/createServer.js`
- Create: `backend/test/server.integration.test.js`
- Modify: `backend/server.js`
- Modify: `backend/src/protocol.js`
- Remove after migration: `backend/MessageRouter.js`
- Remove after migration: `backend/BroadcastScheduler.js`
- Remove after migration: `backend/handlers/gameHandlers.js`
- Remove after migration: `backend/game/AchievementTracker.js`
- Remove: `backend/HandHistoryStore.js`
- Remove after migration: `backend/game/TournamentManager.js`

**Interfaces:**
- Consumes: `RoomManager`, `SessionRegistry`, `TurnClock`, `BotController`, `parseClientMessage`, and `projectRoom`.
- Produces: `createServer({port=0, now, timers, randomInt}): {httpServer, wsServer, services, start(), stop()}`.
- Sends `session.ready`, `room.state`, `game.error`, `quickChat.event`, and `server.notice` envelopes; room state is event-driven after a revision change, not a 500 ms full-state poll.

- [ ] **Step 1: Write a failing two-client integration test**

```js
it('creates, joins, starts, acts, and broadcasts safe views', async () => {
  const server = await testServer();
  const host = await connect(server.url);
  const guest = await connect(server.url);
  const created = await host.sendAndWait({ type: 'room.create', profile: safeProfile('房主') }, 'room.state');
  await guest.sendAndWait({ type: 'room.join', code: created.payload.code, profile: safeProfile('朋友') }, 'room.state');
  const started = await host.sendAndWait({ type: 'room.start', code: created.payload.code }, 'room.state');
  expect(started.payload.phase).toBe('playing');
  expect(JSON.stringify(await guest.latest('room.state'))).not.toContain(started.payload.game.self.holeCards.join(','));
  await server.stop();
});
```

- [ ] **Step 2: Run and confirm the old server cannot be controlled in-process**

Run: `npm test -w backend -- server.integration.test.js`

Expected: FAIL because the inherited server starts at import time and sends shared full states.

- [ ] **Step 3: Implement a testable composition root**

```js
export function createServer(deps = {}) {
  const app = express();
  const httpServer = createHttpServer(app);
  const wsServer = new WebSocketServer({ server: httpServer, maxPayload: 8 * 1024 });
  const services = createServices(deps);
  wireSockets(wsServer, services);
  app.get('/health', (_req, res) => res.json({ ok: true }));
  return {
    httpServer, wsServer, services,
    start: () => listen(httpServer, deps.port ?? 0),
    stop: () => closeAll(wsServer, httpServer, services),
  };
}
```

Rate-limit each socket to 20 messages per rolling second and close sustained abusers. Allow quick chat only from a fixed enum of 12 phrases/emojis and limit it to one event per 1.5 seconds. Add `POST /telemetry`, cap its JSON body at 2 KiB, accept only `kind`, `name`, `durationMs`, `route`, and `browserFamily`, and rate-limit it per IP. Emit structured logs containing room code hash, event name, duration, and error code only—never profile names, tokens, cards, action sequences, or full snapshots.

- [ ] **Step 4: Test lifecycle cleanup and 10-room load**

Create ten rooms with six connected clients each, start them, send legal actions, disconnect all clients, advance fake time, and assert all rooms/timers/sockets are released. Assert `stop()` leaves no open handles.

- [ ] **Step 5: Remove replaced features, verify, and commit**

Run: `npm test -w backend`

Expected: PASS with no achievement, side-bet, history, free-chat, public-lobby, or tournament imports.

```bash
git add backend/server.js backend/src backend/test
git rm backend/MessageRouter.js backend/BroadcastScheduler.js backend/handlers/gameHandlers.js backend/src/game/AchievementTracker.js backend/HandHistoryStore.js backend/src/game/TournamentManager.js
git commit -m "feat: compose secure private-room websocket server"
```

## Milestone 3 — Responsive Product Interface

### Task 10: Build the App Shell, Local Data, Themes, and Bilingual Terms

**Files:**
- Modify: `frontend/src/app/App.jsx`
- Create: `frontend/src/app/AppProviders.jsx`
- Create: `frontend/src/lib/storage.js`
- Create: `frontend/src/lib/terms.js`
- Create: `frontend/src/lib/telemetry.js`
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/components/common/Term.jsx`
- Create: `frontend/src/components/common/SettingsPanel.jsx`
- Create: `frontend/src/test/fixtures.js`
- Create: `frontend/src/lib/storage.test.js`
- Create: `frontend/src/lib/telemetry.test.js`
- Create: `frontend/src/components/common/Term.test.jsx`
- Modify: `frontend/src/main.jsx`
- Remove after replacement: `frontend/src/styles/themes.css`
- Remove after replacement: `frontend/src/components/ThemeSelector.jsx`
- Remove after replacement: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: browser `localStorage`, `matchMedia('(prefers-reduced-motion: reduce)')`, and router paths.
- Produces: `loadLocalState(storage): LocalState`, `saveProfile(profile)`, `savePreferences(preferences)`, and `recordMatch(summary)`.
- `Preferences` is `{theme:'dark'|'light', deck:'twoColor'|'fourColor', muted:boolean, reducedMotion:boolean}`.
- Routes are `/`, `/room/:code`, `/game/:code`, `/tutorial`, `/practice`, and `/results/:code`.

- [ ] **Step 1: Write failing storage and term tests**

```js
it('falls back safely when local storage is corrupt', () => {
  const storage = fakeStorage({ 'river.state.v1': '{broken' });
  expect(loadLocalState(storage)).toEqual(expect.objectContaining({ profile: null, statistics: { matches: 0, wins: 0 } }));
});

it('shows Chinese and international action terminology', () => {
  render(<Term id="raise" />);
  expect(screen.getByText('加注')).toBeVisible();
  expect(screen.getByText('Raise')).toBeVisible();
});
```

- [ ] **Step 2: Run the tests and observe missing modules**

Run: `npm test -w frontend -- storage.test.js Term.test.jsx`

Expected: FAIL because versioned storage and the term dictionary do not exist.

- [ ] **Step 3: Implement validated storage and exact terminology**

```js
export const TERMS = Object.freeze({
  fold: ['弃牌', 'Fold'], check: ['过牌', 'Check'], call: ['跟注', 'Call'],
  bet: ['下注', 'Bet'], raise: ['加注', 'Raise'], allIn: ['全下', 'All-in'],
  pot: ['底池', 'Pot'], flop: ['翻牌', 'Flop'], turn: ['转牌', 'Turn'], river: ['河牌', 'River'],
  showdown: ['摊牌', 'Showdown'], dealer: ['庄家', 'Dealer / D'], sb: ['小盲', 'Small Blind / SB'], bb: ['大盲', 'Big Blind / BB'],
});
```

Limit nicknames to 24 Unicode code points after trimming; permit Chinese, letters, numbers, spaces, `_`, and `-`; render names only through React text nodes. Use six bundled flat-illustration avatar IDs, not remote user images. Store only versioned profile, preferences, and aggregate stats—never room tokens or hand records beyond the current session memory.

- [ ] **Step 4: Add allowlisted anonymous telemetry**

`telemetry.js` may emit only `{kind:'error'|'performance', name, durationMs?, route, browserFamily}`. It must truncate `name` to 64 allowlisted characters, strip query strings from routes, sample performance entries, and never serialize component props, socket payloads, profile data, room codes, tokens, card codes, or action history. In tests, pass a profile, token, room code, and hole cards through a thrown error context and assert none appears in the submitted body. Send to the rate-limited `/telemetry` endpoint from Task 9.

- [ ] **Step 5: Implement semantic design tokens and accessibility preferences**

Define dark-first tokens for page, panel, table outline, text, muted text, border, accent, danger, success, and four suit colors. Apply `data-theme` and `data-deck`; respect reduced motion from either the OS or explicit preference. Settings controls must have accessible names and 44px minimum targets.

- [ ] **Step 6: Verify and commit**

Run: `npm test -w frontend -- storage.test.js telemetry.test.js Term.test.jsx && npm run build -w frontend`

Expected: PASS; both theme builds contain no inherited casino theme selector.

```bash
git add frontend/src
git rm frontend/src/styles/themes.css frontend/src/components/ThemeSelector.jsx frontend/src/App.jsx
git commit -m "feat: add Project River shell and local preferences"
```

### Task 11: Implement Home, Create/Join, and the Six-seat Waiting Room

**Files:**
- Create: `frontend/src/pages/HomePage.jsx`
- Create: `frontend/src/pages/RoomPage.jsx`
- Create: `frontend/src/components/room/SeatGrid.jsx`
- Create: `frontend/src/components/room/InvitePanel.jsx`
- Create: `frontend/src/components/room/HostControls.jsx`
- Create: `frontend/src/lib/socketClient.js`
- Create: `frontend/src/pages/HomePage.test.jsx`
- Create: `frontend/src/pages/RoomPage.test.jsx`
- Remove after replacement: `frontend/src/components/LobbyList.jsx`
- Remove after replacement: `frontend/src/components/CreateLobbyModal.jsx`

**Interfaces:**
- Consumes: Task 9 WebSocket envelopes and Task 10 local profile.
- Produces: `SocketClient.connect()`, `request(message)`, `subscribe(listener)`, `resume(token)`, and monotonically unique `nextActionId()`.
- `HomePage` creates a room, joins a normalized six-character code, launches practice, or opens tutorial.
- `RoomPage` shows exactly six ordered seats and exposes host controls only when `self.playerId === room.hostPlayerId`.

- [ ] **Step 1: Write failing user-flow tests**

```jsx
it('creates a room after choosing a valid local identity', async () => {
  renderHome({ socket: fakeSocket() });
  await user.type(screen.getByLabelText('昵称'), '河岸玩家');
  await user.click(screen.getByRole('button', { name: '创建好友房' }));
  expect(fakeSocket().sent).toContainEqual(expect.objectContaining({ type: 'room.create' }));
});

it('shows six seats and hides host actions from a guest', () => {
  renderRoom({ room: waitingRoomFixture(), selfId: 'guest' });
  expect(screen.getAllByTestId('room-seat')).toHaveLength(6);
  expect(screen.queryByRole('button', { name: '移除玩家' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and confirm inherited public-lobby UI fails**

Run: `npm test -w frontend -- HomePage.test.jsx RoomPage.test.jsx`

Expected: FAIL because current UI lists public lobbies and lacks the approved four-entry home.

- [ ] **Step 3: Build the private invite flow**

The home page must show, in this order, `创建好友房`, `加入房间`, `单人练习`, and `新手教程`, plus the exact play-money notice. Normalize pasted room URLs and lowercase codes to `[A-Z2-9]{6}`. The waiting room shows human/bot/empty state, connection state, host badge, copy-link and copy-code actions, bot add/remove, kick, and start. Disable start with an inline reason when fewer than two participants remain.

```js
export function parseRoomCode(input) {
  const match = input.trim().toUpperCase().match(/(?:ROOM\/)?([A-Z2-9]{6})$/);
  return match?.[1] ?? null;
}
```

- [ ] **Step 4: Test server errors and spectators**

Add tests for invalid code, missing room, kicked player, full room becoming spectator, server restart notice, copy fallback when Clipboard API is unavailable, and reconnecting banner. The client must never optimistically seat or remove a participant before a server revision arrives.

- [ ] **Step 5: Verify and commit**

Run: `npm test -w frontend -- HomePage.test.jsx RoomPage.test.jsx && npm run build -w frontend`

Expected: PASS with no public lobby, login, password, or account controls.

```bash
git add frontend/src
git rm frontend/src/components/LobbyList.jsx frontend/src/components/CreateLobbyModal.jsx
git commit -m "feat: build private room creation and waiting flow"
```

### Task 12: Build the Responsive Table, Raise Controls, Timer, Chat, Sound, and Motion

**Files:**
- Create: `frontend/src/pages/GamePage.jsx`
- Create: `frontend/src/components/poker/PokerTable.jsx`
- Create: `frontend/src/components/poker/PlayerSeat.jsx`
- Create: `frontend/src/components/poker/Card.jsx`
- Create: `frontend/src/components/poker/HandInfo.jsx`
- Create: `frontend/src/components/poker/ActionDock.jsx`
- Create: `frontend/src/components/poker/RaiseSheet.jsx`
- Create: `frontend/src/components/poker/TurnTimer.jsx`
- Create: `frontend/src/components/poker/QuickChat.jsx`
- Create: `frontend/src/hooks/useGameSound.js`
- Create: `frontend/src/styles/game.css`
- Create: `frontend/src/components/poker/ActionDock.test.jsx`
- Create: `frontend/src/pages/GamePage.test.jsx`
- Remove after replacement: `frontend/src/GameTable.jsx`, `frontend/src/components/ActionButtons.jsx`, `AnimatedChip.jsx`, `BeginnerTips.jsx`, `BettingPanel.jsx`, `Card.jsx`, `Chat.jsx`, `Chip.jsx`, `ChipStack.jsx`, `GameOverlays.jsx`, `HandInfo.jsx`, `Leaderboard.jsx`, `PlayerSeat.jsx`, `SettingsPanel.jsx`, `Table.jsx`, `TimerRing.jsx`, and `TurnTimer.jsx`.
- Remove after replacement: `frontend/src/context/GameContext.js`, all inherited files under `frontend/src/hooks/`, `frontend/src/constants.js`, and `frontend/src/utils/equity.js`.

**Interfaces:**
- Consumes: safe `room.state`, `legalActions`, server deadline, preferences, and `SocketClient.nextActionId()`.
- Produces: one `game.action` intent per confirmed user action; Raise sends `{type:'raise', raiseTo:number}`.
- `RaiseSheet` inputs are `{pot, streetCommitment, callTo, minTo, maxTo}` and emits an integer total commitment.

- [ ] **Step 1: Write failing Raise-to and interaction tests**

```jsx
it('labels and submits a total raise-to amount', async () => {
  const onAction = vi.fn();
  render(<ActionDock legal={raiseFixture({ pot: 240, callTo: 80, minTo: 160, maxTo: 1000 })} onAction={onAction} />);
  await user.click(screen.getByRole('button', { name: '加注 Raise' }));
  await user.click(screen.getByRole('button', { name: '底池 Pot' }));
  expect(screen.getByText('加注至 Raise to 320')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '确认加注至 320' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'raise', raiseTo: 320 });
});

it('uses only actions supplied by the server', () => {
  render(<ActionDock legal={{ fold: true, check: false, callAmount: 80, bet: null, raise: null, allInTo: 80 }} />);
  expect(screen.queryByRole('button', { name: /加注/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '跟注 Call 80' })).toBeEnabled();
});
```

- [ ] **Step 2: Run and confirm inherited controls differ from the approved behavior**

Run: `npm test -w frontend -- ActionDock.test.jsx GamePage.test.jsx`

Expected: FAIL because inherited presets and table hierarchy do not match the product specification.

- [ ] **Step 3: Implement the approved visual hierarchy and controls**

Use a page-level dark canvas, a thin implied oval, and no felt, wood, neon, coin rain, or heavy physical table. Cards and board are highest contrast; pot, stacks, timer, and actor state are secondary. Desktop positions six seats around the oval; mobile uses a compact opponent arc, centered board, enlarged self hand, and a bottom action dock.

Show the player's current made-hand label, legal actions, call amount, and clickable bilingual rule definitions in both modes. Keep equity percentages, pot-odds calculations, and recommended strategy out of friend rooms; those appear only in Task 13's opt-in practice panel.

Preset formula uses the pot after calling: `target = callTo + roundToChip(preset * (pot + callAmount))`, then clamps to `[minTo,maxTo]`. Provide `½底池 ½ Pot`, `¾底池 ¾ Pot`, `底池 Pot`, and `全下 All-in`, plus a range input with text output. Fold → Check/Call → Bet/Raise order is fixed. Keyboard shortcuts are `F`, `C`, and `R`, ignored while a dialog or range input has focus.

```js
export function presetRaiseTo({ preset, pot, streetCommitment, callTo, minTo, maxTo }) {
  if (preset === 'allIn') return maxTo;
  const callAmount = Math.max(0, callTo - streetCommitment);
  const target = callTo + Math.round((pot + callAmount) * preset);
  return Math.max(minTo, Math.min(maxTo, target));
}
```

- [ ] **Step 4: Add timer, fixed quick chat, restrained audio, and motion**

Derive the countdown from the server deadline rather than decrementing local state. Announce the final five seconds visually and through one polite live-region update, not five screen-reader interruptions. Quick chat contains exactly twelve predefined messages/emojis. Audio includes deal, chip, your-turn, and win cues, defaults on, has a persistent mute, and never autoplays music. Transitions stay within 150–250 ms except deal/showdown; disable nonessential transforms under reduced motion.

- [ ] **Step 5: Add responsive and hostile-name tests, including Review Focus item 5**

```jsx
it('renders a 24-code-point hostile nickname as text', () => {
  const name = '<img src=x>河岸玩家-1234567890';
  render(<PlayerSeat player={{ ...playerFixture(), displayName: name }} />);
  expect(screen.getByText(name)).toBeVisible();
  expect(document.querySelector('img[src="x"]')).toBeNull();
});
```

Add component assertions for dark/light, two/four-color suits, spectator controls absent, disconnected/bot-control labels, exact own-card visibility, 44px controls, and no horizontal scroll at 320px in Playwright Task 14.

- [ ] **Step 6: Verify and commit**

Run: `npm test -w frontend -- ActionDock.test.jsx GamePage.test.jsx && npm run build -w frontend`

Expected: PASS and no removed casino component is imported.

```bash
git add frontend/src
git rm frontend/src/GameTable.jsx frontend/src/components/ActionButtons.jsx frontend/src/components/AnimatedChip.jsx frontend/src/components/BeginnerTips.jsx frontend/src/components/BettingPanel.jsx frontend/src/components/Card.jsx frontend/src/components/Chat.jsx frontend/src/components/Chip.jsx frontend/src/components/ChipStack.jsx frontend/src/components/GameOverlays.jsx frontend/src/components/HandInfo.jsx frontend/src/components/Leaderboard.jsx frontend/src/components/PlayerSeat.jsx frontend/src/components/SettingsPanel.jsx frontend/src/components/Table.jsx frontend/src/components/TimerRing.jsx frontend/src/components/TurnTimer.jsx
git rm frontend/src/context/GameContext.js frontend/src/hooks/useChatSync.js frontend/src/hooks/useGameActions.js frontend/src/hooks/useGameSocket.js frontend/src/hooks/useGameStateSync.js frontend/src/hooks/useHandHistorySync.js frontend/src/hooks/usePlayerPositions.js frontend/src/hooks/useSound.js frontend/src/hooks/useTimerSync.js frontend/src/hooks/useWebSocket.js frontend/src/constants.js frontend/src/utils/equity.js
git commit -m "feat: build responsive bilingual poker table"
```

### Task 13: Add Tutorial, Practice Learning Aids, Results, and Local Statistics

**Files:**
- Create: `frontend/src/pages/TutorialPage.jsx`
- Create: `frontend/src/pages/PracticePage.jsx`
- Create: `frontend/src/pages/ResultsPage.jsx`
- Create: `frontend/src/features/practice/LearningPanel.jsx`
- Create: `frontend/src/features/practice/equityWorker.js`
- Create: `frontend/src/pages/TutorialPage.test.jsx`
- Create: `frontend/src/pages/PracticePage.test.jsx`
- Create: `frontend/src/pages/ResultsPage.test.jsx`
- Modify: `frontend/src/lib/storage.js`
- Modify: `backend/src/RoomManager.js`
- Create: `backend/test/practiceRoom.test.js`

**Interfaces:**
- Consumes: `RoomManager.createPracticeRoom(profile)` and final `MatchSummary`.
- Produces: a six-step scripted tutorial, practice-only `LearningPanel`, and `recordMatch({matchId, placement, handsWon, biggestPot})` deduplicated by `matchId` in session memory.
- `createPracticeRoom` creates one human plus five bots and marks the room `mode:'practice'`; this flag is included in the safe view.

- [ ] **Step 1: Write failing mode-boundary and results tests**

```jsx
it('never renders strategic advice in a friend game', () => {
  render(<GamePage room={gameFixture({ mode: 'friends' })} />);
  expect(screen.queryByText(/胜率|底池赔率|建议/)).not.toBeInTheDocument();
});

it('offers optional learning aids in practice', () => {
  render(<PracticePage room={gameFixture({ mode: 'practice' })} />);
  expect(screen.getByRole('switch', { name: '显示学习辅助' })).toBeVisible();
});

it('renders tied ranks and records a match once', () => {
  render(<ResultsPage summary={summaryFixture({ ranks: [1, 1, 3] })} />);
  expect(screen.getAllByText('并列第 1 名')).toHaveLength(2);
});
```

- [ ] **Step 2: Run and confirm the educational surfaces are absent**

Run: `npm test -w frontend -- TutorialPage.test.jsx PracticePage.test.jsx ResultsPage.test.jsx && npm test -w backend -- practiceRoom.test.js`

Expected: FAIL because tutorial, practice mode, and results routing are undefined.

- [ ] **Step 3: Build the skippable six-step tutorial**

Use deterministic, local scripted states to teach: hole/community cards; best five and hand ranks; Dealer/SB/BB and order; Check/Call/Bet/Raise/Fold/All-in; Flop/Turn/River/Showdown; Pot and Raise-to. Each step has one required interaction, Back/Next, progress text, `跳过教程`, and no network dependency. The complete path should take roughly three minutes when read aloud at a comfortable pace.

- [ ] **Step 4: Build practice on the authoritative server engine**

`PracticePage` requests a practice room rather than running a second browser-side game engine. Compute optional approximate equity in a Web Worker from the human's visible cards and board only; label it `练习估算` and never send the estimate to the server. Show pot odds and plain-language explanations only when `room.mode === 'practice'` and the user enables the switch.

```js
if (room.mode !== 'practice') return null;
return <LearningPanel cards={room.game.self.holeCards} board={room.game.board} pot={room.game.pot} callAmount={room.game.legalActions.callAmount} />;
```

- [ ] **Step 5: Build ephemeral results and aggregate local stats**

Show rank, final chips, hands won, largest pot, and biggest chip rise. Do not expose the full action log or per-hand replay. Rematch is visible to the host and sends `match.rematch`; others see a waiting state. Update matches/wins/handsWon/biggestPot locally once per match ID, then discard the raw summary when navigating home.

- [ ] **Step 6: Verify and commit**

Run: `npm test -w frontend -- TutorialPage.test.jsx PracticePage.test.jsx ResultsPage.test.jsx && npm test -w backend -- practiceRoom.test.js`

Expected: PASS; friend fixtures contain no strategy panel and results contain no hand-history controls.

```bash
git add frontend/src backend/src/RoomManager.js backend/test/practiceRoom.test.js
git commit -m "feat: add tutorial practice and match results"
```

## Milestone 4 — Whole-product Verification

### Task 14: Add End-to-end Privacy, Reconnect, Browser, and Responsive Acceptance Tests

**Files:**
- Create: `e2e/match.spec.js`
- Create: `e2e/privacy.spec.js`
- Create: `e2e/responsive.spec.js`
- Modify: `playwright.config.js`
- Modify: `README.md`
- Create: `docs/TESTING.md`

**Interfaces:**
- Consumes: root `npm run test:e2e`, backend `/health`, and Vite preview.
- Produces: repeatable Chromium/WebKit/Firefox acceptance coverage and a manual Edge checklist; no production deployment.

- [ ] **Step 1: Write the failing two-browser ten-hand journey**

```js
test('two humans and bots finish a ten-hand match and rematch', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: '创建好友房' }).click();
  const code = await host.getByTestId('room-code').textContent();
  await guest.goto(`/room/${code}`);
  await guest.getByRole('button', { name: '加入房间' }).click();
  await host.getByRole('button', { name: '开始 10 手牌' }).click();
  await playMatchThroughLegalActions(host, guest);
  await expect(host.getByRole('heading', { name: '本局结果' })).toBeVisible();
  await host.getByRole('button', { name: '再来一局' }).click();
  await expect(guest.getByText('等待房主开始')).toBeVisible();
});
```

- [ ] **Step 2: Run Chromium and observe the unfinished seams**

Run: `npm run test:e2e -- --project=chromium`

Expected: FAIL until dev-server startup, stable test IDs, and complete client/server routing are connected.

- [ ] **Step 3: Add socket privacy and double-submit interception**

Capture WebSocket frames for host, guest, and spectator. Before showdown, assert each frame lacks the other player's known card codes and token. At showdown, assert only eligible hands appear. Dispatch the same `actionId` twice and assert the displayed stack decreases once and room revision advances once.

- [ ] **Step 4: Add reconnect and timeout acceptance cases**

Use server test controls available only under `NODE_ENV=test` to advance fake time. Cover reconnect at 29.9 seconds, bot takeover at 30 seconds, human return during a hand, restoration at the next hand, Check on timeout when legal, Fold when facing a bet, and host transfer to the earliest connected human. Test controls bind only to loopback and are not included when `NODE_ENV=production`.

- [ ] **Step 5: Add responsive and settings cases**

```js
test.use({ viewport: { width: 320, height: 700 } });
test('mobile table keeps cards and actions reachable', async ({ page }) => {
  await enterRiggedGame(page);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
  await expect(page.getByTestId('self-hole-cards')).toBeInViewport();
  await expect(page.getByTestId('action-dock')).toBeInViewport();
});
```

Check 320×700, 768×1024, and 1440×900; dark/light; two/four-color; muted audio; reduced motion; keyboard controls; hostile 24-character nickname; and spectator controls absent.

- [ ] **Step 6: Run the complete automated matrix**

Run: `npm run check && npm run test:e2e`

Expected: unit/integration tests and Vite build PASS; Chromium, WebKit, and Firefox E2E projects PASS.

- [ ] **Step 7: Record the current-browser manual pass**

In `docs/TESTING.md`, record the tested OS/browser versions and results for current Chrome, Safari, Edge, and Firefox. Repeat create/join, one action, theme switch, audio mute, and 320px responsive inspection in each. Do not mark an untested browser as passed.

- [ ] **Step 8: Commit the acceptance suite**

```bash
git add e2e playwright.config.js README.md docs/TESTING.md
git commit -m "test: cover full private match acceptance flow"
```

### Task 15: Final Scope, Security, Accessibility, and Release-readiness Audit

**Files:**
- Modify: `README.md`
- Modify: `NOTICE.md`
- Create: `docs/PRIVACY.md`
- Create: `docs/RELEASE_CHECKLIST.md`
- Modify only when an audit fails: files identified by the failing command or checklist item.

**Interfaces:**
- Consumes: all prior tasks and the approved design spec.
- Produces: a local MVP candidate with documented limits; no hosting or public launch action.

- [ ] **Step 1: Run dependency and source-boundary checks**

Run: `npm audit --omit=dev && rg -n "Math\.random|holeCards.*console|console.*holeCards|password|privateMessage|side.?bet|achievement|public lobby|cash|deposit|withdraw" backend frontend README.md docs`

Expected: production dependency audit has no high/critical finding; `Math.random` is absent from shuffling/session/code generation; any textual matches are limited to explicit play-money prohibitions or test assertions.

- [ ] **Step 2: Run the full suite from a clean install**

Run: `npm ci && npm run check && npm run test:e2e`

Expected: clean install, all tests, all three browser engines, and production build PASS.

- [ ] **Step 3: Verify privacy and product boundaries in documentation**

`docs/PRIVACY.md` must say which anonymous error/performance fields may be collected and prohibit nickname, cards, room tokens, chat, and full hand records. `README.md` must explain in-memory room loss on restart, local-only player data, virtual chips, no real reward, and exact local startup. `NOTICE.md` must still retain upstream attribution.

- [ ] **Step 4: Complete the release checklist**

`docs/RELEASE_CHECKLIST.md` must include: six-seat/ten-hand/blind schedule; every legal action and side-pot case; hidden-card inspection; 15-second timeout; 30-second takeover; 30-minute cleanup; host transfer; tutorial skip/complete; friend/practice advice boundary; rematch; dark/light; two/four-color; mute/reduced-motion; keyboard/touch; 320px layout; four current desktop browsers; license/notice; and play-money copy.

- [ ] **Step 5: Review the branch diff and commit only verified fixes/docs**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors, no generated `dist`, test artifact, token, or environment secret staged, and every changed file maps to this plan.

```bash
git add README.md NOTICE.md docs/PRIVACY.md docs/RELEASE_CHECKLIST.md
git commit -m "docs: finalize local MVP release boundaries"
```

## Completion Gate

Implementation is complete only when all of the following are true:

- `npm ci`, `npm run check`, and `npm run test:e2e` pass from a clean checkout.
- The automated match, privacy, idempotency, short-all-in, reconnect-boundary, and 320px tests pass.
- Current Chrome, Safari, Edge, and Firefox results are recorded truthfully in `docs/TESTING.md`.
- A two-human-plus-bots match reaches correct results and starts a rematch without a page reload.
- No client frame before showdown exposes an opponent's cards, and no application log contains a nickname, token, cards, or full action history.
- The app contains no public lobby, account, free chat, side bet, achievement, real-money, or permanent replay surface.
- `LICENSE`, `NOTICE.md`, the virtual-chip notice, privacy boundary, and server-restart limitation are visible and correct.
- The final diff has been reviewed against `docs/superpowers/specs/2026-09-23-project-river-design.md`; deployment remains intentionally unperformed.
