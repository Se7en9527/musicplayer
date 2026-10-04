import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../store/usePlayerStore';
import Artwork from '../components/Artwork';
import { FontAwesome } from '@expo/vector-icons';

const ROW_H = 60;

export default function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const playlists = usePlayerStore((s) => s.playlists);
  const categories = usePlayerStore((s) => s.categories);
  const library = usePlayerStore((s) => s.library);
  const currentId = usePlayerStore((s) => s.currentId);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const deletePlaylist = usePlayerStore((s) => s.deletePlaylist);
  const renamePlaylist = usePlayerStore((s) => s.renamePlaylist);
  const addCategory = usePlayerStore((s) => s.addCategory);
  const removeCategory = usePlayerStore((s) => s.removeCategory);
  const playFromPlaylist = usePlayerStore((s) => s.playFromPlaylist);
  const addToPlaylist = usePlayerStore((s) => s.addToPlaylist);
  const removeFromPlaylist = usePlayerStore((s) => s.removeFromPlaylist);
  const addTracksToPlaylist = usePlayerStore((s) => s.addTracksToPlaylist);
  const removeTracksFromPlaylist = usePlayerStore((s) => s.removeTracksFromPlaylist);

  const [cat, setCat] = useState('全部');
  const [selectedId, setSelectedId] = useState(null);
  const [addingSongs, setAddingSongs] = useState(false);
  // 歌单详情多选
  const [selMode, setSelMode] = useState(false);
  const [selIds, setSelIds] = useState([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const listRef = useRef(null);

  const selected = playlists.find((p) => p.id === selectedId) || null;
  const visiblePlaylists = cat === '全部' ? playlists : playlists.filter((p) => p.category === cat);
  const plTracks = selected
    ? selected.trackIds.map((id) => library.find((t) => t.id === id)).filter(Boolean)
    : [];
  const activeIdxInPl = selected && currentId ? selected.trackIds.indexOf(currentId) : -1;

  const locate = (animated) => {
    if (!selected || activeIdxInPl < 0 || !listRef.current) return;
    try {
      listRef.current.scrollToIndex({ index: activeIdxInPl, viewPosition: 0.3, animated });
    } catch (e) {
      /* ignore */
    }
  };

  useEffect(() => {
    if (selected && activeIdxInPl >= 0) {
      const t = setTimeout(() => locate(false), 350);
      return () => clearTimeout(t);
    }
  }, [selectedId, activeIdxInPl]);

  const promptNewPlaylist = () => {
    Alert.prompt('新建歌单', '输入歌单名称', (text) => {
      if (text && text.trim()) createPlaylist(text, cat !== '全部' ? cat : '默认');
    });
  };

  const promptNewCategory = () => {
    Alert.prompt('新建分类', '输入分类名称', (text) => {
      if (text && text.trim()) addCategory(text);
    });
  };

  const confirmDeletePlaylist = (pl) => {
    Alert.alert('删除歌单', `确定删除「${pl.name}」吗？歌曲文件不会被删除。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          setSelectedId(null);
          deletePlaylist(pl.id);
        },
      },
    ]);
  };

  const promptRename = (pl) => {
    Alert.prompt('重命名歌单', '输入新名称', (text) => {
      if (text && text.trim()) renamePlaylist(pl.id, text.trim());
    }, 'plain-text', pl.name);
  };

  const onLongPressPlaylist = (pl) => {
    Alert.alert(pl.name, `${pl.category} · ${pl.trackIds.length} 首`, [
      { text: '重命名', onPress: () => promptRename(pl) },
      { text: '删除歌单', style: 'destructive', onPress: () => confirmDeletePlaylist(pl) },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const onLongPressCategory = (c) => {
    if (c === '默认') {
      Alert.alert('默认分类', '「默认」分类不能删除');
      return;
    }
    Alert.alert('删除分类', `删除「${c}」后，其中的歌单会移到「默认」，确定吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          removeCategory(c);
          if (cat === c) setCat('全部');
        },
      },
    ]);
  };

  // ===== 歌单详情多选 =====
  const toggleSel = (id) =>
    setSelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allSel = plTracks.length > 0 && selIds.length === plTracks.length;
  const toggleSelAll = () => setSelIds(allSel ? [] : plTracks.map((t) => t.id));
  const exitSel = () => {
    setSelMode(false);
    setSelIds([]);
  };

  const onAddToPlaylist = (pl) => {
    setPickerVisible(false);
    if (pl.id === selected.id) {
      Alert.alert('提示', '已在当前歌单中');
      return;
    }
    addTracksToPlaylist(pl.id, selIds);
    Alert.alert('已添加', `已把 ${selIds.length} 首加入「${pl.name}」`);
    setSelIds([]);
    setSelMode(false);
  };

  const onRemoveFromPlaylist = () => {
    Alert.alert('移出歌单', `从「${selected.name}」移出选中的 ${selIds.length} 首？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '移出',
        style: 'destructive',
        onPress: () => {
          removeTracksFromPlaylist(selected.id, selIds);
          setSelMode(false);
          setSelIds([]);
        },
      },
    ]);
  };

  // ===== 歌单详情页 =====
  if (selected) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.detailHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => { setSelectedId(null); exitSel(); }}>
            <FontAwesome name="chevron-left" size={20} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={styles.detailMeta}>
            <Text style={styles.detailTitle} numberOfLines={1}>{selected.name}</Text>
            <Text style={styles.detailSub}>{selected.category} · {selected.trackIds.length} 首</Text>
          </View>
          {selMode ? (
            <TouchableOpacity style={styles.detailAction} onPress={exitSel}>
              <FontAwesome name="close" size={20} color="#1a1a1a" />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.detailAction} onPress={() => setAddingSongs(true)}>
                <FontAwesome name="plus" size={18} color="#1a1a1a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.detailAction} onPress={() => setSelMode(true)}>
                <FontAwesome name="check-square-o" size={18} color="#1a1a1a" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailAction}
                onPress={() => {
                  Alert.alert(selected.name, '操作', [
                    { text: '重命名', onPress: () => promptRename(selected) },
                    { text: '删除歌单', style: 'destructive', onPress: () => confirmDeletePlaylist(selected) },
                    { text: '取消', style: 'cancel' },
                  ]);
                }}
              >
                <FontAwesome name="ellipsis-h" size={18} color="#1a1a1a" />
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.detailBtnRow}>
          <TouchableOpacity
            style={[styles.detailBtn, styles.detailBtnPrimary]}
            onPress={() => {
              if (plTracks.length === 0) {
                Alert.alert('歌单是空的', '先点右上角 ＋ 添加歌曲');
                return;
              }
              playFromPlaylist(selected, 0);
            }}
          >
            <FontAwesome name="play" size={14} color="#fff" />
            <Text style={styles.detailBtnTxtPrimary}>播放全部</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.detailBtn, activeIdxInPl < 0 && styles.detailBtnDisabled]}
            disabled={activeIdxInPl < 0}
            onPress={() => locate(true)}
          >
            <FontAwesome name="crosshairs" size={14} color={activeIdxInPl < 0 ? '#bbb' : '#1a1a1a'} />
            <Text style={[styles.detailBtnTxt, activeIdxInPl < 0 && { color: '#bbb' }]}>定位当前歌</Text>
          </TouchableOpacity>
          {selMode && (
            <TouchableOpacity style={styles.detailBtn} onPress={toggleSelAll}>
              <Text style={[styles.detailBtnTxt, { color: '#ff3a3a' }]}>{allSel ? '取消全选' : '全选'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {plTracks.length === 0 ? (
          <View style={styles.empty}>
            <FontAwesome name="folder-open" size={44} color="#c9c9cf" />
            <Text style={styles.emptyTitle}>歌单里还没有歌曲</Text>
            <Text style={styles.emptySub}>点右上角 ＋ 从音乐库挑选歌曲加入</Text>
          </View>
        ) : (
        <FlatList
          key="pl-detail-list"
          ref={listRef}
          data={plTracks}
          keyExtractor={(item) => item.id}
          getItemLayout={(d, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          contentContainerStyle={{ paddingBottom: selMode && selIds.length > 0 ? 90 : 20 }}
          renderItem={({ item, index }) => {
            const active = item.id === currentId;
            const checked = selIds.includes(item.id);
            return (
              <TouchableOpacity
                style={[styles.row, active && styles.rowActive, selMode && checked && styles.rowChecked]}
                onPress={() => (selMode ? toggleSel(item.id) : playFromPlaylist(selected, index))}
                onLongPress={selMode ? undefined : () => {
                  Alert.alert('移出歌单', `把「${item.title}」从歌单移出？`, [
                    { text: '取消', style: 'cancel' },
                    { text: '移出', style: 'destructive', onPress: () => removeFromPlaylist(selected.id, item.id) },
                  ]);
                }}
              >
                {selMode && (
                  <View style={[styles.checkCircle, checked && styles.checkCircleOn]}>
                    {checked && <FontAwesome name="check" size={13} color="#fff" />}
                  </View>
                )}
                {!selMode && <Text style={[styles.idx, active && styles.idxActive]}>{index + 1}</Text>}
                <Artwork title={item.title} hue={item.hue} size={42} radius={6} />
                <View style={styles.meta}>
                  <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{item.artist} · {item.album}</Text>
                </View>
                {!selMode && active && <FontAwesome name="volume-up" size={15} color="#ff3a3a" />}
              </TouchableOpacity>
            );
          }}
        />
        )}

        {/* 多选操作栏：屏幕中部悬浮（避免被底部 MiniPlayer 挡住） */}
        {selMode && selIds.length > 0 && (
          <View style={styles.actionBar} pointerEvents="box-none">
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnShadow]} onPress={() => setPickerVisible(true)} activeOpacity={0.8}>
              <FontAwesome name="plus" size={16} color="#fff" />
              <Text style={styles.actionTxt}>添加到歌单</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDel, styles.actionBtnShadow]} onPress={onRemoveFromPlaylist} activeOpacity={0.8}>
              <FontAwesome name="trash" size={16} color="#fff" />
              <Text style={styles.actionTxt}>移出歌单</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 添加歌曲弹窗 */}
        <Modal visible={addingSongs} transparent animationType="slide" onRequestClose={() => setAddingSongs(false)}>
          <View style={styles.addMask}>
            <View style={styles.addSheet}>
              <View style={styles.addHeader}>
                <Text style={styles.addTitle}>添加歌曲（{selected.trackIds.length}）</Text>
                <TouchableOpacity onPress={() => setAddingSongs(false)}>
                  <Text style={styles.addDone}>完成</Text>
                </TouchableOpacity>
              </View>
              {library.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptySub}>音乐库还没有歌曲，先去「音乐库」导入</Text>
                </View>
              ) : (
        <FlatList
          key="pl-add-list"
          data={library}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  renderItem={({ item }) => {
                    const inPl = selected.trackIds.indexOf(item.id) >= 0;
                    return (
                      <TouchableOpacity
                        style={styles.row}
                        onPress={() => (inPl ? removeFromPlaylist(selected.id, item.id) : addToPlaylist(selected.id, item.id))}
                      >
                        <Artwork title={item.title} hue={item.hue} size={40} radius={5} />
                        <View style={styles.meta}>
                          <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.sub} numberOfLines={1}>{item.artist} · {item.album}</Text>
                        </View>
                        <FontAwesome
                          name={inPl ? 'check-circle' : 'circle-o'}
                          size={20}
                          color={inPl ? '#ff3a3a' : '#c9c9cf'}
                        />
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* 添加到歌单：选择列表 */}
        <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
          <View style={styles.addMask}>
            <View style={styles.addSheet}>
              <View style={styles.addHeader}>
                <Text style={styles.addTitle}>添加到歌单</Text>
                <TouchableOpacity onPress={() => setPickerVisible(false)}>
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
                    <TouchableOpacity style={styles.pickerRow} onPress={() => onAddToPlaylist(item)}>
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
      </View>
    );
  }

  // ===== 歌单主页 =====
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.hTitle}>歌单</Text>
        <TouchableOpacity style={styles.newBtn} onPress={promptNewPlaylist}>
          <FontAwesome name="plus" size={13} color="#333" />
          <Text style={styles.newTxt}>新建歌单</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {['全部'].concat(categories).map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, cat === c && styles.chipActive]}
              onPress={() => setCat(c)}
              onLongPress={() => onLongPressCategory(c)}
            >
              <Text style={[styles.chipTxt, cat === c && styles.chipTxtActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.chip, styles.chipAdd]} onPress={promptNewCategory}>
            <FontAwesome name="plus" size={11} color="#666" />
            <Text style={[styles.chipTxt, { marginLeft: 3 }]}>分类</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {visiblePlaylists.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="bookmark-o" size={44} color="#c9c9cf" />
          <Text style={styles.emptyTitle}>还没有歌单</Text>
          <Text style={styles.emptySub}>点右上角「新建歌单」，把喜欢的歌归类到一起</Text>
        </View>
      ) : (
        <FlatList
          key="pl-grid-2col"
          data={visiblePlaylists}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 90 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelectedId(item.id)}
              onLongPress={() => onLongPressPlaylist(item)}
            >
              <View style={styles.cardIcon}>
                <FontAwesome name="music" size={26} color="#ff3a3a" />
              </View>
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.cardSub} numberOfLines={1}>{item.trackIds.length} 首 · {item.category}</Text>
            </TouchableOpacity>
          )}
        />
      )}
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
    paddingTop: 8,
    paddingBottom: 8,
  },
  hTitle: { color: '#1a1a1a', fontSize: 24, fontWeight: '800' },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  newTxt: { color: '#1a1a1a', fontSize: 12, marginLeft: 5 },
  chipsWrap: { paddingBottom: 6 },
  chips: { paddingHorizontal: 16, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#f0f0f2',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#ff3a3a' },
  chipTxt: { color: '#1a1a1a', fontSize: 13 },
  chipTxtActive: { color: '#fff', fontWeight: '600' },
  chipAdd: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#d8d8de' },
  card: {
    width: '50%',
    paddingRight: 8,
    paddingBottom: 12,
  },
  cardIcon: {
    backgroundColor: '#fff',
    borderRadius: 14,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardName: { color: '#1a1a1a', fontSize: 15, fontWeight: '600' },
  cardSub: { color: '#999', fontSize: 12, marginTop: 3 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { color: '#1a1a1a', fontSize: 18, fontWeight: '700', marginTop: 14 },
  emptySub: { color: '#9a9a9a', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  // 详情页
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { width: 32, alignItems: 'center' },
  detailMeta: { flex: 1, marginLeft: 4 },
  detailTitle: { color: '#1a1a1a', fontSize: 18, fontWeight: '800' },
  detailSub: { color: '#999', fontSize: 12, marginTop: 2 },
  detailAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  detailBtnRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f2',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginRight: 10,
  },
  detailBtnPrimary: { backgroundColor: '#ff3a3a' },
  detailBtnTxt: { color: '#1a1a1a', fontSize: 14, marginLeft: 6 },
  detailBtnTxtPrimary: { color: '#fff', fontSize: 14, marginLeft: 6, fontWeight: '600' },
  detailBtnDisabled: { opacity: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  rowActive: {
    backgroundColor: 'rgba(255,58,58,0.08)',
    borderRadius: 8,
  },
  rowChecked: {
    backgroundColor: '#fff7f7',
    borderRadius: 8,
  },
  // 多选勾选框
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#c4c4cc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkCircleOn: { backgroundColor: '#ff3a3a', borderColor: '#ff3a3a' },
  idx: { width: 26, color: '#999', fontSize: 13, textAlign: 'center' },
  idxActive: { color: '#ff3a3a' },
  meta: { marginLeft: 10, flex: 1 },
  name: { color: '#1a1a1a', fontSize: 15 },
  nameActive: { color: '#ff3a3a' },
  sub: { color: '#999', fontSize: 12, marginTop: 3 },
  addMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  addSheet: {
    height: '72%',
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
  // 多选操作栏：屏幕中部悬浮胶囊（避开底部 MiniPlayer / TabBar）
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '45%',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 50,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,26,26,0.92)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 22,
    marginHorizontal: 6,
  },
  actionBtnShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  actionBtnDel: { backgroundColor: 'rgba(255,58,58,0.95)' },
  actionTxt: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 6 },
});
