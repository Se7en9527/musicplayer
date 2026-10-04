// 锁屏 / 控制中心 / 耳机线控 / 蓝牙车机 的远程控制集中注册点。
// 之前锁屏“按了没反应”的根因：远程处理逻辑原本放在独立的 PlaybackService 模块里，
// 而该模块用 require() 懒加载——生产包里路径/导出方式不稳定，service 从未注册 → 所有
// Remote* 事件石沉大海（系统按钮有视觉反馈，但音乐不动）。
//
// 修复方案（RNTP v4 官方推荐 + 双保险）：
// ① 这里用「模块级去重守卫」注册一次远程监听，无论从 init() 还是从 service 调用都只注册一遍，
//    绝不重复（重复会 “下一首跳两首”）。
// ② App.js 通过 registerPlaybackService(() => require('./src/services/trackPlayerService'))
//    走 RNTP 标准 service 路径（iOS 上 registerPlaybackService 只是 setImmediate 跑在同一 JS 线程，
//    与 App 上下文等价，是 RNTP 期望且测试过的路径）。
// ③ usePlayerStore.init() 也会调用 registerRemoteHandlers() 作为保底（App 模块加载先于 init，
//    两条路径有守卫去重）。
//
// 事件名已对照 RNTP v4.1.1 源码确认：iOS 锁屏那个播放/暂停按钮原生发的是 RemotePlay/RemotePause
// （togglePlayPauseCommand 内部按当前状态二选一转发，没有独立的 RemoteTogglePlayPause 事件）。
import TrackPlayer, { Event } from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';

// 构建校验标记：字符串字面量在 Metro 压缩后依然保留，rebuild 脚本会 grep main.jsbundle 确认本文件已入包。
const BUILD_MARKER = '__LSCTL_V2__';

let _registered = false;

export function registerRemoteHandlers() {
  if (_registered) return;
  _registered = true;
  try {
    if (typeof globalThis !== 'undefined') globalThis[BUILD_MARKER] = 1;
  } catch (e) {
    /* noop */
  }
  // 标记：远程监听已注册（屏内调试 HUD 会读取）
  try { usePlayerStore.getState()._setRemoteDebug({ handlers: true }); } catch (e) {}

  const mark = (name) => {
    try { usePlayerStore.getState()._setRemoteDebug({ lastEvent: name }); } catch (e) {}
  };

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    mark('RemotePlay');
    // 锁屏/控制中心点 “播放”
    TrackPlayer.play().catch(() => {});
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    mark('RemotePause');
    // 锁屏/控制中心点 “暂停”
    TrackPlayer.pause().catch(() => {});
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    mark('RemoteStop');
    TrackPlayer.stop().catch(() => {});
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    mark('RemoteNext');
    // ★ 不主动跳歌：原生兜底 handler（patch_rntp.py 已注入）已直接调 player.next() 切歌。
    // 这里只把 UI 对齐到播放器真实的当前曲目，避免“原生跳一次 + JS 再跳一次 = 跳两首”。
    usePlayerStore.getState()._syncToPlayer();
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    mark('RemotePrevious');
    // 同上：原生 handler 已 player.previous()，这里仅做 UI 同步。
    usePlayerStore.getState()._syncToPlayer();
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, (e) => {
    mark('RemoteSeek');
    // 锁屏拖动进度条快进
    const p = e && typeof e.position === 'number' ? e.position : NaN;
    if (isFinite(p) && p >= 0) usePlayerStore.getState().seek(p);
  });
}
