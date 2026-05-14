/**
 * SMART QUEUE SYSTEM
 *
 * Features:
 * - retry queue
 * - backpressure control
 * - task lifecycle management
 */

import { CrawlTask } from './types';

export class SmartQueue {
  private queue: CrawlTask[] = [];

  private maxAttempts = 3;

  constructor(urls: string[]) {
    this.queue = urls.map((url) => ({
      url,
      attempts: 0,
      status: 'PENDING',
    }));
  }

  getNext(): CrawlTask | undefined {
    return this.queue.find(
      (t) => t.status === 'PENDING' || t.status === 'RETRY',
    );
  }

  markProcessing(task: CrawlTask) {
    task.status = 'PROCESSING';
  }

  markSuccess(task: CrawlTask) {
    task.status = 'SUCCESS';
  }

  markFailed(task: CrawlTask, error: string) {
    task.attempts += 1;
    task.lastError = error;

    if (task.attempts >= this.maxAttempts) {
      task.status = 'FAILED';
    } else {
      task.status = 'RETRY';
    }
  }

  hasPending(): boolean {
    return this.queue.some(
      (t) => t.status === 'PENDING' || t.status === 'RETRY',
    );
  }

  size(): number {
    return this.queue.length;
  }

  getStats() {
    return {
      total: this.queue.length,
      pending: this.queue.filter((t) => t.status === 'PENDING').length,
      retry: this.queue.filter((t) => t.status === 'RETRY').length,
      failed: this.queue.filter((t) => t.status === 'FAILED').length,
      success: this.queue.filter((t) => t.status === 'SUCCESS').length,
    };
  }
}
