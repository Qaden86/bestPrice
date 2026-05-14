/**
 * BACKPRESSURE CONTROL
 *
 * Prevents system overload by limiting concurrency pressure.
 */

export class Backpressure {
  private active = 0;

  constructor(private limit: number) {}

  canProcess(): boolean {
    return this.active < this.limit;
  }

  acquire() {
    this.active++;
  }

  release() {
    this.active--;
  }

  getActive() {
    return this.active;
  }
}
