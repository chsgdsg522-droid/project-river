export class Player {
  constructor(id, displayName, { seat = null, stack = 1_000 } = {}) {
    this.id = id;
    this.displayName = displayName;
    this.name = displayName;
    this.seat = seat;
    this.stack = stack;
    this.holeCards = [];
    this.streetCommitment = 0;
    this.totalCommitment = 0;
    this.folded = false;
    this.allIn = false;
    this.revealed = false;
    this.lastAction = null;
  }

  get chips() { return this.stack; }
  set chips(value) { this.stack = value; }
  get currentBet() { return this.streetCommitment; }
  set currentBet(value) { this.streetCommitment = value; }
  get totalBet() { return this.totalCommitment; }
  set totalBet(value) { this.totalCommitment = value; }
  get isAllIn() { return this.allIn; }
  set isAllIn(value) { this.allIn = value; }

  resetForNewHand() {
    this.holeCards = [];
    this.streetCommitment = 0;
    this.totalCommitment = 0;
    this.folded = false;
    this.allIn = false;
    this.revealed = false;
    this.lastAction = null;
  }

  resetForNewStreet() {
    this.streetCommitment = 0;
    this.lastAction = null;
  }
}
