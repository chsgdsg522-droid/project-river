# Project River testing

## Automated coverage

Run the complete unit, integration, build, and browser checks from the repository root:

```bash
npm run check
npm run test:e2e
```

Playwright starts the in-memory backend and Vite frontend on loopback. The browser suite covers two isolated players completing ten hands, reconnect recovery, rematch, recipient-specific card privacy, cross-client session-token isolation, spectator restrictions, preferences, and 320/768/1440 px layouts.

## Manual browser record — 2026-09-23

Automated Playwright matrix: Chromium, WebKit, and Firefox **21/21 passed** on 2026-09-23. This is separate from the manual record below.

| Browser | Platform | Result | Scope |
| --- | --- | --- | --- |
| Chrome | macOS | Partial pass | Home and six-step tutorial visually inspected; automated Chromium run recorded separately. |
| Safari | macOS | Not run | Pending manual create/join, action, theme, mute, and 320 px pass. |
| Edge | macOS/Windows | Not run | Pending manual create/join, action, theme, mute, and 320 px pass. |
| Firefox | macOS | Not run | Pending manual create/join, action, theme, mute, and 320 px pass. |

An untested browser is deliberately not marked as passed. Before a public release, repeat the same five checks in the current stable version of each browser and record the exact browser and OS versions here.
