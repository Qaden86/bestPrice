let shuttingDown = false;

export function requestShutdown(): void {
  shuttingDown = true;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function isShutdownError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    shuttingDown &&
    (/has been closed|Target closed|browser has been closed/i.test(msg) ||
      msg.includes('shutting down'))
  );
}
