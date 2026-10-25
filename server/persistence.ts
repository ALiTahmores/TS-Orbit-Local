import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';
import type { DbService } from '../src/data/dbService.ts';

interface Unit {
  active: boolean;
  events: Array<() => void | Promise<void>>;
  rollback: Array<() => void | Promise<void>>;
  prepareStream?: () => Promise<void>;
}

/** The queue protects the compatibility object; PostgreSQL protects the same
 * transaction across instances. No success or response byte precedes commit. */
export class PersistenceCoordinator {
  private pending: Array<() => void | Promise<void>> = [];
  private running = false;
  private stopping = false;
  private context = new AsyncLocalStorage<Unit>();
  private idleWaiters: Array<() => void> = [];
  constructor(private db: DbService) {}
  private enqueue(task: () => void | Promise<void>): boolean {
    if (this.stopping || this.pending.length >= 128) return false;
    this.pending.push(task); this.drain(); return true;
  }
  private drain(): void {
    if (this.running) return;
    const task = this.pending.shift();
    if (!task) { this.idleWaiters.splice(0).forEach(resolve => resolve()); return; }
    this.running = true;
    try { void Promise.resolve(task()).catch(error => { console.error('Storage queue failed:', error?.code || 'storage error'); this.release(); }); }
    catch (error) { console.error('Storage queue failed:', error); this.release(); }
  }
  private release(): void { this.running = false; queueMicrotask(() => this.drain()); }
  afterCommit(event: () => void | Promise<void>): void {
    const unit = this.context.getStore();
    if (!unit) { this.dispatch([event]); return; }
    if (unit.active) unit.events.push(event);
  }
  private dispatch(events: Unit['events']): void {
    for (const event of events) {
      try { void Promise.resolve(event()).catch(error => console.error('Committed delivery failed:', error?.code || 'delivery error')); }
      catch (error) { console.error('Committed delivery failed:', error); }
    }
  }
  isActive(): boolean { return this.context.getStore()?.active === true; }
  onRollback(cleanup: () => void | Promise<void>): void {
    const unit = this.context.getStore();
    if (!unit?.active) throw new Error('No active storage transaction.');
    unit.rollback.push(cleanup);
  }
  async prepareStream(): Promise<void> {
    const unit = this.context.getStore();
    if (!unit?.active || !unit.prepareStream) throw new Error('No active HTTP storage transaction.');
    await unit.prepareStream();
  }
  private async rollback(unit: Unit): Promise<void> {
    // Async rollback may yield to a disconnected upload continuation. Revoke
    // its write authority immediately, before touching the remote transaction.
    unit.active = false;
    try { await this.db.rollbackTransaction(); }
    finally {
      unit.events.length = 0;
      for (const cleanup of unit.rollback.splice(0).reverse()) {
        try { await cleanup(); } catch (error) { console.error('Storage cleanup deferred:', (error as any)?.code || 'cleanup error'); }
      }
    }
  }
  middleware = (req: Request, res: Response, next: NextFunction): void => {
    if (!/^\/api\//i.test(req.path)) { next(); return; }
    const accepted = this.enqueue(async () => {
      if (res.destroyed) { this.release(); return; }
      const unit: Unit = { active: true, events: [], rollback: [] };
      const originalEnd = res.end;
      let finalized = false, finalizing = false;
      const finish = () => { if (finalized) return; finalized = true; unit.active = false; this.release(); };
      const restore = () => { res.end = originalEnd; };
      const failure = async (error: any) => {
        try { await this.rollback(unit); } catch (rollbackError) { console.error('Storage rollback failed:', rollbackError); }
        console.error('Storage operation failed:', error?.code || error?.name || 'database error');
        if (!res.headersSent && !res.destroyed) {
          res.statusCode = error?.code === 'DATA_VALIDATION_FAILED' ? 422 : 503;
          res.removeHeader('Content-Length'); res.removeHeader('ETag');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          if (res.statusCode === 503) res.setHeader('Retry-After', '1');
          originalEnd.call(res, JSON.stringify({ error: res.statusCode === 422 ? 'DATA_VALIDATION_FAILED' : 'STORAGE_UNAVAILABLE', message: 'تغییرات ذخیره نشد؛ اطلاعات قبلی محفوظ است. دوباره تلاش کنید.' }));
        } else if (!res.destroyed) res.destroy();
      };
      try { await this.db.beginTransaction(); }
      catch (error) { restore(); await failure(error); finish(); return; }
      if (res.destroyed) { await this.rollback(unit); finish(); return; }
      unit.prepareStream = async () => {
        if (finalized || finalizing || res.destroyed || res.statusCode >= 400) throw new Error('Response unavailable for streaming.');
        finalizing = true;
        try {
          const log = (req as any).storageLog; if (log) log.status = res.statusCode;
          await this.db.commitTransaction(); unit.rollback.length = 0;
          restore(); const events = unit.events.splice(0); finish(); this.dispatch(events);
        } catch (error) { restore(); await failure(error); finish(); throw error; }
      };
      const coordinator = this;
      res.end = function (this: Response, ...args: any[]) {
        if (finalized || finalizing) return this;
        finalizing = true;
        const finalize = async () => {
          try {
            if (res.destroyed) await coordinator.rollback(unit);
            else if (res.statusCode >= 400) {
              const log = (req as any).storageLog;
              const retainedLog = log ? structuredClone({ ...log, status: res.statusCode }) : null;
              const securityAudit = (req as any).retainedSecurityAudit;
              await coordinator.rollback(unit);
              if (retainedLog || securityAudit) {
                await coordinator.db.beginTransaction(); const state = coordinator.db.getState();
                if (retainedLog) state.apiLogs.unshift(retainedLog);
                if (state.apiLogs.length > 50) state.apiLogs.pop();
                if (securityAudit) { state.loginHistory.push(...securityAudit.loginHistory); state.securityEvents.push(...securityAudit.securityEvents); }
                await coordinator.db.commitTransaction();
              }
              unit.events.length = 0;
            } else {
              const log = (req as any).storageLog; if (log) log.status = res.statusCode;
              await coordinator.db.commitTransaction(); unit.rollback.length = 0;
            }
            const events = unit.events.splice(0); restore(); finish();
            if (!res.destroyed) originalEnd.apply(res, args as any);
            coordinator.dispatch(events);
          } catch (error) { restore(); await failure(error); finish(); }
        };
        void finalize(); return this;
      } as Response['end'];
      res.once('close', () => {
        if (finalized || finalizing) return;
        finalizing = true; restore();
        void this.rollback(unit).catch(error => console.error('Aborted storage rollback failed:', error)).finally(finish);
      });
      this.context.run(unit, () => { try { next(); } catch (error) { next(error); } });
    });
    if (!accepted) res.status(503).json({ error: 'STORAGE_BUSY', message: 'سرور مشغول است؛ دوباره تلاش کنید.' });
  };
  mutateResult<T>(operation: () => T | Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.enqueue(async () => {
        const unit: Unit = { active: true, events: [], rollback: [] };
        try {
          await this.db.beginTransaction();
          const result = await this.context.run(unit, operation);
          await this.db.commitTransaction(); unit.rollback.length = 0; unit.active = false;
          this.dispatch(unit.events); resolve(result);
        } catch (error) { try { await this.rollback(unit); } catch (rollbackError) { console.error('Realtime rollback failed:', rollbackError); } reject(error); }
        finally { unit.active = false; this.release(); }
      })) reject(Object.assign(new Error('Storage is busy or stopping.'), { code: 'STORAGE_BUSY', status: 503 }));
    });
  }
  mutate(operation: () => void | Promise<void>): void {
    void this.mutateResult(operation).catch(error => console.error('Realtime storage failed:', error?.code || 'database error'));
  }
  async stop(): Promise<void> {
    this.stopping = true;
    if (!this.running && !this.pending.length) return;
    await new Promise<void>(resolve => this.idleWaiters.push(resolve));
  }
}
