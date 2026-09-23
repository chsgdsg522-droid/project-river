import { describe, expect, it, vi } from 'vitest';
import { sendTelemetry } from './telemetry.js';

describe('anonymous telemetry', () => {
  it('submits only allowlisted and normalized fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    await sendTelemetry({
      kind: 'error',
      name: 'socket.failed<script>'.repeat(8),
      profile: { nickname: '河神' },
      token: 'resume-secret',
      roomCode: 'RIVER7',
      holeCards: ['As', 'Kd'],
      actionHistory: ['raiseTo: 900'],
    }, {
      fetchImpl,
      pathname: '/game/RIVER7?token=resume-secret',
      userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36',
    });

    const submitted = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(submitted).toEqual({
      kind: 'error',
      name: expect.stringMatching(/^[a-zA-Z0-9 .:_-]{1,64}$/),
      route: '/game/:code',
      browserFamily: 'Chrome',
    });
    expect(JSON.stringify(submitted)).not.toMatch(/河神|resume-secret|RIVER7|As|Kd|raiseTo/);
  });

  it('samples performance events before sending', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    await sendTelemetry({ kind: 'performance', name: 'route.ready', durationMs: 123.45 }, {
      fetchImpl,
      pathname: '/practice',
      userAgent: 'Safari/605.1.15',
      random: () => 0.9,
      performanceSampleRate: 0.1,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
