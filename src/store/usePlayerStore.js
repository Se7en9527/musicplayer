import { create } from 'zustand';
import TrackPlayer, {
  Capability,
  RepeatMode,
  Event,
  State,
} from 'react-native-track-player';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';

const AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.opus', '.ogg', '.wma'];

function isAudio(name) {
  const lower = (name || '').toLowerCase();
  return AUDIO_EXT.some((ext) => lower.endsWith(ext));
}

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % 360;
  }
  return h;
}

function cleanTitle(name) {
  return (name || '未命名').replace(/\.[^.]+$/, '');
}

function sortTracks(list, mode) {
  const arr = [...list];
  if (mode === 'album') {
    arr.sort((a, b) => (a.album || '').localeCompare(b.album || '', 'zh'));
  } else {
    arr.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh'));
  }
  return arr;
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mergeById(base, incoming) {
  const map = new Map();
  base.forEach((t) => map.set(t.id, t));
  incoming.forEach((t) => {
    if (!map.has(t.id)) map.set(t.id, t);
  });
  return Array.from(map.values());
}

function toTPTrack(t) {
  return {
    id: t.id,
    url: t.url || t.uri,
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration: t.duration || undefined,
  };
}

function indexOfId(queue, id) {
  if (id == null) return -1;
  return queue.findIndex((t) => t.id === id);
}

export const usePlayerStore = create((set, get) => ({
  library: [],
  queue: [],
  currentIndex: -1,
  currentId: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  repeatMode: 'order', // 'order' | 'one' | 'shuffle'
  sortMode: 'title', // 'title' | 'album'
  playlistVisible: false,
  ready: false,
  loading: false,

  init: async () => {
    try {
      await TrackPlayer.setupPlayer();
    } catch (e) {
      // already setup
    }
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.Seek,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause],
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      // v4 必须显式配置，否则不会周期性发 PlaybackProgressUpdated 事件（进度条不动）
      progressUpdateEventInterval: 1,
    });
    set({ ready: true });

    TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
      set({ isPlaying: state === State.Playing });
    });
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ position, duration }) => {
      set({ position, duration: duration || 0 });
    });
    TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async ({ track }) => {
      const queue = get().queue;
      const idx = indexOfId(queue, track);
      if (idx >= 0) set({ currentIndex: idx, currentId: track });
    });

    await get().loadLibrary();
  },

  loadLibrary: async () => {
    set({ loading: true });
    const dir = FileSystem.documentDirectory;
    let files = [];
    try {
      const ents = await FileSystem.readDirectoryAsync(dir);
      files = ents.filter(isAudio);
    } catch (e) {
      files = [];
    }
    const docTracks = files.map((name) => {
      const title = cleanTitle(name);
      return {
        id: 'doc_' + name,
        title,
        artist: '未知歌手',
        album: '本地音乐',
        url: dir + name,
        uri: dir + name,
        artwork: null,
        hue: hashHue(name),
        source: 'doc',
      };
    });
    const merged = mergeById(get().library, docTracks);
    set({ library: merged });
    // rebuild playback/display queue according to current mode
    get()._rebuildQueue(merged);
    set({ loading: false });
    return docTracks.length;
  },

  importFromMediaLibrary: async () => {
    try {
      let perm = await MediaLibrary.getPermissionsAsync();
      let status = perm.status;
      if (status !== 'granted' && status !== 'limited') {
        const req = await MediaLibrary.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted' && status !== 'limited') {
        return { ok: false, reason: 'denied' };
      }
      const res = await MediaLibrary.getAssetsAsync({
        mediaType: 'audio',
        first: 1000,
      });
      const added = [];
      for (const a of res.assets || []) {
        let url = a.uri;
        try {
          const info = await MediaLibrary.getAssetInfoAsync(a.id);
          if (info && info.localUri) url = info.localUri;
        } catch (e) {
          /* ignore */
        }
        added.push({
          id: 'lib_' + a.id,
          title: cleanTitle(a.filename || a.title || a.id),
          artist: '未知歌手',
          album: a.albumTitle || '音乐库',
          url,
          uri: url,
          artwork: null,
          hue: hashHue(a.filename || a.title || a.id),
          source: 'lib',
        });
      }
      const merged = mergeById(get().library, added);
      set({ library: merged });
      get()._rebuildQueue(merged);
      return { ok: true, count: added.length };
    } catch (e) {
      return { ok: false, reason: 'error', message: String((e && e.message) || e) };
    }
  },

  // 从「文件」App / 其他 App 通过系统选择器导入音频，拷入本地 Documents 持久化
  importFromFiles: async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'application/mp3', 'application/m4a', 'application/x-m4a', 'application/octet-stream'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return { ok: true, count: 0, canceled: true };
      const assets = result.assets || [];
      const dir = FileSystem.documentDirectory;
      const added = [];
      let copied = 0;
      for (const a of assets) {
        const name = a.name || (a.uri || '').split('/').pop() || 'track';
        if (!isAudio(name)) continue;
        const dest = dir + name;
        try {
          const info = await FileSystem.getInfoAsync(dest);
          if (!info.exists) {
            await FileSystem.copyAsync({ from: a.uri, to: dest });
          }
          copied++;
          added.push({
            id: 'doc_' + name,
            title: cleanTitle(name),
            artist: '未知歌手',
            album: '本地音乐',
            url: dest,
            uri: dest,
            artwork: null,
            hue: hashHue(name),
            source: 'doc',
          });
        } catch (e) {
          /* 单个文件失败不影响其余 */
        }
      }
      const merged = mergeById(get().library, added);
      set({ library: merged });
      get()._rebuildQueue(merged);
      return { ok: true, count: copied };
    } catch (e) {
      return { ok: false, reason: 'error', message: String((e && e.message) || e) };
    }
  },

  _rebuildQueue: (library) => {
    const { repeatMode, sortMode, currentId } = get();
    let queue = sortTracks(library, sortMode);
    if (repeatMode === 'shuffle') queue = shuffle(queue);
    set({ queue });
    if (currentId != null) {
      const idx = indexOfId(queue, currentId);
      if (idx >= 0) set({ currentIndex: idx });
    }
    // sync TrackPlayer queue if player ready
    if (get().ready && queue.length > 0) {
      TrackPlayer.setQueue(queue.map(toTPTrack)).catch(() => {});
    }
  },

  setSortMode: (mode) => {
    set({ sortMode: mode });
    get()._rebuildQueue(get().library);
  },

  setRepeatMode: (mode) => {
    set({ repeatMode: mode });
    const rm = mode === 'one' ? RepeatMode.One : RepeatMode.Queue;
    TrackPlayer.setRepeatMode(rm).catch(() => {});
    get()._rebuildQueue(get().library);
  },

  cycleRepeat: () => {
    const order = ['order', 'one', 'shuffle'];
    const cur = get().repeatMode;
    const nextMode = order[(order.indexOf(cur) + 1) % order.length];
    get().setRepeatMode(nextMode);
  },

  playFromLibrary: async (indexInLibrary) => {
    const { library } = get();
    const track = library[indexInLibrary];
    if (!track) return;
    const queue = sortTracks(library, get().sortMode);
    const idx = indexOfId(queue, track.id);
    await get()._playQueueAt(queue, idx < 0 ? 0 : idx);
  },

  _playQueueAt: async (queue, startIndex) => {
    set({ queue, currentIndex: startIndex, currentId: queue[startIndex]?.id });
    await TrackPlayer.setQueue(queue.map(toTPTrack));
    await TrackPlayer.skip(startIndex);
    await TrackPlayer.play();
    set({ isPlaying: true });
  },

  togglePlay: async () => {
    const { isPlaying, queue, currentIndex } = get();
    if (queue.length === 0) {
      if (get().library.length > 0) return get().playFromLibrary(0);
      return;
    }
    if (isPlaying) {
      await TrackPlayer.pause();
      set({ isPlaying: false });
    } else {
      if (currentIndex < 0) await TrackPlayer.skip(0);
      await TrackPlayer.play();
      set({ isPlaying: true });
    }
  },

  next: async () => {
    const { queue, currentIndex, repeatMode } = get();
    if (queue.length === 0) return;
    let idx;
    if (repeatMode === 'shuffle') {
      idx = Math.floor(Math.random() * queue.length);
    } else {
      idx = currentIndex + 1;
      if (idx >= queue.length) idx = 0;
    }
    await TrackPlayer.skip(idx);
    await TrackPlayer.play();
    set({ currentIndex: idx, currentId: queue[idx]?.id, isPlaying: true });
  },

  prev: async () => {
    const { queue, currentIndex, position } = get();
    if (queue.length === 0) return;
    if (position > 3) {
      await TrackPlayer.seekTo(0);
      set({ position: 0 });
      return;
    }
    let idx = currentIndex - 1;
    if (idx < 0) idx = queue.length - 1;
    await TrackPlayer.skip(idx);
    await TrackPlayer.play();
    set({ currentIndex: idx, currentId: queue[idx]?.id, isPlaying: true });
  },

  seek: async (pos) => {
    await TrackPlayer.seekTo(pos);
    set({ position: pos });
  },

  jumpToQueueIndex: async (idx) => {
    const { queue } = get();
    if (idx < 0 || idx >= queue.length) return;
    await TrackPlayer.skip(idx);
    await TrackPlayer.play();
    set({ currentIndex: idx, currentId: queue[idx]?.id, isPlaying: true, playlistVisible: false });
  },

  showPlaylist: () => set({ playlistVisible: true }),
  hidePlaylist: () => set({ playlistVisible: false }),

  currentTrack: () => {
    const { queue, currentIndex } = get();
    return queue[currentIndex] || null;
  },
}));
