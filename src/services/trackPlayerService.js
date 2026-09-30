import TrackPlayer, { Event } from 'react-native-track-player';

// iOS 锁屏 / 后台控制回调。必须在 App 启动时通过 registerPlaybackService 注册，
// 否则系统媒体控制中心（锁屏、控制中心、耳机线控、蓝牙车机）无法控制播放。
export default async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) =>
    TrackPlayer.seekTo(position)
  );
}
