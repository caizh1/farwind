import { validate, type State } from "./state";
// 会发布副本的原子事务使用此锁；普通战斗快照只进保存队列，不持有该锁。
export class StateCommit {
  busy = false;
  constructor(
    private readonly onBegin: () => void = () => {},
    private readonly onEnd: () => void = () => {},
  ) {}
  async run(
    read: () => State,
    build: (s: State) => State,
    write: (s: State) => Promise<void>,
    publish: (s: State) => void,
  ) {
    if (this.busy) throw Error("状态正在保存，请稍候。");
    this.busy = true;
    try {
      this.onBegin();
      // 锁立即生效，但等当前同步更新收齐驻防通知与进度后再取快照。
      // 后续帧与用户事件仍受busy门禁，避免同帧尾部写入被副本发布覆盖。
      await Promise.resolve();
      const next = validate(build(read()));
      await write(next);
      publish(next);
    } finally {
      this.busy = false;
      this.onEnd();
    }
  }
}
