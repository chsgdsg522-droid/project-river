# Project River testing

## Automated coverage

Run the complete unit, integration, build, and browser checks from the repository root:

```bash
npm run check
npm run test:e2e
```

Playwright starts the in-memory backend and Vite frontend on loopback. The browser suite covers two isolated players completing ten hands, an offline/online smoke scenario, rematch, recipient-specific card privacy, cross-client session-token isolation, spectator restrictions, invitation URL onboarding, leaving and creating a new room, first-use practice, preferences, and 320/768/1440 px layouts.

Pre-merge verification on 2026-09-23: `npm run check` passed **119 backend tests, 33 frontend tests, and the production build**. `npm run test:e2e -- --retries=0` passed **30 browser tests** with no retries. Existing React Router future-flag and terminal-color warnings remain non-failing.

The server-handler regressions in `backend/test/sessionLifecycle.test.js` use injected time and transport to verify socket replacement, spectator resume/promotion, host recovery, same-hand bot cancellation, deferred next-hand restoration, rejected-request atomicity, and duplicate-action deadline preservation. These are deterministic integration checks, not a substitute for a real-device network-loss trial.

## Manual browser record — 2026-09-23

Automated Playwright matrix: Chromium, WebKit, and Firefox **30/30 passed** on 2026-09-23. This is separate from the manual record below.

| Browser | Platform | Result | Scope |
| --- | --- | --- | --- |
| Chrome | macOS | Partial pass | Home and six-step tutorial visually inspected; automated Chromium run recorded separately. |
| Safari | macOS | Not run | Pending manual create/join, action, theme, mute, and 320 px pass. |
| Edge | macOS/Windows | Not run | Pending manual create/join, action, theme, mute, and 320 px pass. |
| Firefox | macOS | Not run | Pending manual create/join, action, theme, mute, and 320 px pass. |

An untested browser is deliberately not marked as passed. Before a public release, repeat the same five checks in the current stable version of each browser and record the exact browser and OS versions here.
