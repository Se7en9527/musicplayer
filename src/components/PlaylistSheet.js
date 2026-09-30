import React from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import Artwork from './Artwork';
import { FontAwesome } from '@expo/vector-icons';

// 半屏播放列表：点击弹出，可见全部歌曲，可点击切换
export default function PlaylistSheet({ visible, onClose }) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const jumpToQueueIndex = usePlayerStore((s) => s.jumpToQueueIndex);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mask}>
        <TouchableOpacity style={styles.flex} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>播放列表（{queue.length}）</Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={queue}
            keyExtractor={(item) => item.id}
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
                  {active && <FontAwesome name="volume-up" size={16} color="#e60026" />}
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
    backgroundColor: '#151516',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#555',
    alignSelf: 'center',
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowActive: {
    backgroundColor: 'rgba(230,0,38,0.08)',
    borderRadius: 8,
  },
  idx: {
    width: 28,
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
  },
  idxActive: {
    color: '#e60026',
  },
  meta: {
    marginLeft: 10,
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 14,
  },
  nameActive: {
    color: '#e60026',
  },
  sub: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
});
