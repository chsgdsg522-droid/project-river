export class TurnClock {
  constructor({ now = Date.now, setTimeout: schedule = setTimeout, clearTimeout: cancel = clearTimeout } = {}) {
    this.now = now;
    this.schedule = schedule;
    this.cancelTimer = cancel;
    this.entries = new Map();
  }

  start({ roomCode, handId, actorId, deadline, onExpire }) {
    this.cancel(roomCode);
    const generation = Symbol(roomCode);
    const timeoutId = this.schedule(() => {
      const current = this.entries.get(roomCode);
      if (current?.generation !== generation || current.handId !== handId || current.actorId !== actorId) return;
      this.entries.delete(roomCode);
      onExpire();
    }, Math.max(0, deadline - this.now()));
    this.entries.set(roomCode, { generation, handId, actorId, deadline, timeoutId });
  }

  cancel(roomCode) {
    const current = this.entries.get(roomCode);
    if (!current) return false;
    this.cancelTimer(current.timeoutId);
    this.entries.delete(roomCode);
    return true;
  }

  remaining(roomCode, at = this.now()) {
    const current = this.entries.get(roomCode);
    return current ? Math.max(0, current.deadline - at) : 0;
  }

  close() {
    for (const roomCode of this.entries.keys()) this.cancel(roomCode);
  }
}
