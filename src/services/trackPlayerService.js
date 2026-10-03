import TrackPlayer, { Event } from 'react-native-track-player';

// iOS 锁屏 / 控制中心 / 耳机线控 / 蓝牙车机的远程控制回调。
// 通过 App.js 顶层的 TrackPlayer.registerPlaybackService 注册。
//
// 设计原则：这里只做最可靠的"直连原生"操作（skipToNext / skipToPrevious / pause 等），
// 不依赖任何 JS store 状态链——锁屏时任何 store 逻辑失败都会导致按钮"按了没反应"。
// App 内的队列定位、迷你条、进度显示由全局的 PlaybackTrackChanged /
// PlaybackProgressUpdated 事件自动同步，锁屏操作后界面状态自然一致。
// 注意：必须用 module.exports =（不能用 export default）。
// App.js 通过 registerPlaybackService(() => require(...)) 懒加载本模块，
// Babel 会把 export default 编译成 { default: fn } 命名空间对象，require() 拿到的是对象而非函数，
// RNTP v4 启动时调用会直接崩溃（表现为"完全进不去 App"）。module.exports = 才能让 require 返回函数本身。
module.exports = async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play().catch(() => {});
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause().catch(() => {});
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.stop().catch(() => {});
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    TrackPlayer.skipToNext().catch(() => {});
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    TrackPlayer.skipToPrevious().catch(() => {});
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, (e) => {
    const p = e && typeof e.position === 'number' ? e.position : NaN;
    if (isFinite(p) && p >= 0) {
      TrackPlayer.seekTo(p).catch(() => {});
    }
  });
  TrackPlayer.addEventListener(Event.RemoteDuck, () => {
    /* 音频焦点变化，iOS 上无需处理 */
  });
}
