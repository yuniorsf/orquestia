import type { Clock } from '../shared/clock.js';

export class FakeClock implements Clock {
  constructor(private current: number = 0) {}

  now(): number {
    return this.current;
  }

  advanceTo(timestamp: number): void {
    this.current = timestamp;
  }
}
