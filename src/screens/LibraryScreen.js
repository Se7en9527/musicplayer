import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import Artwork from '../components/Artwork';
import SortMenu from '../components/SortMenu';
import { FontAwesome } from '@expo/vector-icons';

export default function LibraryScreen({ navigation }) {
  const library = usePlayerStore((s) => s.library);
  const sortMode = usePlayerStore((s) => s.sortMode);
  const setSortMode = usePlayerStore((s) => s.setSortMode);
  const playFromLibrary = usePlayerStore((s) => s.playFromLibrary);
  const importFromMediaLibrary = usePlayerStore((s) => s.importFromMediaLibrary);
  const importFromFiles = usePlayerStore((s) => s.importFromFiles);
  const currentId = usePlayerStore((s) => s.currentId);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const queue = usePlayerStore((s) => s.queue);
  const [menu, setMenu] = useState(false);

  const onImportLib = async () => {
    try {
      const r = await importFromMediaLibrary();
      if (r.ok) {
        if (r.count > 0) Alert.alert('导入完成', `已从音乐库导入 ${r.count} 首`);
        else Alert.alert('没有可导入的歌曲', '音乐库里没找到音频文件');
      } else if (r.reason === 'denied') {
        Alert.alert('需要授权', '请在系统「设置 → 云音乐」中允许访问音乐库后再试');
      } else {
        Alert.alert('导入失败', r.message || '未知错误');
      }
    } catch (e) {
      Alert.alert('导入出错', String((e && e.message) || e));
    }
  };

  const onRefresh = async () => {
    try {
      const n = await usePlayerStore.getState().loadLibrary();
      Alert.alert('已刷新', `本地目录扫描到 ${n} 个音频文件`);
    } catch (e) {
      Alert.alert('刷新失败', String((e && e.message) || e));
    }
  };

  const onImportFiles = async () => {
    try {
      const r = await importFromFiles();
      if (r.canceled) return;
      if (r.ok) {
        if (r.count > 0) {
          await usePlayerStore.getState().loadLibrary();
          Alert.alert('导入完成', `已从文件导入 ${r.count} 首到本地`);
        } else {
          Alert.alert('没有导入', '未选择音频文件，或所选文件不是音频格式');
        }
      } else {
        Alert.alert('导入失败', r.message || '未知错误');
      }
    } catch (e) {
      Alert.alert('导入出错', String((e && e.message) || e));
    }
  };

  const sorted = [...library].sort((a, b) =>
    sortMode === 'album'
      ? (a.album || '').localeCompare(b.album || '', 'zh')
      : (a.title || '').localeCompare(b.title || '', 'zh')
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.hTitle}>音乐库</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.sortBtn} onPress={() => setMenu(true)}>
            <FontAwesome name="sort" size={14} color="#333" />
            <Text style={styles.sortTxt}>{sortMode === 'album' ? '专辑' : '歌名'} A-Z</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
            <FontAwesome name="refresh" size={14} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.importRow}>
        <TouchableOpacity style={styles.importBtn} onPress={onImportLib}>
          <FontAwesome name="music" size={16} color="#333" />
          <Text style={styles.importTxt}>从音乐库导入</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.importBtn} onPress={onImportFiles}>
          <FontAwesome name="folder" size={16} color="#333" />
          <Text style={styles.importTxt}>从文件导入</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.importBtn} onPress={() => navigation.getParent()?.navigate('Wifi')}>
          <FontAwesome name="wifi" size={16} color="#333" />
          <Text style={styles.importTxt}>WiFi 上传</Text>
        </TouchableOpacity>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="folder-open" size={48} color="#444" />
          <Text style={styles.emptyTitle}>还没有歌曲</Text>
          <Text style={styles.emptySub}>方式一：用数据线连电脑，在 iTunes/Finder 的「文件共享」里把音乐拖进「云音乐」</Text>
          <Text style={styles.emptySub}>方式二：点上方「从音乐库导入」选择手机里的歌曲</Text>
          <Text style={styles.emptySub}>方式二 b：点「从文件导入」从「文件」App 或其他 App 选音频文件</Text>
          <Text style={styles.emptySub}>方式三：点「WiFi 上传」用电脑浏览器传歌（需启用插件）</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item, index }) => {
            const active = item.id === currentId;
            return (
              <TouchableOpacity style={styles.row} onPress={() => playFromLibrary(library.indexOf(item))}>
                <Artwork title={item.title} hue={item.hue} size={48} radius={6} />
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
      )}

      <SortMenu visible={menu} onClose={() => setMenu(false)} sortMode={sortMode} onChange={setSortMode} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  hTitle: { color: '#1a1a1a', fontSize: 24, fontWeight: '800' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sortTxt: { color: '#1a1a1a', fontSize: 12, marginLeft: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  refreshBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f2',
    borderRadius: 16,
    marginLeft: 8,
  },
  importRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginBottom: 8 },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginRight: 10,
  },
  importTxt: { color: '#1a1a1a', fontSize: 13, marginLeft: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  meta: { marginLeft: 12, flex: 1 },
  name: { color: '#1a1a1a', fontSize: 15 },
  nameActive: { color: '#ff3a3a' },
  sub: { color: '#999', fontSize: 12, marginTop: 3 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { color: '#1a1a1a', fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: { color: '#9a9a9a', fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 20 },
});
