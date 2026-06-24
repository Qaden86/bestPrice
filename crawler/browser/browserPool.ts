/**
 * BrowserPool - manages a small fixed pool of Playwright Browser instances and
 * provides a handoff mechanism for creating BrowserContexts to callers.
 *
 * Concurrency model and key invariants:
 * - State CAS is used for slot acquisition: a slot must be transitioned from
 *   'free' -> 'acquiring' atomically.
 * - Snapshot validation: after CAS the code snapshots `browser` + `browserVersion`
 *   and verifies them after any async work to avoid TOCTOU races.
 * - Waiter reservation/commit is a two-phase handoff to avoid lost wakeups.
 *
 * CRUCIAL INVARIANT (ENFORCED):
 *   free / acquiring / leased  =>  browser !== undefined
 *
 * Clearing a browser must not leave a slot in `free` state. When a browser is
 * removed the slot state moves to a non-free state (e.g. 'relaunching') so the
 * snapshot-and-commit model remains sound.
 */

import { chromium, Browser, BrowserContext } from 'playwright';

export type PoolContext = {
  browser: Browser;
  context: BrowserContext;
  _slotId: number;
  leaseId: number;
};

export type BrowserPoolInstance = {
  init: () => Promise<void>;
  acquireContext: () => Promise<PoolContext>;
  releaseContext: (ctx: PoolContext) => Promise<void>;
  close: () => Promise<void>;
};

type SlotState =
  | 'initial'
  | 'free'
  | 'acquiring'
  | 'leased'
  | 'relaunching'
  | 'closing';

// INVARIANT: free / acquiring / leased => browser is always defined.
// The pool relies on this: a slot with state 'free' must have a ready browser.
// Clearing a browser must not leave the slot in 'free' state (use 'relaunching' / 'initial' / 'closing' instead).
type Slot = {
  browser?: Browser;
  onDisconnected?: () => Promise<void>;
  state: SlotState;
  relaunchPromise?: Promise<Browser>;
  leaseId: number;
  previousState?: SlotState;
  generation: number;
  // guard against concurrent releases
  releasing?: boolean;
  // per-relaunch token to detect stale attempts
  relaunchToken?: symbol;
  // browser ownership token (incremented when a browser is assigned or cleared)
  browserVersion: number;
};

export function createBrowserPoolInstance(size = 1): BrowserPoolInstance {
  const MAX_WAITERS = 1000;
  const WAIT_TIMEOUT_MS = 30000;
  const CONTEXT_CREATE_TIMEOUT_MS = 10000;
  const SHUTDOWN_WAIT_MS = 30000;

  type Ticket = {
    id: number;
    promise: Promise<PoolContext>;
    resolve: (v: PoolContext) => void;
    reject: (e?: any) => void;
  };

  class LocalWaiterQueue {
    private queue: Ticket[] = [];
    private reserved = new Map<number, Ticket>();
    private nextId = 1;

    push(): Ticket {
      let resolve!: (v: PoolContext) => void;
      let reject!: (e?: any) => void;
      const p = new Promise<PoolContext>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      const t: Ticket = { id: this.nextId++, promise: p, resolve, reject };
      this.queue.push(t);
      return t;
    }

    size(): number {
      return this.queue.length + this.reserved.size;
    }

    // Atomic synchronous reservation: remove from front and mark reserved
    reserveTicket(): Ticket | undefined {
      const t = this.queue.shift();
      if (!t) return undefined;
      this.reserved.set(t.id, t);
      return t;
    }

    // Give up reserved ticket (e.g. timeout/cancel)
    cancelReserved(id: number): boolean {
      const t = this.reserved.get(id);
      if (!t) return false;
      this.reserved.delete(id);
      try {
        t.reject(new Error('canceled'));
      } catch {}
      return true;
    }

    // Commit reservation: ticket will be resolved by worker; remove from reserved
    commitReserved(id: number): boolean {
      return this.reserved.delete(id);
    }

    // Cancel a queued ticket (search queue)
    cancelQueued(id: number): boolean {
      const idx = this.queue.findIndex((x) => x.id === id);
      if (idx >= 0) {
        const [t] = this.queue.splice(idx, 1);
        try {
          t.reject(new Error('canceled'));
        } catch {}
        return true;
      }
      // maybe it's reserved
      return this.cancelReserved(id);
    }

    // Reject all tickets including reserved (shutdown)
    drainReject(err: any) {
      while (this.queue.length) {
        const t = this.queue.shift()!;
        try {
          t.reject(err);
        } catch {}
      }
      for (const [_, t] of this.reserved) {
        try {
          t.reject(err);
        } catch {}
      }
      this.reserved.clear();
    }
  }

  const waiters = new LocalWaiterQueue();

  const slots: Slot[] = new Array(size).fill(null).map(() => ({
    state: 'initial' as SlotState,
    leaseId: 0,
    generation: 0,
    browserVersion: 0,
  }));

  let inited = false;
  let closed = false;

  function setSlotState(slotId: number, newState: SlotState) {
    const s = slots[slotId];
    if (!s) return;
    if (s.state !== newState) {
      s.generation += 1;
      s.state = newState;
    }
  }

  // CAS-like synchronous state transition to avoid TOCTOU
  function casSetState(
    slotId: number,
    expected: SlotState,
    next: SlotState,
  ): boolean {
    const s = slots[slotId];
    if (!s) return false;
    if (s.state !== expected) return false;
    s.state = next;
    s.generation += 1;
    return true;
  }

  // Explicit active-lease tracking (idempotent via set)
  const activeLeaseSet = new Set<string>();
  function leaseKey(slotId: number, leaseId: number) {
    return `${slotId}:${leaseId}`;
  }
  function countActiveLeases(): number {
    return activeLeaseSet.size;
  }

  // Centralized helper to set/clear browser and bump browserVersion to invalidate snapshots.
  // Enforces invariant: free/acquiring/leased => browser !== undefined by ensuring that
  // clearing the browser moves the slot into a non-free state (relaunching).
  function assignSlotBrowser(
    slotId: number,
    browser?: Browser,
    onDisconnected?: (() => Promise<void>) | undefined,
  ) {
    const s = slots[slotId];
    if (!s) return;

    // always bump the version when browser ownership changes (including clearing)
    s.browserVersion = (s.browserVersion || 0) + 1;
    s.browser = browser;
    s.onDisconnected = onDisconnected;

    if (browser) {
      // When a browser is assigned, make the slot available for acquisition if appropriate.
      // If the slot was initial or relaunching, promote to free so CAS can find it.
      if (s.state === 'initial' || s.state === 'relaunching') {
        setSlotState(slotId, 'free');
      }
      // If the slot was previously acquiring/leased/closing, do not forcibly change it here.
    } else {
      // IMPORTANT: clearing the browser must NOT create a `free` slot.
      // Set the slot into 'relaunching' (or keep it non-free) to indicate the resource is unavailable.
      // This preserves the invariant: free ⇒ browser !== undefined.
      setSlotState(slotId, 'relaunching');
    }
  }

  // Try to reserve a free slot synchronously (atomic CAS).
  // IMPORTANT: do not pre-check `browser` before the CAS to avoid TOCTOU.
  function tryReserveFreeSlot(): number | undefined {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s) continue;
      // atomic compare-and-set without intermediate awaits/reads
      if (casSetState(i, 'free', 'acquiring')) {
        // we reserved the slot; caller must snap browser + version and validate
        return i;
      }
    }
    return undefined;
  }

  function timeoutReject<T>(ms: number, message = 'timeout'): Promise<T> {
    return new Promise<T>((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(message));
      }, ms);
    });
  }

  async function createContextWithTimeout(
    browser: Browser,
  ): Promise<BrowserContext> {
    return await Promise.race([
      (browser as any).newContext(),
      timeoutReject<BrowserContext>(
        CONTEXT_CREATE_TIMEOUT_MS,
        'BrowserContext creation timeout',
      ),
    ]);
  }

  function createDisconnectedHandler(slotId: number) {
    return async function onDisconnected() {
      if (closed) return;
      try {
        await relaunchBrowserForSlot(slotId);
      } catch (err) {
        console.error(`[BrowserPool] slot=${slotId} relaunch failed:`, err);
      }
    };
  }

  // Single-flight relaunch: create & publish the promise synchronously to avoid double launches.
  function relaunchBrowserForSlot(slotId: number): Promise<Browser> {
    const s = slots[slotId];
    if (!s) return Promise.reject(new Error('invalid slot'));

    if (s.relaunchPromise) return s.relaunchPromise;

    // claim relaunch slot synchronously
    const relaunchGeneration = s.generation + 1;
    s.previousState = s.state;
    setSlotState(slotId, 'relaunching');

    const relaunchToken = Symbol('relaunch');
    s.relaunchToken = relaunchToken;

    // create promise and publish immediately for single-flight
    const p = (async () => {
      try {
        // close previous browser if present
        if (s.browser) {
          try {
            if (s.onDisconnected && (s.browser as any).removeListener) {
              (s.browser as any).removeListener(
                'disconnected',
                s.onDisconnected,
              );
            }
            // clear browser before close to invalidate snapshots
            const prev = s.browser;
            assignSlotBrowser(slotId, undefined, undefined);
            try {
              await prev!.close();
            } catch {}
          } catch {}
        }

        const nb = await chromium.launch({ headless: true });

        if (closed) {
          try {
            await nb.close();
          } catch {}
          throw new Error('Pool closed during relaunch');
        }

        // If slot changed since relaunch started, don't overwrite
        if (s.generation !== relaunchGeneration) {
          try {
            await nb.close();
          } catch {}
          throw new Error('stale relaunch (slot changed during relaunch)');
        }

        const handler = createDisconnectedHandler(slotId);
        nb.on('disconnected', handler);

        // assign browser (generation matched) and bump version via helper
        assignSlotBrowser(slotId, nb, handler);

        // restore state if appropriate
        if (!closed) {
          if (s.generation === relaunchGeneration) {
            if (
              s.previousState === 'leased' ||
              s.previousState === 'acquiring'
            ) {
              s.state = s.previousState!;
            } else {
              s.state = 'free';
            }
          }
        }

        return nb;
      } finally {
        if (s.relaunchToken === relaunchToken) {
          s.relaunchPromise = undefined;
          delete s.relaunchToken;
        }
        if (!s.browser && !closed) {
          s.state = 'initial';
        }
        delete s.previousState;
      }
    })();

    // publish immediately for single-flight
    s.relaunchPromise = p;
    return p;
  }

  async function launchBrowserForSlot(slotId: number): Promise<Browser> {
    return await relaunchBrowserForSlot(slotId);
  }

  async function init(): Promise<void> {
    if (inited) return;
    inited = true;
    for (let i = 0; i < size; i++) {
      try {
        await launchBrowserForSlot(i);
        setSlotState(i, 'free');
      } catch (err) {
        console.error(
          `[BrowserPool] failed to launch browser for slot ${i}:`,
          err,
        );
      }
    }
  }

  async function ensureBrowser(slotId: number): Promise<Browser> {
    const s = slots[slotId];
    if (!s) throw new Error('invalid slot');
    if (s.browser) return s.browser;

    // publish single-flight promise and start relaunch
    if (!s.relaunchPromise) {
      s.relaunchPromise = relaunchBrowserForSlot(slotId);
    }

    await s.relaunchPromise;
    if (!s.browser) throw new Error('failed to ensure browser');
    return s.browser;
  }

  // Helper: safely revert an acquiring slot back to free if possible
  function revertAcquiringToFree(slotId: number) {
    const s = slots[slotId];
    if (!s) return;
    // only revert if still acquiring (no other transition)
    if (s.state === 'acquiring') {
      setSlotState(slotId, 'free');
    }
  }

  async function acquireContext(): Promise<PoolContext> {
    if (!inited)
      throw new Error('BrowserPool not initialized. Call init() first.');
    if (closed) throw new Error('BrowserPool is closed');
    if (waiters.size() >= MAX_WAITERS)
      throw new Error('BrowserPool too many waiters');

    // Try to reserve a free slot synchronously
    const slotId = tryReserveFreeSlot();
    if (typeof slotId !== 'undefined') {
      const s = slots[slotId];
      // snapshot browser and browserVersion immediately after CAS
      const browserSnapshot = s.browser;
      const versionSnapshot = s.browserVersion;
      if (!browserSnapshot) {
        // nothing to use — revert and fallthrough
        revertAcquiringToFree(slotId);
      } else {
        try {
          // create context from the snapped browser
          const context = await createContextWithTimeout(browserSnapshot);

          // verify ownership/token still matches before committing lease
          const sNow = slots[slotId];
          if (
            !sNow ||
            sNow.browser !== browserSnapshot ||
            sNow.browserVersion !== versionSnapshot ||
            sNow.state !== 'acquiring'
          ) {
            // stale: close created context and revert slot
            try {
              await context.close();
            } catch {}
            revertAcquiringToFree(slotId);
            // treat as not-acquired; fallthrough to enqueue
          } else {
            // commit lease
            const nextLeaseId = sNow.leaseId + 1;
            sNow.leaseId = nextLeaseId;
            setSlotState(slotId, 'leased');

            // record active lease idempotently
            const key = leaseKey(slotId, nextLeaseId);
            activeLeaseSet.add(key);

            return {
              browser: browserSnapshot,
              context,
              _slotId: slotId,
              leaseId: nextLeaseId,
            };
          }
        } catch (e) {
          // creation failed; revert slot to free
          revertAcquiringToFree(slotId);
          throw e;
        }
      }
    }

    // No free slot -> enqueue waiter
    const ticket = waiters.push();

    // Setup timeout to cancel queued ticket
    let timer: any = setTimeout(() => {
      waiters.cancelQueued(ticket.id);
    }, WAIT_TIMEOUT_MS);

    ticket.promise.finally(() => clearTimeout(timer));

    return ticket.promise;
  }

  async function releaseContext(ctx: PoolContext): Promise<void> {
    const slotId = ctx._slotId;
    const s = slots[slotId];
    if (!s) return;

    const capturedLeaseId = ctx.leaseId;

    // Quick synchronous guards
    if (s.leaseId !== capturedLeaseId) return;
    if (s.releasing) return;
    s.releasing = true;

    // compute active-lease key and remove on finalization (idempotent)
    const key = leaseKey(slotId, capturedLeaseId);

    try {
      try {
        await ctx.context.close();
      } catch (err) {
        console.error(
          `[BrowserPool] context.close() failed for slot=${slotId}:`,
          err,
        );
      }

      // re-check lease id after await
      // even if s.leaseId changed, this release call completes the client's lease lifecycle
      if (closed) {
        try {
          if (
            s.onDisconnected &&
            s.browser &&
            (s.browser as any).removeListener
          ) {
            (s.browser as any).removeListener('disconnected', s.onDisconnected);
          }
          if (s.browser) {
            // clear browser so snapshots become invalid
            const prev = s.browser;
            assignSlotBrowser(slotId, undefined, undefined);
            try {
              await prev!.close();
            } catch {}
          }
        } catch (err) {
          console.error(
            `[BrowserPool] browser.close() during shutdown failed for slot=${slotId}:`,
            err,
          );
        } finally {
          setSlotState(slotId, 'closing');
        }
        return;
      }

      // Try atomic waiter reservation first (synchronously)
      const ticket = waiters.reserveTicket();
      if (ticket) {
        // We now own the ticket reservation; lifecycle fence: if closed cancel
        if (closed) {
          waiters.cancelReserved(ticket.id);
          setSlotState(slotId, 'free');
          return;
        }

        // snapshot browser + version now
        const browserSnapshot = s.browser;
        const versionSnapshot = s.browserVersion;
        if (!browserSnapshot) {
          // cannot serve waiter right now
          waiters.cancelReserved(ticket.id);
          setSlotState(slotId, 'free');
          return;
        }

        try {
          // create context from the snapshot
          const context = await createContextWithTimeout(browserSnapshot);

          // If reservation was canceled meanwhile, do not resolve; close created context and free slot
          const committed = waiters.commitReserved(ticket.id);
          if (!committed) {
            try {
              await context.close();
            } catch {}
            setSlotState(slotId, 'free');
            return;
          }

          // verify browser ownership/token is still valid
          const sNow = slots[slotId];
          if (
            !sNow ||
            sNow.browser !== browserSnapshot ||
            sNow.browserVersion !== versionSnapshot
          ) {
            // stale: cancel reservation and close context
            try {
              await context.close();
            } catch {}
            try {
              ticket.reject(new Error('slot changed during handoff'));
            } catch {}
            setSlotState(slotId, 'free');
            return;
          }

          // assign next lease id and set slot leased BEFORE resolving ticket
          const nextLeaseId = s.leaseId + 1;
          s.leaseId = nextLeaseId;
          setSlotState(slotId, 'leased');

          // record active lease idempotently
          const newKey = leaseKey(slotId, nextLeaseId);
          activeLeaseSet.add(newKey);

          try {
            ticket.resolve({
              browser: browserSnapshot,
              context,
              _slotId: slotId,
              leaseId: nextLeaseId,
            });
          } catch (err) {
            try {
              await context.close();
            } catch {}
            console.error(
              `[BrowserPool] resolving waiter failed for slot=${slotId}:`,
              err,
            );
            setSlotState(slotId, 'free');
          }
          return;
        } catch (e) {
          // failed to create context for reserved waiter: cancel reservation and free slot
          waiters.cancelReserved(ticket.id);
          setSlotState(slotId, 'free');
          return;
        }
      }

      // No waiter -> mark free
      setSlotState(slotId, 'free');
    } finally {
      // idempotent removal of lease tracking
      if (activeLeaseSet.delete(key)) {
        // removed one active lease
      }
      s.releasing = false;
    }
  }

  async function close(): Promise<void> {
    if (closed) return;
    closed = true;

    // reject all waiters
    waiters.drainReject(new Error('BrowserPool shutdown'));

    // give microtask tick so caller handlers can observe reject
    await Promise.resolve();

    // Wait for active leases to drain or timeout
    const waitForDrained = new Promise<void>((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (countActiveLeases() === 0) {
          clearInterval(interval);
          resolve();
          return;
        }
        if (Date.now() - start > SHUTDOWN_WAIT_MS) {
          clearInterval(interval);
          resolve();
          return;
        }
      }, 100);
    });

    await waitForDrained;

    // Wait for relaunches
    const relaunches = slots
      .map((s) => s.relaunchPromise)
      .filter(Boolean) as Promise<any>[];
    if (relaunches.length > 0) {
      try {
        await Promise.allSettled(relaunches);
      } catch {}
    }

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s && s.browser) {
        try {
          if (s.onDisconnected && (s.browser as any).removeListener) {
            (s.browser as any).removeListener('disconnected', s.onDisconnected);
          }
          const prev = s.browser;
          assignSlotBrowser(i, undefined, undefined);
          try {
            await prev!.close();
          } catch (err) {
            console.error(
              `[BrowserPool] error closing browser slot=${i}:`,
              err,
            );
          }
        } catch (err) {
          console.error(`[BrowserPool] error closing browser slot=${i}:`, err);
        } finally {
          setSlotState(i, 'closing');
        }
      }
    }
  }

  return { init, acquireContext, releaseContext, close };
}

/**
 * Simple runtime validator so callers can assert shape of a provided pool.
 */
export function validateAsBrowserPool(obj: any): obj is BrowserPoolInstance {
  return (
    obj &&
    typeof obj.init === 'function' &&
    typeof obj.acquireContext === 'function' &&
    typeof obj.releaseContext === 'function' &&
    typeof obj.close === 'function'
  );
}

export class BrowserPool implements BrowserPoolInstance {
  private readonly pool: BrowserPoolInstance;
  private readonly legacyLeases = new Map<Browser, PoolContext[]>();

  constructor(size = 2) {
    this.pool = createBrowserPoolInstance(size);
  }

  init(): Promise<void> {
    return this.pool.init();
  }

  acquireContext(): Promise<PoolContext> {
    return this.pool.acquireContext();
  }

  releaseContext(ctx: PoolContext): Promise<void> {
    return this.pool.releaseContext(ctx);
  }

  async acquire(): Promise<Browser> {
    const ctx = await this.pool.acquireContext();
    const leases = this.legacyLeases.get(ctx.browser) ?? [];
    leases.push(ctx);
    this.legacyLeases.set(ctx.browser, leases);
    return ctx.browser;
  }

  release(browser: Browser): void {
    const leases = this.legacyLeases.get(browser);
    const ctx = leases?.shift();

    if (!ctx) return;
    if (leases && leases.length === 0) {
      this.legacyLeases.delete(browser);
    }

    void this.pool.releaseContext(ctx);
  }

  close(): Promise<void> {
    this.legacyLeases.clear();
    return this.pool.close();
  }
}
