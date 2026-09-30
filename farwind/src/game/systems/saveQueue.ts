import { validate, type State } from './state';

type Job = { snapshot: State; session: number; revision: number; automatic: boolean;
  done: Promise<void>; resolve: () => void; reject: (error: unknown) => void };

// 共用有界FIFO：只替换队尾尚未开始的自动快照，所有合并调用者等待实际落盘。
export class SaveQueue {
  session = 0;
  revision = 0;
  requested = 0;
  persisted = 0;
  private jobs: Job[] = [];
  private running: Job | null = null;
  private idle: (() => void)[] = [];
  constructor(private write: (snapshot: State) => Promise<void>) {}
  // 活世界变化不产生复制或写入；旧请求完成只确认它捕获的版本。
  markDirty() { this.revision++; }
  enqueue(state: State, automatic = false, captured?: (snapshot: State) => void) {
    const snapshot = validate(state), revision = ++this.revision;
    this.requested = revision;
    captured?.(snapshot);
    const tail = this.jobs.at(-1);
    if (automatic && tail?.automatic && tail.session === this.session) {
      tail.snapshot = snapshot; tail.revision = revision;
      return tail.done;
    }
    if (this.jobs.length >= 8) return Promise.reject(Error('保存队列已满，状态仍在内存，请稍后再保存。'));
    let resolve!: () => void, reject!: (error: unknown) => void;
    const done = new Promise<void>((ok, no) => { resolve = ok; reject = no; });
    this.jobs.push({ snapshot, session: this.session, revision, automatic, done, resolve, reject });
    void this.pump();
    return done;
  }
  private async pump() {
    if (this.running) return;
    for (let job; (job = this.jobs.shift());) {
      this.running = job;
      try {
        await this.write(job.snapshot);
        if (job.session === this.session) this.persisted = job.revision;
        job.resolve();
      } catch (error) { job.reject(error); }
    }
    this.running = null;
    for (const resolve of this.idle.splice(0)) resolve();
  }
  barrier() {
    return this.running || this.jobs.length ? new Promise<void>(ok => this.idle.push(ok)) : Promise.resolve();
  }
  async switchSession() {
    // 同步失效旧回调与排队作业；已开始的IDB事务必须完成，再允许新会话写入。
    this.session++;
    for (const job of this.jobs.splice(0)) job.reject(Error('旧旅途的保存已取消。'));
    await this.barrier();
    this.revision = this.requested = this.persisted = 0;
  }
  snapshot() { return { session: this.session, current: this.revision, requested: this.requested, persisted: this.persisted,
    dirty: this.revision !== this.persisted, queued: this.jobs.length, writing: !!this.running }; }
}
