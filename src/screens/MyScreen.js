import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import { FontAwesome } from '@expo/vector-icons';

export default function MyScreen() {
  const library = usePlayerStore((s) => s.library);
  const importFromMediaLibrary = usePlayerStore((s) => s.importFromMediaLibrary);

  const onImportLib = async () => {
    const r = await importFromMediaLibrary();
    if (!r.ok) {
      if (r.reason === 'denied') Alert.alert('需要授权', '请在系统弹窗中允许访问音乐库');
      return;
    }
    Alert.alert('导入完成', `已从音乐库导入 ${r.count} 首`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>我的</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>云音乐 · 离线播放器</Text>
        <Text style={styles.cardSub}>已全部下载 {library.length} 首到本机，离线可用</Text>
      </View>

      <TouchableOpacity style={styles.item} onPress={onImportLib}>
        <FontAwesome name="music" size={18} color="#e60026" />
        <Text style={styles.itemTxt}>从手机音乐库导入</Text>
      </TouchableOpacity>

      <View style={styles.tips}>
        <Text style={styles.tipsTitle}>如何把电脑上的歌弄进来（不联网）</Text>
        <Text style={styles.tip}>1. 数据线连电脑，打开 iTunes / Finder → 设备 → 文件共享 → 选「云音乐」→ 拖入 mp3/m4a 等音频文件</Text>
        <Text style={styles.tip}>2. 或在「音乐库」页面点「WiFi 上传」，手机电脑同一 WiFi，浏览器打开提示的地址拖歌进去（需启用 WiFi 插件）</Text>
        <Text style={styles.tip}>3. 或点「从手机音乐库导入」直接读取本机已授权的歌曲</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c', paddingTop: 20, paddingHorizontal: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 16 },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardSub: { color: '#999', fontSize: 13, marginTop: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  itemTxt: { color: '#fff', fontSize: 15, marginLeft: 12 },
  tips: { marginTop: 8, padding: 4 },
  tipsTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  tip: { color: '#999', fontSize: 13, lineHeight: 22, marginBottom: 10 },
});
