import type { BackgroundTokenRotatorService } from './background-token-rotator-service.js';

/**
 * Thin adapter wrapping `setInterval` around `BackgroundTokenRotatorService`
 * — the only piece of this ticket that's genuinely "background"/scheduling
 * infrastructure rather than testable domain logic.
 */
export class IntervalTokenRotationScheduler {
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly rotator: BackgroundTokenRotatorService,
    private readonly intervalMs: number,
    private readonly onError: (error: unknown) => void = () => {},
  ) {}

  start(): void {
    this.handle = setInterval(() => {
      this.rotator.checkAndRotateIfNeeded().catch(this.onError);
    }, this.intervalMs);
  }

  stop(): void {
    if (this.handle) {
      clearInterval(this.handle);
      this.handle = null;
    }
  }
}
