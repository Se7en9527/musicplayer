import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../store/usePlayerStore';
import Artwork from '../components/Artwork';
import SortMenu from '../components/SortMenu';
import { FontAwesome } from '@expo/vector-icons';

// 歌曲行固定高度（Artwork 48 + 上下 padding 10*2），供 getItemLayout 精确定位
const ROW_H = 68;

// 单首歌行：外包 Swipeable 实现左滑露出红色“删除”按钮
function SongRow({ item, active, flash, onPress, onDelete }) {
  const swipeRef = useRef(null);

  const renderRight = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        style={styles.delAction}
        activeOpacity={0.85}
        onPress={() => {
          swipeRef.current?.close();
          onDelete(item);
        }}
      >
        <Animated.Text style={[styles.delActionTxt, { transform: [{ translateX: trans }] }]}>
          删除
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRight}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      <TouchableOpacity style={[styles.row, flash && styles.rowFlash]} onPress={onPress} activeOpacity={0.7}>
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
    </Swipeable>
  );
}

export default function LibraryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const library = usePlayerStore((s) => s.library);
  const sortMode = usePlayerStore((s) => s.sortMode);
  const setSortMode = usePlayerStore((s) => s.setSortMode);
  const playFromLibrary = usePlayerStore((s) => s.playFromLibrary);
  const importFromMediaLibrary = usePlayerStore((s) => s.importFromMediaLibrary);
  const importFromFiles = usePlayerStore((s) => s.importFromFiles);
  const currentId = usePlayerStore((s) => s.currentId);
  const queue = usePlayerStore((s) => s.queue);
  const [menu, setMenu] = useState(false);
  const [locateFlash, setLocateFlash] = useState(false);
  const [confirm, setConfirm] = useState({ visible: false, track: null, delSource: false });
  const listRef = useRef(null);

  // 删除确认弹框：勾选 delSource 则同时删除 App 内音乐源文件
  const requestDelete = (track) => setConfirm({ visible: true, track, delSource: false });
  const closeConfirm = () => setConfirm((c) => ({ ...c, visible: false }));
  const doDelete = async () => {
    const { track, delSource } = confirm;
    setConfirm({ visible: false, track: null, delSource: false });
    if (!track) return;
    try {
      await usePlayerStore.getState().removeFromLibrary(track, delSource);
    } catch (e) {
      Alert.alert('删除失败', String((e && e.message) || e));
    }
  };

  // QQ 音乐式悬浮定位：滚到正在播的歌并短暂高亮
  const onLocate = () => {
    try {
      const idx = sorted.findIndex((t) => t.id === currentId);
      if (idx < 0 || !listRef.current) return;
      listRef.current.scrollToIndex({ index: idx, viewPosition: 0.5, animated: true });
      setLocateFlash(true);
      setTimeout(() => setLocateFlash(false), 1800);
    } catch (e) {
      /* 定位失败不影响其他功能 */
    }
  };

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
    <GestureHandlerRootView style={[styles.container, { paddingTop: insets.top }]}>
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
        <TouchableOpacity style={[styles.importBtn, styles.importBtnGap]} onPress={onImportLib}>
          <FontAwesome name="music" size={14} color="#333" />
          <Text style={styles.importTxt}>从音乐库导入</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.importBtn, styles.importBtnGap]} onPress={onImportFiles}>
          <FontAwesome name="folder" size={14} color="#333" />
          <Text style={styles.importTxt}>从文件导入</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.importBtn} onPress={() => navigation.getParent()?.navigate('Wifi')}>
          <FontAwesome name="wifi" size={14} color="#333" />
          <Text style={styles.importTxt}>WiFi 上传</Text>
        </TouchableOpacity>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="folder-open" size={48} color="#444" />
          <Text style={styles.emptyTitle}>还没有歌曲</Text>
          <Text style={styles.emptySub}>方式一：用数据线连电脑，在 iTunes/Finder 的「文件共享」里把音乐拖进「云音乐」</Text>
          <Text style={styles.emptySub}>方式二：点上方「从音乐库导入」或「从文件导入」选歌</Text>
          <Text style={styles.emptySub}>方式三：点「WiFi 上传」，电脑浏览器打开提示地址拖歌进去</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          ListFooterComponent={
            library.length > 0 ? (
              <Text style={styles.footer}>音乐库共 {library.length} 首</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const active = item.id === currentId;
            const flash = active && locateFlash;
            return (
              <SongRow
                item={item}
                active={active}
                flash={flash}
                onPress={() => playFromLibrary(library.indexOf(item))}
                onDelete={requestDelete}
              />
            );
          }}
        />
      )}

      {/* QQ 音乐式悬浮定位按钮：滚到正在播放的歌 */}
      {sorted.length > 0 && currentId && queue.length > 0 && sorted.some((t) => t.id === currentId) && (
        <TouchableOpacity style={styles.locateBtn} onPress={onLocate} activeOpacity={0.8}>
          <FontAwesome name="crosshairs" size={20} color="#ff3a3a" />
        </TouchableOpacity>
      )}

      <SortMenu visible={menu} onClose={() => setMenu(false)} sortMode={sortMode} onChange={setSortMode} />

      {/* 删除确认弹框：左侧删除 / 右侧取消，含“同时删除 App 内音乐源文件”勾选框 */}
      {confirm.visible && (
        <View style={styles.modalMask}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>删除歌曲</Text>
            <Text style={styles.modalMsg} numberOfLines={1}>
              {confirm.track?.title}
            </Text>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setConfirm((c) => ({ ...c, delSource: !c.delSource }))}
              activeOpacity={0.7}
            >
              <View style={[styles.checkBox, confirm.delSource && styles.checkBoxOn]}>
                {confirm.delSource && <FontAwesome name="check" size={14} color="#fff" />}
              </View>
              <Text style={styles.checkTxt}>同时删除 App 内音乐源文件</Text>
            </TouchableOpacity>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnDel]} onPress={doDelete} activeOpacity={0.8}>
                <Text style={styles.modalBtnDelTxt}>删除</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={closeConfirm} activeOpacity={0.8}>
                <Text style={styles.modalBtnCancelTxt}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
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
  importRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, marginTop: 4 },
  importBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f2',
    paddingVertical: 9,
    borderRadius: 18,
  },
  importBtnGap: { marginRight: 8 },
  importTxt: { color: '#1a1a1a', fontSize: 12, marginLeft: 5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: ROW_H,
  },
  rowFlash: { backgroundColor: '#ffecec' },
  // 左滑露出的红色删除按钮
  delAction: {
    width: 80,
    backgroundColor: '#ff3a3a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  delActionTxt: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  locateBtn: {
    position: 'absolute',
    right: 18,
    bottom: 92,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ececec',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
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
  footer: { color: '#b0b0b6', fontSize: 12, textAlign: 'center', paddingVertical: 14 },
  emptyTitle: { color: '#1a1a1a', fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: { color: '#9a9a9a', fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 20 },
  // 删除确认弹框
  modalMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalBox: {
    width: '82%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    alignItems: 'stretch',
  },
  modalTitle: { color: '#1a1a1a', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  modalMsg: { color: '#666', fontSize: 14, textAlign: 'center', marginTop: 10, marginBottom: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#bbbbbb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkBoxOn: { backgroundColor: '#ff3a3a', borderColor: '#ff3a3a' },
  checkTxt: { color: '#1a1a1a', fontSize: 14 },
  modalBtns: { flexDirection: 'row', marginTop: 18 },
  modalBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalBtnDel: { backgroundColor: '#ff3a3a', marginRight: 10 },
  modalBtnDelTxt: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  modalBtnCancel: { backgroundColor: '#f0f0f2' },
  modalBtnCancelTxt: { color: '#1a1a1a', fontSize: 16 },
});
