import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';
import type { DbService } from '../src/data/dbService.ts';

interface Unit {
  active: boolean;
  events: Array<() => void>;
  rollback: Array<() => void>;
  prepareStream?: () => void;
}

/** Existing synchronous handlers share a compatibility state. Serialize its
 * units of work, and commit durable data before a response or event is sent. */
export class PersistenceCoordinator {
  private pending: Array<() => void> = [];
  private running = false;
  private stopping = false;
  private context = new AsyncLocalStorage<Unit>();
  private idleWaiters: Array<() => void> = [];

  constructor(private db: DbService) {}

  private enqueue(task: () => void): boolean {
    if (this.stopping || this.pending.length >= 128) return false;
    this.pending.push(task);
    this.drain();
    return true;
  }

  private drain(): void {
    if (this.running) return;
    const task = this.pending.shift();
    if (!task) { this.idleWaiters.splice(0).forEach(resolve => resolve()); return; }
    this.running = true;
    task();
  }

  private release(): void {
    this.running = false;
    queueMicrotask(() => this.drain());
  }

  afterCommit(event: () => void): void {
    const unit = this.context.getStore();
    if (!unit) { event(); return; }
    if (unit.active) unit.events.push(event);
  }

  isActive(): boolean { return this.context.getStore()?.active === true; }

  /** Files published before SQL commit are removed if the request fails. */
  onRollback(cleanup: () => void): void {
    const unit = this.context.getStore();
    if (!unit?.active) throw new Error('No active storage transaction.');
    unit.rollback.push(cleanup);
  }

  /** Finish the authorized read transaction before the first response byte. */
  prepareStream(): void {
    const unit = this.context.getStore();
    if (!unit?.active || !unit.prepareStream) throw new Error('No active HTTP storage transaction.');
    unit.prepareStream();
  }

  private rollback(unit: Unit): void {
    try { this.db.rollbackTransaction(); }
    finally {
      unit.events.length = 0;
      for (const cleanup of unit.rollback.splice(0).reverse()) {
        try { cleanup(); } catch (error) { console.error('Storage file cleanup deferred:', (error as any)?.code || 'cleanup error'); }
      }
    }
  }

  middleware = (req: Request, res: Response, next: NextFunction): void => {
    if (!/^\/api\//i.test(req.path)) { next(); return; }
    const accepted = this.enqueue(() => {
      if (res.destroyed) { this.release(); return; }
      const unit: Unit = { active: true, events: [], rollback: [] };
      const originalEnd = res.end;
      let finalized = false;
      const finish = () => { if (finalized) return; finalized = true; unit.active = false; this.release(); };
      const restoreResponse = () => { res.end = originalEnd; };
      const failure = (error: any) => {
        try { this.rollback(unit); } catch (rollbackError) { console.error('Storage rollback failed:', rollbackError); }
        unit.events.length = 0;
        console.error('Storage operation failed:', error?.code || error?.name || 'database error');
        if (!res.headersSent && !res.destroyed) {
          res.statusCode = error?.code === 'DATA_VALIDATION_FAILED' ? 422 : 503;
          res.removeHeader('Content-Length');
          res.removeHeader('ETag');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          if (res.statusCode === 503) res.setHeader('Retry-After', '1');
          originalEnd.call(res, JSON.stringify({ error: res.statusCode === 422 ? 'DATA_VALIDATION_FAILED' : 'STORAGE_UNAVAILABLE',
            message: 'تغییرات ذخیره نشد؛ داده‌های قبلی حفظ شده‌اند. جزئیات را در وضعیت دیتابیس بررسی کنید.' }));
        } else if (!res.destroyed) res.destroy();
      };
      try { this.db.beginTransaction(); }
      catch (error) { restoreResponse(); failure(error); finish(); return; }

      unit.prepareStream = () => {
        if (finalized || res.destroyed || res.statusCode >= 400) throw new Error('Response is unavailable for streaming.');
        try {
          const log = (req as any).storageLog;
          if (log) log.status = res.statusCode;
          this.db.commitTransaction();
          unit.rollback.length = 0;
          restoreResponse();
          const events = unit.events.splice(0);
          finish();
          for (const event of events) {
            try { event(); } catch (error) { console.error('Committed event delivery failed:', error); }
          }
        } catch (error) {
          restoreResponse(); failure(error); finish(); throw error;
        }
      };

      res.end = function (this: Response, ...args: any[]) {
        if (finalized) return this;
        restoreResponse();
        try {
          if (this.destroyed) thisCoordinator.rollback(unit);
          else if (this.statusCode >= 400) {
            // Preserve only the redacted request audit, not partial business
            // mutations performed by a handler that returned an error.
            const log = (req as any).storageLog;
            const retainedLog = log ? structuredClone({ ...log, status: this.statusCode }) : null;
            const securityAudit = (req as any).retainedSecurityAudit;
            thisCoordinator.rollback(unit);
            if (retainedLog || securityAudit) {
              thisCoordinator.db.beginTransaction();
              const state = thisCoordinator.db.getState();
              if (retainedLog) state.apiLogs.unshift(retainedLog);
              if (state.apiLogs.length > 50) state.apiLogs.pop();
              if (securityAudit) {
                state.loginHistory.push(...securityAudit.loginHistory);
                state.securityEvents.push(...securityAudit.securityEvents);
              }
              thisCoordinator.db.commitTransaction();
            }
            unit.events.length = 0;
          } else {
            const log = (req as any).storageLog;
            if (log) log.status = this.statusCode;
            thisCoordinator.db.commitTransaction();
            unit.rollback.length = 0;
          }
          unit.active = false;
          const result = originalEnd.apply(this, args as any);
          for (const event of unit.events) {
            try { event(); } catch (error) { console.error('Committed event delivery failed:', error); }
          }
          finish();
          return result;
        } catch (error) { failure(error); finish(); return this; }
      } as Response['end'];
      const thisCoordinator = this;
      res.once('close', () => {
        if (finalized) return;
        restoreResponse();
        try { this.rollback(unit); } catch (error) { console.error('Aborted request rollback failed:', error); }
        unit.events.length = 0;
        finish();
      });
      this.context.run(unit, () => {
        try { next(); }
        catch (error) { next(error); }
      });
    });
    if (!accepted) res.status(503).json({ error: 'STORAGE_BUSY', message: 'سرور در حال پایان کار یا رسیدگی به درخواست‌های دیگر است؛ دوباره تلاش کنید.' });
  };

  /** Socket presence is a write too; never let it modify an API snapshot. */
  mutateResult<T>(operation: () => T): Promise<T> {
    return new Promise((resolve,reject) => {
      if (!this.enqueue(() => {
        const unit:Unit={active:true,events:[],rollback:[]};
        try {
          this.db.beginTransaction();
          const result=this.context.run(unit,operation);
          this.db.commitTransaction();unit.rollback.length=0;unit.active=false;
          for(const event of unit.events){try{event();}catch(error){console.error('Committed event delivery failed:',error);}}
          resolve(result);
        }catch(error){try{this.rollback(unit);}catch(rollbackError){console.error('Realtime rollback failed:',rollbackError);}reject(error);}
        finally{unit.active=false;this.release();}
      }))reject(Object.assign(new Error('Storage is busy or stopping.'),{code:'STORAGE_BUSY',status:503}));
    });
  }

  /** Non-HTTP internal writes share the same serialized durable boundary. */
  mutate(operation: () => void): void {
    if (!this.enqueue(() => {
      const unit: Unit = { active: true, events: [], rollback: [] };
      try {
        this.db.beginTransaction();
        this.context.run(unit, operation);
        this.db.commitTransaction();
        unit.rollback.length = 0;
        unit.active = false;
        unit.events.forEach(event => { try { event(); } catch (error) { console.error('Committed event delivery failed:', error); } });
      } catch (error) {
        this.rollback(unit);
        console.error('Realtime storage operation failed:', (error as any)?.code || 'database error');
      } finally { unit.active = false; this.release(); }
    })) console.error('Realtime write rejected while storage is busy/stopping.');
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (!this.running && !this.pending.length) return;
    await new Promise<void>(resolve => this.idleWaiters.push(resolve));
  }
}
