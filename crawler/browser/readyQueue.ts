export class ReadyQueue<V> {
  private store = new Map<string, V>();
  private queue: string[] = [];

  /**
   * Enqueue a key/value pair.
   * If key already exists, does nothing.
   */
  enqueue(key: string, value: V): void {
    if (!this.store.has(key)) {
      this.store.set(key, value);
      this.queue.push(key);
    }
  }

  /**
   * Dequeue the oldest entry. Returns the value or null if empty.
   */
  dequeue(): V | null {
    if (this.queue.length === 0) return null;

    const key = this.queue.shift()!;
    const value = this.store.get(key)!;

    this.store.delete(key);

    return value;
  }

  /**
   * Peek the oldest entry without removing it.
   */
  peek(): V | null {
    if (this.queue.length === 0) return null;

    return this.store.get(this.queue[0])!;
  }

  /**
   * Remove a specific key wherever it exists.
   */
  remove(key: string): boolean {
    const index = this.queue.indexOf(key);

    if (index === -1) return false;

    this.queue.splice(index, 1);

    return this.store.delete(key);
  }

  /**
   * Check presence without altering order.
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Number of queued items.
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Iterate values in FIFO order.
   */
  *values(): IterableIterator<V> {
    for (const key of this.queue) {
      yield this.store.get(key)!;
    }
  }

  /**
   * Clear queue.
   */
  clear(): void {
    this.store.clear();
    this.queue.length = 0;
  }
}
