/**
 * Guards any async task and tracks if something is running.
 * Used to prevent behavior execution during active message processing.
 */

export class AgentActivityLock {
  private count = 0;

  isActive(): boolean {
    return this.count > 0;
  }

  enter() {
    this.count++;
  }

  exit() {
    this.count = Math.max(0, this.count - 1);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    this.enter();
    try {
      return await fn();
    } finally {
      this.exit();
    }
  }
}

export const agentActivityLock = new AgentActivityLock();
