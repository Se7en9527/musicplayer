import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  Alert,
  Animated,
  Modal,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../store/usePlayerStore';
import Artwork from '../components/Artwork';
import SortMenu from '../components/SortMenu';
import { FontAwesome } from '@expo/vector-icons';

// 歌曲行固定高度（Artwork 48 + 上下 padding 10*2），供 getItemLayout 精确定位
const ROW_H = 68;

// 单首歌行：selecting 模式下显示勾选框、点按=切换选中；非 selecting 模式左滑露出红色“删除”
function SongRow({ item, active, flash, onPress, onDelete, selecting, selected, onToggle }) {
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

  const handlePress = () => {
    if (selecting) onToggle(item.id);
    else onPress();
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRight}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      enabled={!selecting}
    >
      <TouchableOpacity
        style={[styles.row, flash && styles.rowFlash, selecting && styles.rowSelecting]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {selecting && (
          <View style={[styles.checkCircle, selected && styles.checkCircleOn]}>
            {selected && <FontAwesome name="check" size={14} color="#fff" />}
          </View>
        )}
        <Artwork title={item.title} hue={item.hue} size={48} radius={6} />
        <View style={styles.meta}>
          <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {item.artist} · {item.album}
          </Text>
        </View>
        {!selecting && active && <FontAwesome name="volume-up" size={16} color="#ff3a3a" />}
      </TouchableOpacity>
    </Swipeable>
  );
}

export default function LibraryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const library = usePlayerStore((s) => s.library);
  const playlists = usePlayerStore((s) => s.playlists);
  const sortMode = usePlayerStore((s) => s.sortMode);
  const setSortMode = usePlayerStore((s) => s.setSortMode);
  const playFromLibrary = usePlayerStore((s) => s.playFromLibrary);
  const importFromMediaLibrary = usePlayerStore((s) => s.importFromMediaLibrary);
  const importFromFiles = usePlayerStore((s) => s.importFromFiles);
  const currentId = usePlayerStore((s) => s.currentId);
  const queue = usePlayerStore((s) => s.queue);
  const removeManyFromLibrary = usePlayerStore((s) => s.removeManyFromLibrary);
  const addTracksToPlaylist = usePlayerStore((s) => s.addTracksToPlaylist);

  const [menu, setMenu] = useState(false);
  const [locateFlash, setLocateFlash] = useState(false);
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirm, setConfirm] = useState({ visible: false, tracks: [], delSource: false });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const listRef = useRef(null);

  const sorted = [...library].sort((a, b) =>
    sortMode === 'album'
      ? (a.album || '').localeCompare(b.album || '', 'zh')
      : (a.title || '').localeCompare(b.title || '', 'zh')
  );

  const q = search.trim().toLowerCase();
  const filtered = q
    ? sorted.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.artist || '').toLowerCase().includes(q) ||
          (t.album || '').toLowerCase().includes(q)
      )
    : sorted;

  // ===== 删除确认弹框：复用“首页音乐库删除音乐文件”提示框（含源文件勾选） =====
  const requestDeleteTracks = (tracks) => setConfirm({ visible: true, tracks, delSource: false });
  const closeConfirm = () => setConfirm((c) => ({ ...c, visible: false }));
  const doDelete = async () => {
    const tracks = confirm.tracks || [];
    const delSource = confirm.delSource;
    setConfirm({ visible: false, tracks: [], delSource: false });
    if (!tracks.length) return;
    try {
      await removeManyFromLibrary(tracks, delSource);
      setSelecting(false);
      setSelectedIds([]);
    } catch (e) {
      Alert.alert('删除失败', String((e && e.message) || e));
    }
  };

  // ===== 多选 =====
  const toggle = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filtered.map((t) => t.id));
  const exitSelect = () => {
    setSelecting(false);
    setSelectedIds([]);
    setActionOpen(false);
  };

  const onAddToPlaylist = (pl) => {
    setPickerVisible(false);
    setActionOpen(false);
    addTracksToPlaylist(pl.id, selectedIds);
    Alert.alert('已添加', `已把 ${selectedIds.length} 首加入「${pl.name}」`);
    setSelectedIds([]);
    setSelecting(false);
  };

  // QQ 音乐式悬浮定位：滚到正在播的歌并短暂高亮
  const onLocate = () => {
    try {
      const idx = filtered.findIndex((t) => t.id === currentId);
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

  const deleteSummary =
    confirm.tracks.length === 1
      ? confirm.tracks[0].title
      : `已选 ${confirm.tracks.length} 首歌曲`;

  return (
    <GestureHandlerRootView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.hTitle}>音乐库</Text>
        <View style={styles.headerRight}>
          {selecting ? (
            <>
              <TouchableOpacity style={styles.sortBtn} onPress={toggleSelectAll}>
                <Text style={styles.sortTxt}>{allSelected ? '取消全选' : '全选'}</Text>
              </TouchableOpacity>
              {selectedIds.length > 0 && (
                <TouchableOpacity style={styles.sortBtn} onPress={() => setActionOpen(true)}>
                  <Text style={styles.sortTxt}>操作({selectedIds.length})</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.refreshBtn} onPress={exitSelect}>
                <FontAwesome name="close" size={16} color="#333" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.sortBtn} onPress={() => setMenu(true)}>
                <FontAwesome name="sort" size={14} color="#333" />
                <Text style={styles.sortTxt}>{sortMode === 'album' ? '专辑' : '歌名'} A-Z</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                <FontAwesome name="refresh" size={14} color="#333" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setSelecting(true)}>
                <FontAwesome name="check-square-o" size={14} color="#333" />
                <Text style={styles.sortTxt}>选择</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* 搜索框 */}
      <View style={styles.searchWrap}>
        <FontAwesome name="search" size={14} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索歌名 / 歌手 / 专辑"
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {!selecting && (
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
      )}

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="folder-open" size={48} color="#444" />
          <Text style={styles.emptyTitle}>{q ? '没有匹配的歌曲' : '还没有歌曲'}</Text>
          <Text style={styles.emptySub}>
            {q ? '换个关键词试试' : '方式一：用数据线连电脑，在 iTunes/Finder 的「文件共享」里把音乐拖进「云音乐」'}
          </Text>
          {!q && <Text style={styles.emptySub}>方式二：点上方「从音乐库导入」或「从文件导入」选歌</Text>}
          {!q && <Text style={styles.emptySub}>方式三：点「WiFi 上传」，电脑浏览器打开提示地址拖歌进去</Text>}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: selecting ? 90 : 80 }}
          getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          ListFooterComponent={
            <Text style={styles.footer}>
              {q ? `找到 ${filtered.length} 首` : `音乐库共 ${library.length} 首`}
              {selecting ? ` · 已选 ${selectedIds.length} 首` : ''}
            </Text>
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
                onDelete={requestDeleteTracks}
                selecting={selecting}
                selected={selectedIds.includes(item.id)}
                onToggle={toggle}
              />
            );
          }}
        />
      )}

      {/* QQ 音乐式悬浮定位按钮：滚到正在播放的歌 */}
      {!selecting && filtered.length > 0 && currentId && queue.length > 0 && filtered.some((t) => t.id === currentId) && (
        <TouchableOpacity style={styles.locateBtn} onPress={onLocate} activeOpacity={0.8}>
          <FontAwesome name="crosshairs" size={20} color="#ff3a3a" />
        </TouchableOpacity>
      )}

      {/* 多选操作：居中对话框（Modal 遮罩，盖在 MiniPlayer 之上，不被遮挡） */}
      {selecting && selectedIds.length > 0 && actionOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setActionOpen(false)}>
          <TouchableOpacity style={styles.dialogMask} activeOpacity={1} onPress={() => setActionOpen(false)}>
            <TouchableOpacity style={styles.dialogCard} activeOpacity={1} onPress={() => {}}>
              <Text style={styles.dialogTitle}>已选 {selectedIds.length} 首</Text>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.dialogBtnPrimary]}
                onPress={() => { setActionOpen(false); setPickerVisible(true); }}
                activeOpacity={0.85}
              >
                <FontAwesome name="plus" size={16} color="#fff" />
                <Text style={styles.dialogBtnTxt}>添加到歌单</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.dialogBtnDel]}
                onPress={() => { setActionOpen(false); requestDeleteTracks(selectedIds.map((id) => library.find((t) => t.id === id)).filter(Boolean)); }}
                activeOpacity={0.85}
              >
                <FontAwesome name="trash" size={16} color="#fff" />
                <Text style={styles.dialogBtnTxt}>删除</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogCancel} onPress={() => setActionOpen(false)} activeOpacity={0.85}>
                <Text style={styles.dialogCancelTxt}>取消</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <SortMenu visible={menu} onClose={() => setMenu(false)} sortMode={sortMode} onChange={setSortMode} />

      {/* 删除确认弹框：左侧删除 / 右侧取消，含“同时删除 App 内音乐源文件”勾选框 */}
      {confirm.visible && (
        <View style={styles.modalMask}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>删除歌曲</Text>
            <Text style={styles.modalMsg} numberOfLines={1}>
              {deleteSummary}
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

      {/* 添加到歌单：选择列表 */}
      <ModalPicker
        visible={pickerVisible}
        playlists={playlists}
        onClose={() => setPickerVisible(false)}
        onPick={onAddToPlaylist}
      />
    </GestureHandlerRootView>
  );
}

function ModalPicker({ visible, playlists, onClose, onPick }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.addMask}>
        <View style={styles.addSheet}>
          <View style={styles.addHeader}>
            <Text style={styles.addTitle}>添加到歌单</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.addDone}>完成</Text>
            </TouchableOpacity>
          </View>
          {playlists.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptySub}>还没有歌单，先去「歌单」页新建一个</Text>
            </View>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerRow} onPress={() => onPick(item)}>
                  <View style={styles.pickerIcon}>
                    <FontAwesome name="music" size={18} color="#ff3a3a" />
                  </View>
                  <View style={styles.meta}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{item.trackIds.length} 首 · {item.category}</Text>
                  </View>
                  <FontAwesome name="chevron-right" size={14} color="#c9c9cf" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
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
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    marginTop: 2,
    marginBottom: 8,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#1a1a1a', fontSize: 14 },
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
  rowSelecting: { backgroundColor: '#fff7f7' },
  // 多选勾选框
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#c4c4cc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkCircleOn: { backgroundColor: '#ff3a3a', borderColor: '#ff3a3a' },
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
  // 多选操作：居中对话框（Modal 遮罩，盖在 MiniPlayer 之上）
  dialogMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'stretch',
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
  },
  dialogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 10,
  },
  dialogBtnPrimary: { backgroundColor: '#1a1a1a' },
  dialogBtnDel: { backgroundColor: '#ff3a3a' },
  dialogBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  dialogCancel: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 2,
  },
  dialogCancelTxt: { color: '#999', fontSize: 15 },
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
  // 添加到歌单选择弹窗
  addMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  addSheet: {
    height: '60%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  addHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  addTitle: { color: '#1a1a1a', fontSize: 16, fontWeight: '700' },
  addDone: { color: '#ff3a3a', fontSize: 15, fontWeight: '600' },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f2f2f5',
  },
  pickerIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#eee',
  },
});
