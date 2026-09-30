import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import Vinyl from '../components/Vinyl';
import PlaylistSheet from '../components/PlaylistSheet';
import { FontAwesome } from '@expo/vector-icons';
import { formatTime } from '../utils/format';

const REPEAT_ICON = { order: 'repeat', shuffle: 'random', one: 'repeat' };
const REPEAT_LABEL = { order: '顺序播放', shuffle: '随机播放', one: '单曲循环' };

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
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const seek = usePlayerStore((s) => s.seek);
  const showPlaylist = usePlayerStore((s) => s.showPlaylist);
  const playlistVisible = usePlayerStore((s) => s.playlistVisible);
  const hidePlaylist = usePlayerStore((s) => s.hidePlaylist);

  const track = queue[currentIndex];
  const barRef = useRef(null);

  const onSeek = (e) => {
    if (!barRef.current || !duration) return;
    barRef.current.measure((x, y, w, h, pageX) => {
      const ratio = Math.min(1, Math.max(0, (e.nativeEvent.pageX - pageX) / w));
      seek(ratio * duration);
    });
  };

  if (!track) {
    return (
      <View style={styles.bg}>
        <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
          <FontAwesome name="chevron-down" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.centerEmpty}>
          <Text style={{ color: '#888' }}>暂无播放歌曲</Text>
        </View>
      </View>
    );
  }

  const progress = duration ? position / duration : 0;

  return (
    <View style={styles.bg}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
          <FontAwesome name="chevron-down" size={22} color="#fff" />
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
        <View ref={barRef} style={styles.bar} onStartShouldSetResponder={() => true} onResponderRelease={onSeek}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.barThumb, { left: `${progress * 100}%` }]} />
        </View>
        <View style={styles.times}>
          <Text style={styles.time}>{formatTime(position)}</Text>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.ctrl} onPress={cycleRepeat}>
          <FontAwesome name={REPEAT_ICON[repeatMode]} size={22} color={repeatMode === 'order' ? '#fff' : '#e60026'} />
          {repeatMode === 'one' && <View style={styles.oneBadge}><Text style={styles.oneTxt}>1</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrl} onPress={() => prev()}>
          <FontAwesome name="step-backward" size={30} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBig} onPress={() => togglePlay()}>
          <FontAwesome name={isPlaying ? 'pause' : 'play'} size={34} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrl} onPress={() => next()}>
          <FontAwesome name="step-forward" size={30} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrl} onPress={showPlaylist}>
          <FontAwesome name="list" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <PlaylistSheet visible={playlistVisible} onClose={hidePlaylist} />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 40 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  close: { width: 30, alignItems: 'center' },
  topMeta: { flex: 1, alignItems: 'center' },
  topTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  topArtist: { color: '#999', fontSize: 12, marginTop: 2 },
  vinylWrap: { alignItems: 'center', marginTop: 30, marginBottom: 30 },
  info: { alignItems: 'center', paddingHorizontal: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  artist: { color: '#999', fontSize: 13, marginTop: 8 },
  progressArea: { paddingHorizontal: 24, marginTop: 24 },
  bar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    position: 'relative',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#e60026',
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
  time: { color: '#888', fontSize: 12 },
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
    backgroundColor: '#e60026',
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
    backgroundColor: '#e60026',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oneTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  centerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
