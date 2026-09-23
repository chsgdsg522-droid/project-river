# Privacy boundary

Project River is designed to minimize retained data. It has no account system and no database.

## Data kept in the browser

The browser stores only the chosen nickname and avatar, display and sound preferences, and aggregate totals: matches, wins, hands won, and biggest pot. It does not store room codes, session tokens, cards, action history, chat history, or complete match summaries.

## Data kept in server memory

The server holds active room membership, session tokens, current cards, actions, and match state only in memory. Restarting the process removes all rooms and games. A room with no connected human is removed after 30 minutes.

## Anonymous telemetry

The optional `/telemetry` endpoint accepts only:

- `kind`: `error` or `performance`
- `name`: a short allowlisted-format event name
- `durationMs`: optional non-negative duration
- `route`: a path without query data
- `browserFamily`: a short browser-family label

Telemetry must never include a nickname, avatar choice, room code, session or reconnect token, hole cards, board cards, stack or action history, quick-chat event, free-form message, IP-derived identity, or complete hand/match record. Unknown fields are rejected. Operational logs use a one-way truncated room-code hash and event/error categories, never the raw room code or player content.

## Network boundary

Each player receives a recipient-specific room view. Before showdown, another player's hole cards are omitted rather than masked in the client. Session tokens are sent only to the owning connection. The automated browser suite checks cross-client card and token isolation.

Project River is currently a local MVP, not a hosted service. Any future deployment needs a separate review of transport encryption, proxy logs, retention, abuse controls, and the public privacy notice before launch.
