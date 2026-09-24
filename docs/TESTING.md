# Project River testing

## Automated coverage

Run the complete unit, integration, build, and browser checks from the repository root:

```bash
npm run check
npm run test:e2e
```

Playwright starts the in-memory backend and Vite frontend and accesses them through loopback. The browser suite covers two isolated players completing ten hands, an offline/online smoke scenario, rematch, recipient-specific card privacy, cross-client session-token isolation, spectator restrictions, invitation URL onboarding, leaving and creating a new room, first-use practice, preferences, and 320/768/1440 px layouts.

Stop any existing development/preview servers on ports 8080 and 5173 before running Playwright. Server reuse is deliberately disabled: an existing Vite 4 process initially survived the dependency upgrade and could mask startup compatibility. The root frontend script now forwards CLI arguments correctly to Vite, and its default listener is 127.0.0.1. Both servers must start fresh for release verification; an occupied port fails clearly instead of silently selecting an old process.

Pre-merge verification on 2026-09-23: `npm run check` passed **119 backend tests, 33 frontend tests, and the production build**. `npm run test:e2e -- --retries=0` passed **30 browser tests** with no retries.

Release-readiness follow-up: clean `npm ci`, full `npm audit`, and production-only audit passed with **zero known vulnerabilities**. `npm run check` passed **120 backend tests, 36 frontend tests, and the production build** on Node 26.3.1. `npm run test:e2e -- --retries=0` passed **33 browser tests** (11 per engine) in 1.6 minutes. New regression tests were run red before implementation and green afterward; they cover browser timer receivers, disabled reconnect controls, synchronous transport-close races, and same-revision action-rejection recovery. The deadline regression advances injected time to detect accidental timer resets.

The additional `e2e/mixed-reconnect.spec.js` uses two browser identities and four real server bots. It forwards actual messages through Playwright's [WebSocket routing API](https://playwright.dev/docs/api/class-websocketroute), closes both transport legs with a browser-permitted application code, observes the server's disconnected-seat state, and requires a new resume handshake with the same player ID. Snapshots are temporarily withheld to verify that an open socket cannot enable stale controls. It then completes all ten hands, checks 6,000-chip conservation, and starts a rematch. This is stronger than `setOffline` alone, but is not a physical Wi-Fi-loss trial. Completion helpers use programmatic clicks; they do not prove pointer hit targets are unobstructed.

Dependency decisions: keep React 18 and adopt the compatible [Router v7 re-export package](https://api.reactrouter.com/v7/modules/react-router-dom.html); use [Vite 7's supported Node floor](https://v7.vite.dev/guide/migration) without the unrelated Vite 8 bundler migration; use Vitest 4.1.11, which patches [GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9). npm reports a transitive `whatwg-encoding` deprecation and install-script approval notices for esbuild/fsevents; no global script policy was relaxed, and clean build/tests succeeded. Terminal-color notices are non-failing.

The server-handler regressions in `backend/test/sessionLifecycle.test.js` use injected time and transport to verify socket replacement, spectator resume/promotion, host recovery, same-hand bot cancellation, deferred next-hand restoration, rejected-request atomicity, and duplicate-action deadline preservation. These are deterministic integration checks, not a substitute for a real-device network-loss trial.

## Per-hand result review — 2026-09-24

`npm run check` passed **128 backend tests, 41 frontend tests, and the production build**. Result-flow tests were observed failing before the implementation and passing afterward. Coverage includes eight-second friend-room review (including hand ten), indefinite practice review, host-only continuation, stale duplicate/early continuation rejection, reconnect deadline preservation, and privacy-filtered showdown hand types. UI tests cover multiple pot winners, uncontested wins, disconnected controls, and the final-hand Results button.

`e2e/hand-result.spec.js` plays real practice and friend-room hands without replacing server state. It waits nine seconds on a practice result before continuing, checks mobile overflow and reduced motion, and verifies that both eligible friend-room hands are revealed before automatic continuation. Desktop 1440×900 and mobile 320×700 screenshots of a real showdown were visually inspected: cards, bilingual hand types, winner marks, and Next hand remain readable; the learning overlay is absent during review. The ten-hand browser time budgets explicitly include the new eight-second pauses.

`npm run test:e2e -- --retries=0 --workers=3` passed **39/39 browser tests** across Chromium, WebKit, and Firefox in 5.2 minutes, with fresh local servers. The focused read-only code review found no blocking correctness, privacy, or lifecycle issues; the UI detector returned no findings.

## Learning-control layout follow-up — 2026-09-24

The learning switch now lives in the game status bar; expanded help uses document flow above the full-size table. With help expanded, the action bar follows the table so a short screen can scroll instead of covering cards. Learning estimates and the hidden-during-result behavior are unchanged.

The new `e2e/learning-layout.spec.js` first reproduced overlap at 320 px and 768 px. It checks the rendered control/panel/card/action rectangles, horizontal overflow, expanded-state pointer hit targets, and a real Fold/Check click after closing help. Verification used separate fresh servers on ports 5174/8081 so the user's 5173 practice session was not interrupted. `npm run check` passed 128 backend tests, 41 frontend tests, and the production build.

The focused browser run passed **27/27** tests without retries across Chromium, WebKit, and Firefox (`learning-layout`, `responsive`, and `hand-result` specs). This UI-only follow-up did not rerun the longer ten-hand reconnect scenarios; their prior result is recorded above.

## Manual browser record — 2026-09-23

Automated Playwright matrix: Chromium, WebKit, and Firefox **33/33 passed** on 2026-09-23, including the mixed-table reconnect scenario on every engine. This is separate from the manual record below.

| Browser | Platform | Result | Scope |
| --- | --- | --- | --- |
| Chrome 153.0.8010.53 | macOS 26.5.1 | Partial pass | Home, six-seat waiting room, and game table visually inspected; actual pointer create/start, opening the raise sheet, and Call 20 verified. The 15-second deadline expired while inspecting a raise, correctly closing that sheet. Earlier tutorial inspection retained. Full manual matrix still pending. |
| Safari | macOS | Not run | Pending manual create/join, action, theme, mute, and 320 px pass. |
| Edge | macOS/Windows | Not run | Pending manual create/join, action, theme, mute, and 320 px pass. |
| Firefox | macOS | Not run | Pending manual create/join, action, theme, mute, and 320 px pass. |

An untested browser is deliberately not marked as passed. Before a public release, repeat the same five checks in the current stable version of each browser and record the exact browser and OS versions here.
