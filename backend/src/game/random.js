import { randomInt as nodeRandomInt } from 'node:crypto';

export function secureRandomInt(maxExclusive) {
  return nodeRandomInt(maxExclusive);
}
