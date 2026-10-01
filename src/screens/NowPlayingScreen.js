import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import Vinyl from '../components/Vinyl';
import PlaylistSheet from '../components/PlaylistSheet';
import { FontAwesome } from '@expo/vector-icons';
import { formatTime } from '../utils/format';

const REPEAT_ICON = { order: 'repeat', shuffle: 'random', one: 'repeat' };
const MODE_ITEMS = [
  { key: 'shuffle', label: '随机播放' },
  { key: 'order', label: '顺序播放' },
  { key: 'one', label: '单曲循环' },
];

export default function NowPlayingScreen({ navigation }) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const seek = usePlayerStore((s) => s.seek);
  const showPlaylist = usePlayerStore((s) => s.showPlaylist);
  const playlistVisible = usePlayerStore((s) => s.playlistVisible);
  const hidePlaylist = usePlayerStore((s) => s.hidePlaylist);

  const track = queue[currentIndex];
  const barRef = useRef(null);
  const [modeMenu, setModeMenu] = useState(false);
  const [dragRatio, setDragRatio] = useState(null);

  const onBarMove = (e) => {
    if (!barRef.current || !duration) return;
    barRef.current.measure((x, y, w, h, pageX) => {
      const ratio = Math.min(1, Math.max(0, (e.nativeEvent.pageX - pageX) / w));
      setDragRatio(ratio);
    });
  };
  const onBarEnd = () => {
    if (dragRatio != null && duration) seek(dragRatio * duration);
    setDragRatio(null);
  };

  if (!track) {
    return (
      <View style={styles.bg}>
        <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
          <FontAwesome name="chevron-down" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.centerEmpty}>
          <Text style={{ color: '#999' }}>暂无播放歌曲</Text>
        </View>
      </View>
    );
  }

  const progress = duration ? position / duration : 0;
  const shownRatio = dragRatio != null ? dragRatio : progress;

  return (
    <View style={styles.bg}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
          <FontAwesome name="chevron-down" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.topMeta}>
          <Text style={styles.topTitle} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.topArtist} numberOfLines={1}>{track.artist}</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.vinylWrap}>
        <Vinyl title={track.title} hue={track.hue} playing={isPlaying} size={260} />
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{track.artist} · {track.album}</Text>
      </View>

      <View style={styles.progressArea}>
        <View
          ref={barRef}
          style={styles.bar}
          hitSlop={{ top: 12, bottom: 12 }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={onBarMove}
          onResponderMove={onBarMove}
          onResponderRelease={onBarEnd}
        >
          <View style={[styles.barFill, { width: `${shownRatio * 100}%` }]} />
          <View style={[styles.barThumb, { left: `${shownRatio * 100}%` }]} />
        </View>
        <View style={styles.times}>
          <Text style={styles.time}>{formatTime((shownRatio || 0) * (duration || 0))}</Text>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.ctrl} onPress={() => setModeMenu(true)}>
          <FontAwesome name={REPEAT_ICON[repeatMode]} size={22} color={repeatMode === 'order' ? '#1a1a1a' : '#ff3a3a'} />
          {repeatMode === 'one' && <View style={styles.oneBadge}><Text style={styles.oneTxt}>1</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrl} onPress={() => prev()}>
          <FontAwesome name="step-backward" size={30} color="#1a1a1a" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBig} onPress={() => togglePlay()}>
          <FontAwesome name={isPlaying ? 'pause' : 'play'} size={34} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrl} onPress={() => next()}>
          <FontAwesome name="step-forward" size={30} color="#1a1a1a" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrl} onPress={showPlaylist}>
          <FontAwesome name="list" size={22} color="#1a1a1a" />
        </TouchableOpacity>
      </View>

      <PlaylistSheet visible={playlistVisible} onClose={hidePlaylist} />

      {/* 播放模式菜单（QQ 音乐式弹出菜单） */}
      <Modal transparent visible={modeMenu} animationType="fade" onRequestClose={() => setModeMenu(false)}>
        <TouchableOpacity style={styles.menuMask} activeOpacity={1} onPress={() => setModeMenu(false)}>
          <View style={styles.modeMenu}>
            {MODE_ITEMS.map((it) => {
              const active = repeatMode === it.key;
              return (
                <TouchableOpacity
                  key={it.key}
                  style={styles.modeItem}
                  onPress={() => {
                    setRepeatMode(it.key);
                    setModeMenu(false);
                  }}
                >
                  <FontAwesome
                    name={it.key === 'shuffle' ? 'random' : 'repeat'}
                    size={15}
                    color={active ? '#ff3a3a' : '#1a1a1a'}
                  />
                  <Text style={[styles.modeLabel, active && styles.modeActive]}>{it.label}</Text>
                  {active && <FontAwesome name="check" size={14} color="#ff3a3a" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f7f7f9', paddingTop: 40 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  close: { width: 30, alignItems: 'center' },
  topMeta: { flex: 1, alignItems: 'center' },
  topTitle: { color: '#1a1a1a', fontSize: 15, fontWeight: '600' },
  topArtist: { color: '#999', fontSize: 12, marginTop: 2 },
  vinylWrap: { alignItems: 'center', marginTop: 30, marginBottom: 30 },
  info: { alignItems: 'center', paddingHorizontal: 24 },
  title: { color: '#1a1a1a', fontSize: 22, fontWeight: '800' },
  artist: { color: '#999', fontSize: 13, marginTop: 8 },
  progressArea: { paddingHorizontal: 24, marginTop: 24 },
  bar: {
    height: 4,
    backgroundColor: '#e2e2e2',
    borderRadius: 2,
    position: 'relative',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#ff3a3a',
    borderRadius: 2,
  },
  barThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginLeft: -6,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  time: { color: '#999', fontSize: 12 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    marginTop: 28,
  },
  ctrl: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBig: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ff3a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oneBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff3a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oneTxt: { color: '#1a1a1a', fontSize: 10, fontWeight: '700' },
  centerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  menuMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingBottom: 150,
    paddingLeft: 24,
  },
  modeMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 180,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  modeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  modeLabel: { color: '#1a1a1a', fontSize: 15, marginLeft: 12, flex: 1 },
  modeActive: { color: '#ff3a3a', fontWeight: '600' },
});
