import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

// 排序菜单：按歌名 A-Z / 按专辑 A-Z
export default function SortMenu({ visible, onClose, sortMode, onChange }) {
  const items = [
    { key: 'title', label: '按歌名 A-Z' },
    { key: 'album', label: '按专辑 A-Z' },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.mask} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.head}>排序方式</Text>
          {items.map((it) => (
            <TouchableOpacity
              key={it.key}
              style={styles.item}
              onPress={() => {
                onChange(it.key);
                onClose();
              }}
            >
              <Text style={[styles.label, sortMode === it.key && styles.active]}>{it.label}</Text>
              {sortMode === it.key && <FontAwesome name="check" size={16} color="#ff3a3a" />}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
  },
  head: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  label: {
    color: '#1a1a1a',
    fontSize: 16,
  },
  active: {
    color: '#ff3a3a',
    fontWeight: '600',
  },
});
