import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../store/usePlayerStore';
import Artwork from './Artwork';
import { FontAwesome } from '@expo/vector-icons';

// 底部悬浮迷你播放器：常驻在 Tab 栏上方
export default function MiniPlayer({ onExpand }) {
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const insets = useSafeAreaInsets();

  const track = queue[currentIndex];
  if (!track) return null;

  return (
    <View style={[styles.container, { bottom: insets.bottom + 56 + 6 }]}>
      <TouchableOpacity style={styles.row} activeOpacity={0.9} onPress={onExpand}>
        <Artwork title={track.title} hue={track.hue} size={42} radius={6} />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist} · {track.album}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.playBtn} onPress={() => togglePlay()}>
        <FontAwesome name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.expand} onPress={onExpand}>
        <FontAwesome name="chevron-up" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 56,
    bottom: 8,
    backgroundColor: 'rgba(20,20,22,0.96)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 100,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  meta: {
    marginLeft: 10,
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e60026',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  expand: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
