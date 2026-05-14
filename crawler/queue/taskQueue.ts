import { SitemapItem } from '../ingestion/sitemapFetcher';

/**
 * SIMPLE IN-MEMORY QUEUE
 *
 * In production this would be:
 * - Redis Queue (BullMQ)
 * - SQS / RabbitMQ
 *
 * For now we simulate queue behavior in-memory.
 */

export class TaskQueue {
  private queue: SitemapItem[] = [];

  constructor(items: SitemapItem[]) {
    this.queue = items;
  }

  getNext(): SitemapItem | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }
}
