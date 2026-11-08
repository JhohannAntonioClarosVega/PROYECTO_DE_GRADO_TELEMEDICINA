import { useCallback, useEffect, useRef } from 'react';

const ADMIN_READ_TIMEOUT_MS = 30_000;

export interface AdminLoadRequest {
  signal: AbortSignal;
  isCurrent: () => boolean;
}

interface AdminLoadHandlers {
  onError: (error: unknown) => void;
  onSettled: () => void;
}

type AdminLoadTask = (request: AdminLoadRequest) => Promise<void>;
type RunLatest = (task: AdminLoadTask, handlers: AdminLoadHandlers) => Promise<boolean>;
type Outcome = { ok: true } | { ok: false; error: unknown };

interface Lifetime {
  active: boolean;
}

interface Job {
  version: number;
  task: AdminLoadTask;
  handlers: AdminLoadHandlers;
}

interface Flight {
  job: Job;
  controller: AbortController;
  timeout: ReturnType<typeof setTimeout> | null;
}

/** Coordinates read-only admin reloads; writes must only use the lifetime guard. */
export function useAdminLoad() {
  const lifetimeRef = useRef<Lifetime | null>(null);
  const runnerRef = useRef<RunLatest | null>(null);

  useEffect(() => {
    // A replayed effect receives a different object: its old guards stay invalid.
    const lifetime: Lifetime = { active: true };
    lifetimeRef.current = lifetime;
    let version = 0;
    let current: Flight | null = null;
    let queued: Job | null = null;
    const waiters: ((success: boolean) => void)[] = [];

    const resolveWaiters = (success: boolean) => {
      const completed = waiters.splice(0);
      completed.forEach(resolve => resolve(success));
    };

    const isCurrent = (flight: Flight) =>
      lifetime.active && current === flight && flight.job.version === version;

    const reportHandlerError = (error: unknown) => {
      console.error('Error en la continuación de una recarga administrativa:', error);
    };

    const complete = (flight: Flight, outcome: Outcome) => {
      if (current !== flight) return;
      if (flight.timeout !== null) clearTimeout(flight.timeout);
      const valid = isCurrent(flight);
      current = null;
      if (!lifetime.active) return;
      if (queued) {
        startQueued();
        return;
      }
      if (!valid) return;

      let success = outcome.ok;
      if (!outcome.ok) {
        try {
          flight.job.handlers.onError(outcome.error);
        } catch (error: unknown) {
          success = false;
          reportHandlerError(error);
        }
      }
      // A handler may synchronously request another reload or close the screen.
      if (!lifetime.active || version !== flight.job.version || current || queued) return;
      try {
        flight.job.handlers.onSettled();
      } catch (error: unknown) {
        success = false;
        reportHandlerError(error);
      }
      if (!lifetime.active || version !== flight.job.version || current || queued) return;
      resolveWaiters(success);
    };

    function startQueued() {
      if (!lifetime.active || current || !queued) return;
      const job = queued;
      queued = null;
      const flight: Flight = { job, controller: new AbortController(), timeout: null };
      current = flight;
      flight.timeout = setTimeout(() => {
        if (current !== flight || !lifetime.active) return;
        const error = new Error('Timeout: la recarga administrativa tardó más de 30 segundos.');
        error.name = 'TimeoutError';
        complete(flight, { ok: false, error });
        // Invalidate before aborting, even when the transport ignores cancellation.
        flight.controller.abort();
      }, ADMIN_READ_TIMEOUT_MS);

      void Promise.resolve().then(() => {
        if (!isCurrent(flight)) return;
        return job.task({ signal: flight.controller.signal, isCurrent: () => isCurrent(flight) });
      }).then(
        () => complete(flight, { ok: true }),
        (error: unknown) => complete(flight, { ok: false, error })
      );
    }

    const enqueue: RunLatest = (task, handlers) => {
      if (!lifetime.active) return Promise.resolve(false);
      version += 1;
      queued = { task, handlers, version };
      const result = new Promise<boolean>(resolve => { waiters.push(resolve); });
      if (current) {
        // Keep one trailing reload; a burst must not start parallel reads.
        current.controller.abort();
      } else {
        startQueued();
      }
      return result;
    };
    runnerRef.current = enqueue;

    return () => {
      lifetime.active = false;
      if (lifetimeRef.current === lifetime) lifetimeRef.current = null;
      if (runnerRef.current === enqueue) runnerRef.current = null;
      queued = null;
      const flight = current;
      current = null;
      if (flight) {
        if (flight.timeout !== null) clearTimeout(flight.timeout);
        flight.controller.abort();
      }
      resolveWaiters(false);
    };
  }, []);

  const runLatest = useCallback<RunLatest>((task, handlers) =>
    runnerRef.current?.(task, handlers) ?? Promise.resolve(false), []);
  const captureLifetime = useCallback(() => {
    const lifetime = lifetimeRef.current;
    return () => lifetime?.active ?? false;
  }, []);
  const isMounted = useCallback(() => lifetimeRef.current?.active ?? false, []);

  return { runLatest, captureLifetime, isMounted };
}
