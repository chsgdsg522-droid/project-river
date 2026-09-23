# Local MVP release checklist

Status date: 2026-09-23. “Automated” means covered by the checked-in unit, integration, or Playwright suite. “Manual pending” is not a pass.

## Game and room rules

- [x] Automated — six seats, fixed ten-hand match, and blind schedule 10/20 → 20/40 → 40/80.
- [x] Automated — Fold, Check, Call, Bet, Raise-to, and All-in legality.
- [x] Automated — main pot, multiple side pots, folded chips, ties, and odd-chip conservation.
- [x] Automated — recipient-only hidden cards before showdown.
- [x] Automated — 15-second turn deadline; Check on timeout when legal and Fold when facing a bet.
- [x] Automated — disconnected player bot takeover at 30 seconds and reconnect control policy.
- [x] Automated — empty-room cleanup after 30 minutes and host transfer to the earliest connected human.
- [x] Automated — duplicate action ID is idempotent and conflicting reuse is rejected.
- [x] Browser — two players finish ten hands and the host starts a rematch without reloading.
- [x] Regression — invitation URL onboarding, new room after leaving, and first-use practice.
- [x] Regression — replaced sockets cannot disconnect current players; spectators resume and receive player controls after promotion.
- [x] Regression — short all-in raises do not reopen action, and all-in cannot bypass closed raising rights.
- [ ] Acceptance pending — complete a mixed table of two humans and four bots across ten hands with an actual network interruption.

## Learning and interface

- [x] Automated — six-step tutorial can be completed or skipped.
- [x] Automated — strategic estimates appear only in practice, never in a friend room.
- [x] Browser — dark/light theme, two/four-color deck, mute, and reduced-motion preferences.
- [x] Automated — keyboard actions and touch-sized controls.
- [x] Browser — 320×700, 768×1024, and 1440×900 layouts have no horizontal overflow; mobile private cards remain reachable.
- [x] Browser — spectator has no action controls.
- [x] Browser — Chromium, WebKit, and Firefox automated projects pass.
- [ ] Manual pending — current Chrome, Safari, Edge, and Firefox desktop checklist; see `docs/TESTING.md`.
- [ ] Learning accuracy pending — the current practice percentage is a simple visible-card heuristic, not validated poker equity; replace or validate it before presenting it as win probability.

## Privacy, scope, and open source

- [x] Source audit — no public lobby, accounts, password rooms, free-text chat, side bets, achievements, permanent replay, deposits, withdrawals, or cash rewards.
- [x] Source audit — shuffle, room code, player ID, and session token generation do not use `Math.random`; telemetry sampling is the only allowed occurrence.
- [x] Documentation — browser-local aggregates, in-memory room loss on restart, telemetry allowlist, and prohibited fields are documented.
- [x] Product copy — virtual chips only; no recharge, withdrawal, or real-world reward.
- [x] License — MIT `LICENSE` and upstream attribution in `NOTICE.md` retained.
- [x] Dependency audit — no high or critical production finding. Two moderate React Router advisories remain because the available fix requires a breaking v7 migration; the app accepts only validated room codes and uses no SSR hydration.
- [x] Deployment — intentionally not performed.
