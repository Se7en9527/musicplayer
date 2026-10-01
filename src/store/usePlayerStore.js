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
const STATE_FILE = 'player_state.json';
const PLAYLISTS_FILE = 'playlists.json';

// 上一次同步给 TrackPlayer 的队列 id 串（模块级变量，不参与渲染）。
// 核心防抖：只有队列内容真正变化时才调用 TrackPlayer.setQueue，
// 否则 setQueue 会把播放位置重置到第 0 首（表现为"播着 A 突然跳到 B"）。
let _lastQueueIds = null;
// 进度自动存档节流
let _lastAutoPersist = 0;

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
  playerBarHidden: false, // 迷你播放条显隐：播放页/WiFi 页聚焦时隐藏，失焦必然恢复
  playlists: [], // 歌单：[{ id, name, category, trackIds: [] }]
  categories: ['默认'],
  ready: false,
  loading: false,

  init: async () => {
    try {
      await TrackPlayer.setupPlayer();
    } catch (e) {
      // already setup
    }
    await TrackPlayer.updateOptions({
      // iOS 音频会话：必须显式声明 playback 类别，否则锁屏/控制中心的远程控制不可靠
      iosCategory: 'playback',
      iosCategoryMode: 'default',
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
        Capability.Seek,
      ],
      // v4 必须显式配置，否则不会周期性发进度事件（进度条不动 / 锁屏无进度）
      progressUpdateEventInterval: 1,
    });

    TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
      set({ isPlaying: state === State.Playing });
      if (state === State.Paused) get()._persist();
    });
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ position, duration }) => {
      set({ position, duration: duration || 0 });
      // 每 5 秒自动存档一次播放进度：用户直接杀 App 时也能记住"退出前听到哪了"
      const now = Date.now();
      if (now - _lastAutoPersist > 5000) {
        _lastAutoPersist = now;
        get()._persist();
      }
    });
    // v4 的 track 参数兼容处理：可能是索引(number)也可能是 id(string)
    TrackPlayer.addEventListener(Event.PlaybackTrackChanged, ({ track }) => {
      if (track == null) return;
      const queue = get().queue;
      let idx = -1;
      if (typeof track === 'number') {
        idx = track >= 0 && track < queue.length ? track : -1;
      } else {
        idx = indexOfId(queue, track);
      }
      if (idx >= 0) {
        // 切歌时清空上一首残留的时长/进度：
        // 若沿用上一首更长的 duration，拖拽 seek 会算出超出本歌时长的位置，可能原生越界崩溃
        set({ currentIndex: idx, currentId: queue[idx].id, position: 0, duration: 0 });
        get()._persist();
      }
    });

    set({ ready: true });
    await get().loadLibrary();
    // 恢复上次会话（重启后迷你播放条直接出现，接着上次的位置）
    await get()._restoreSession();
    await get().loadPlaylists();
  },

  // ===== 会话持久化：迷你播放条在重启后仍然可见 =====
  _persist: () => {
    try {
      const { queue, currentIndex, currentId, repeatMode, sortMode, position } = get();
      if (!queue || queue.length === 0) return;
      const data = { queue, currentIndex, currentId, repeatMode, sortMode, position, savedAt: Date.now() };
      FileSystem.writeAsStringAsync(FileSystem.documentDirectory + STATE_FILE, JSON.stringify(data)).catch(() => {});
    } catch (e) {
      /* noop */
    }
  },

  _restoreSession: async () => {
    try {
      const raw = await FileSystem.readAsStringAsync(FileSystem.documentDirectory + STATE_FILE);
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.queue) || s.queue.length === 0) return;
      const queue = s.queue.filter((t) => t && t.id && (t.url || t.uri));
      if (!queue.length) return;
      let idx = typeof s.currentIndex === 'number' ? s.currentIndex : 0;
      if (idx < 0 || idx >= queue.length) idx = 0;
      const repeatMode = s.repeatMode === 'one' || s.repeatMode === 'shuffle' ? s.repeatMode : 'order';
      set({
        queue,
        currentIndex: idx,
        currentId: queue[idx].id,
        isPlaying: false,
        repeatMode,
        sortMode: s.sortMode === 'album' ? 'album' : 'title',
        position: typeof s.position === 'number' && s.position > 0 ? s.position : 0,
        duration: 0,
      });
      _lastQueueIds = queue.map((t) => t.id).join('|');
      try {
        await TrackPlayer.setRepeatMode(repeatMode === 'one' ? RepeatMode.One : RepeatMode.Queue);
      } catch (e) {}
      await TrackPlayer.setQueue(queue.map(toTPTrack));
      await TrackPlayer.skip(idx);
      if (get().position > 0) {
        const target = get().position;
        try {
          await TrackPlayer.seekTo(target);
        } catch (e) {}
        // 校验进度是否真的跳到位（skip 后轨道可能尚未加载完，首次 seek 偶发无效）
        try {
          await new Promise((r) => setTimeout(r, 800));
          const prog = await TrackPlayer.getProgress();
          if (Math.abs(prog.position - target) > 2) {
            try {
              await TrackPlayer.seekTo(target);
            } catch (e) {}
          }
        } catch (e) {}
      }
    } catch (e) {
      // 首次运行没有存档，忽略
    }
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
    // 与现有库比对，只有真正变化才重建队列（避免每次回前台都 setQueue 打断播放）
    const prev = get().library;
    const prevKey = prev.map((t) => t.id).join('|');
    const merged = mergeById(prev, docTracks);
    const key = merged.map((t) => t.id).join('|');
    set({ library: merged });
    if (key !== prevKey || get().queue.length === 0) {
      get()._rebuildQueue(merged);
    }
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

  _rebuildQueue: (library, opts = {}) => {
    const { repeatMode, sortMode, currentId, queue: prevQueue } = get();
    const sorted = sortTracks(library, sortMode);
    const libIds = new Set(library.map((t) => t.id));
    // 保留不在音乐库扫描范围内的歌（上次会话从手机音乐库导入的 / 正在播放的）
    const extras = prevQueue.filter(
      (t) => t && (t.url || t.uri) && !libIds.has(t.id) && (t.source === 'lib' || t.id === currentId)
    );
    let queue;
    if (repeatMode === 'shuffle') {
      if (opts.reshuffle || prevQueue.length === 0) {
        queue = shuffle(sorted);
      } else {
        // 保持现有随机顺序：剔除已删除、追加新增（避免每次前台重新洗牌）
        const prevIds = new Set(prevQueue.map((t) => t.id));
        const kept = prevQueue.filter((t) => libIds.has(t.id));
        const added = sorted.filter((t) => !prevIds.has(t.id));
        queue = kept.concat(added);
      }
    } else {
      queue = sorted;
    }
    queue = queue.concat(extras);

    set({ queue });
    if (currentId != null) {
      const idx = indexOfId(queue, currentId);
      if (idx >= 0) set({ currentIndex: idx });
      else set({ currentIndex: -1, currentId: null });
    }

    // 关键修复：只有队列内容真正变化才同步 TrackPlayer，
    // 且同步后跳回当前歌继续播（而不是从第 0 首开始 = "播 A 跳 B" 的根源）
    const ids = queue.map((t) => t.id).join('|');
    if (get().ready && queue.length > 0 && ids !== _lastQueueIds) {
      const wasPlaying = get().isPlaying;
      const targetId = get().currentId;
      _lastQueueIds = ids;
      TrackPlayer.setQueue(queue.map(toTPTrack))
        .then(async () => {
          const idx = indexOfId(queue, targetId);
          if (idx >= 0) {
            try {
              await TrackPlayer.skip(idx);
            } catch (e) {}
          }
          if (wasPlaying) {
            try {
              await TrackPlayer.play();
            } catch (e) {}
          }
        })
        .catch(() => {});
    }
    get()._persist();
  },

  setSortMode: (mode) => {
    set({ sortMode: mode });
    get()._rebuildQueue(get().library);
  },

  setRepeatMode: (mode) => {
    set({ repeatMode: mode });
    const rm = mode === 'one' ? RepeatMode.One : RepeatMode.Queue;
    TrackPlayer.setRepeatMode(rm).catch(() => {});
    // 只有切到随机才需要重新洗牌；单曲循环/顺序播放不动队列（避免打断当前歌）
    get()._rebuildQueue(get().library, { reshuffle: mode === 'shuffle' });
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
    _lastQueueIds = queue.map((t) => t.id).join('|');
    await TrackPlayer.setQueue(queue.map(toTPTrack));
    await TrackPlayer.skip(startIndex);
    await TrackPlayer.play();
    set({ isPlaying: true });
    get()._persist();
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
    get()._persist();
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
    get()._persist();
  },

  seek: async (pos) => {
    // 防原生崩溃：NaN/Infinity/越界值一律钳制后再 seek（拖拽进度条闪退的根源）
    try {
      const d = get().duration || 0;
      let p = Number(pos);
      if (!isFinite(p)) return;
      if (d > 0) p = Math.min(Math.max(0, p), Math.max(0, d - 0.2));
      else p = Math.max(0, p);
      await TrackPlayer.seekTo(p);
      set({ position: p });
    } catch (e) {
      /* seek 失败不打断播放 */
    }
  },

  jumpToQueueIndex: async (idx) => {
    const { queue } = get();
    if (idx < 0 || idx >= queue.length) return;
    await TrackPlayer.skip(idx);
    await TrackPlayer.play();
    set({ currentIndex: idx, currentId: queue[idx]?.id, isPlaying: true, playlistVisible: false });
    get()._persist();
  },

  showPlaylist: () => set({ playlistVisible: true }),
  hidePlaylist: () => set({ playlistVisible: false }),

  hidePlayerBar: () => set({ playerBarHidden: true }),
  showPlayerBar: () => set({ playerBarHidden: false }),

  currentTrack: () => {
    const { queue, currentIndex } = get();
    return queue[currentIndex] || null;
  },

  // ===== 歌单（分类 + 自定义列表，持久化到 playlists.json） =====

  loadPlaylists: async () => {
    try {
      const raw = await FileSystem.readAsStringAsync(FileSystem.documentDirectory + PLAYLISTS_FILE);
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.playlists)) {
        set({
          playlists: d.playlists,
          categories: Array.isArray(d.categories) && d.categories.length ? d.categories : ['默认'],
        });
      }
    } catch (e) {
      // 首次没有文件，忽略
    }
  },

  _savePlaylists: () => {
    try {
      const { playlists, categories } = get();
      FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + PLAYLISTS_FILE,
        JSON.stringify({ playlists, categories })
      ).catch(() => {});
    } catch (e) {
      /* noop */
    }
  },

  createPlaylist: (name, category) => {
    const pl = {
      id: 'pl_' + Date.now(),
      name: (name || '').trim() || '新建歌单',
      category: category || '默认',
      trackIds: [],
    };
    set({ playlists: [...get().playlists, pl] });
    get()._savePlaylists();
    return pl;
  },

  deletePlaylist: (id) => {
    set({ playlists: get().playlists.filter((p) => p.id !== id) });
    get()._savePlaylists();
  },

  renamePlaylist: (id, name) => {
    set({ playlists: get().playlists.map((p) => (p.id === id ? { ...p, name } : p)) });
    get()._savePlaylists();
  },

  addToPlaylist: (plId, trackId) => {
    set({
      playlists: get().playlists.map((p) => {
        if (p.id !== plId) return p;
        if (p.trackIds.indexOf(trackId) >= 0) return p;
        return { ...p, trackIds: [...p.trackIds, trackId] };
      }),
    });
    get()._savePlaylists();
  },

  removeFromPlaylist: (plId, trackId) => {
    set({
      playlists: get().playlists.map((p) => (p.id === plId ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId) } : p)),
    });
    get()._savePlaylists();
  },

  addCategory: (name) => {
    const n = (name || '').trim();
    if (!n) return;
    if (get().categories.indexOf(n) < 0) set({ categories: [...get().categories, n] });
    get()._savePlaylists();
  },

  removeCategory: (name) => {
    if (name === '默认') return;
    set({
      categories: get().categories.filter((c) => c !== name),
      playlists: get().playlists.map((p) => (p.category === name ? { ...p, category: '默认' } : p)),
    });
    get()._savePlaylists();
  },

  // 按歌单顺序整队播放
  playFromPlaylist: async (playlist, startIndex) => {
    const lib = get().library;
    const byId = new Map(lib.map((t) => [t.id, t]));
    const tracks = playlist.trackIds.map((id) => byId.get(id)).filter(Boolean);
    if (!tracks.length) return 0;
    const idx = Math.min(Math.max(startIndex || 0, 0), tracks.length - 1);
    await get()._playQueueAt(tracks, idx);
    return tracks.length;
  },
}));
