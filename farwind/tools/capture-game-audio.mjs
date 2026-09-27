// 仅在录像工具中安装：旁路录制真实AudioContext输出，不改变游戏音量或战斗状态。
export function captureGameAudio() {
  const Original = window.AudioContext;
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (destination, ...args) {
    if (
      destination === this.context.destination &&
      this.context.__captureDestination
    )
      connect.call(this, this.context.__captureDestination);
    return connect.call(this, destination, ...args);
  };
  window.AudioContext = class extends Original {
    constructor(...args) {
      super(...args);
      this.__captureDestination = this.createMediaStreamDestination();
      // 零信号仅维持采集时钟，避免浏览器在无音效间隔产生稀疏音频时间戳。
      const silence = this.createConstantSource();
      silence.offset.value = 0;
      silence.connect(this.__captureDestination);
      silence.start();
      const recorder = new MediaRecorder(this.__captureDestination.stream);
      const chunks = [];
      // 采集从当前音频渲染时间线开始；onstart是异步通知，可能被首次PCM缓存阻塞。
      // 以启动前的渲染时钟映射墙钟，不把通知到达时间当成首个音频样本时间。
      const contextStart = this.currentTime;
      window.__audioStartedAt = performance.now();
      const captureStartedAt = window.__audioStartedAt;
      let startNotificationAt;
      recorder.onstart = () => {
        startNotificationAt = performance.now();
      };
      recorder.ondataavailable = (e) => chunks.push(e.data);
      window.__finishAudio = () =>
        new Promise((resolve) => {
          recorder.onstop = async () => {
            const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
            let binary = "";
            for (const b of bytes) binary += String.fromCharCode(b);
            resolve({
              base64: btoa(binary),
              offset: captureStartedAt / 1000,
              // 与录像creation_time同用墙钟，避免把页面导航后的performance原点当作录像起点。
              startedEpoch: (performance.timeOrigin + captureStartedAt) / 1000,
              contextStart,
              startNotificationDelay: startNotificationAt - captureStartedAt,
            });
          };
          recorder.stop();
          silence.stop();
        });
      recorder.start();
    }
  };
}
