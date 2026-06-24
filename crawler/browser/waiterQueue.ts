/**
 * Lightweight waiter queue used by the browser pool.
 *
 * Design notes:
 * - This is a best-effort priority queue keyed by `generation`.
 *   Insert is O(n), intentionally chosen because waiter counts are
 *   typically small and simplicity is preferred over heap complexity.
 *
 * - Ordering:
 *     * Lower generation values are served first.
 *     * FIFO ordering is preserved within the same generation because
 *       new nodes are inserted after existing nodes of equal priority.
 *
 * - Invariants:
 *     * `count` is modified only in `push()` and `removeNode()`.
 *     * Node lifecycle:
 *         linked -> removed -> finalized
 */

type NodeState = 'linked' | 'removed' | 'finalized';

class Node<T> {
  public prev: Node<T> | null = null;
  public next: Node<T> | null = null;
  public resolve?: (v: T) => void;
  public reject?: (err?: any) => void;
  public generation?: number;
  public state: NodeState = 'linked';

  constructor(generation?: number) {
    this.generation = generation;
  }
}

export interface WaiterTicket<T> {
  promise: Promise<T>;
  cancel: () => void;
  generation?: number;
}

export class WaiterQueue<T = void> {
  private head: Node<T> | null = null;
  private tail: Node<T> | null = null;
  private count = 0;

  private readonly debug = process.env.NODE_ENV !== 'production';

  push(generation?: number): WaiterTicket<T> {
    const node = new Node<T>(generation);

    const promise = new Promise<T>((resolve, reject) => {
      node.resolve = resolve;
      node.reject = reject;
    });

    if (typeof generation === 'number') {
      let cur = this.tail;

      while (cur && (cur.generation ?? -Infinity) > generation) {
        cur = cur.prev;
      }

      if (!cur) {
        if (!this.head) {
          this.head = this.tail = node;
        } else {
          node.next = this.head;
          this.head.prev = node;
          this.head = node;
        }
      } else {
        node.prev = cur;
        node.next = cur.next;

        cur.next = node;

        if (node.next) {
          node.next.prev = node;
        }

        if (this.tail === cur) {
          this.tail = node;
        }
      }
    } else {
      if (!this.head) {
        this.head = this.tail = node;
      } else {
        node.prev = this.tail;
        this.tail!.next = node;
        this.tail = node;
      }
    }

    this.count++;

    const cancel = () => {
      const removed = this.removeNode(node);

      if (removed) {
        try {
          node.reject?.(new Error('waiter_cancelled'));
        } finally {
          this.finalizeNode(node);
        }
      } else if (this.debug) {
        console.warn('[WaiterQueue] cancel lost race or already removed');
      }
    };

    return {
      promise,
      cancel,
      generation,
    };
  }

  shiftResolve(value: T): boolean {
    const node = this.head;

    if (!node) return false;

    const removed = this.removeNode(node);

    if (!removed) {
      if (this.debug) {
        console.warn('[WaiterQueue] shiftResolve: node already removed (race)');
      }
      return false;
    }

    try {
      node.resolve?.(value);
    } finally {
      this.finalizeNode(node);
    }

    return true;
  }

  shiftReject(err?: any): boolean {
    const node = this.head;

    if (!node) return false;

    const removed = this.removeNode(node);

    if (!removed) {
      if (this.debug) {
        console.warn('[WaiterQueue] shiftReject: node already removed (race)');
      }
      return false;
    }

    try {
      node.reject?.(err);
    } finally {
      this.finalizeNode(node);
    }

    return true;
  }

  drainReject(err?: any): void {
    let node = this.head;

    while (node) {
      const next = node.next;

      const removed = this.removeNode(node);

      if (removed) {
        try {
          node.reject?.(err);
        } catch {
          // ignored
        }

        this.finalizeNode(node);
      } else if (node.state !== 'finalized') {
        this.finalizeNode(node);
      }

      node = next;
    }

    this.head = null;
    this.tail = null;
    this.count = 0;
  }

  get size(): number {
    return this.count;
  }

  private removeNode(node: Node<T>): boolean {
    if (node.state !== 'linked') {
      return false;
    }

    node.state = 'removed';

    if (this.count <= 0) {
      throw new Error('[WaiterQueue] count underflow - structural corruption');
    }

    if (node.prev) {
      node.prev.next = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    }

    if (this.head === node) {
      this.head = node.next;
    }

    if (this.tail === node) {
      this.tail = node.prev;
    }

    this.count--;

    return true;
  }

  private finalizeNode(node: Node<T>): void {
    if (node.state === 'finalized') {
      if (this.debug) {
        console.warn('[WaiterQueue] finalizeNode called twice on same node');
      }
      return;
    }

    node.state = 'finalized';

    node.resolve = undefined;
    node.reject = undefined;

    node.prev = null;
    node.next = null;

    node.generation = undefined;
  }
}
