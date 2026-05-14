/**
 * TASK LIFECYCLE MODEL
 *
 * Represents state of a crawling job in the system.
 */

export type TaskStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRY';

export type CrawlTask = {
  url: string;
  attempts: number;
  status: TaskStatus;
  lastError?: string;
};
