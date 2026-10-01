import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import Artwork from './Artwork';
import { FontAwesome } from '@expo/vector-icons';

const ROW_H = 60;

// 半屏播放列表：点击弹出，可见全部歌曲，可点击切换，可定位当前歌
export default function PlaylistSheet({ visible, onClose }) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const jumpToQueueIndex = usePlayerStore((s) => s.jumpToQueueIndex);
  const listRef = useRef(null);

  const locate = (animated) => {
    if (currentIndex < 0 || !listRef.current) return;
    try {
      listRef.current.scrollToIndex({ index: currentIndex, viewPosition: 0.3, animated });
    } catch (e) {
      /* index 越界等场景忽略 */
    }
  };

  // 打开弹层时自动定位到正在播放的歌
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => locate(false), 350);
      return () => clearTimeout(t);
    }
  }, [visible, currentIndex]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mask}>
        <TouchableOpacity style={styles.flex} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>播放列表（{queue.length}）</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.locateBtn} onPress={() => locate(true)}>
                <FontAwesome name="crosshairs" size={16} color="#1a1a1a" />
                <Text style={styles.locateTxt}>定位</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <FontAwesome name="close" size={20} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            ref={listRef}
            data={queue}
            keyExtractor={(item) => item.id}
            getItemLayout={(data, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
            renderItem={({ item, index }) => {
              const active = index === currentIndex;
              return (
                <TouchableOpacity
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => jumpToQueueIndex(index)}
                >
                  <Text style={[styles.idx, active && styles.idxActive]}>{index + 1}</Text>
                  <Artwork title={item.title} hue={item.hue} size={40} radius={5} />
                  <View style={styles.meta}>
                    <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {item.artist} · {item.album}
                    </Text>
                  </View>
                  {active && <FontAwesome name="volume-up" size={16} color="#ff3a3a" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  flex: {
    flex: 1,
  },
  sheet: {
    height: '55%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d0d0d0',
    alignSelf: 'center',
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  title: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '700',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 12,
  },
  locateTxt: { color: '#1a1a1a', fontSize: 12, marginLeft: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_H,
  },
  rowActive: {
    backgroundColor: 'rgba(255,58,58,0.08)',
    borderRadius: 8,
  },
  idx: {
    width: 28,
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
  },
  idxActive: {
    color: '#ff3a3a',
  },
  meta: {
    marginLeft: 10,
    flex: 1,
  },
  name: {
    color: '#1a1a1a',
    fontSize: 14,
  },
  nameActive: {
    color: '#ff3a3a',
  },
  sub: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
});
