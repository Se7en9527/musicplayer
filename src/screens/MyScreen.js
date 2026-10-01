import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import { FontAwesome } from '@expo/vector-icons';

export default function MyScreen() {
  const library = usePlayerStore((s) => s.library);
  const importFromMediaLibrary = usePlayerStore((s) => s.importFromMediaLibrary);

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
  container: { flex: 1, backgroundColor: '#f7f7f9', paddingTop: 20, paddingHorizontal: 16 },
  title: { color: '#1a1a1a', fontSize: 24, fontWeight: '800', marginBottom: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { color: '#1a1a1a', fontSize: 16, fontWeight: '700' },
  cardSub: { color: '#999', fontSize: 13, marginTop: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  itemTxt: { color: '#1a1a1a', fontSize: 15, marginLeft: 12 },
  tips: { marginTop: 8, padding: 4 },
  tipsTitle: { color: '#1a1a1a', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  tip: { color: '#999', fontSize: 13, lineHeight: 22, marginBottom: 10 },
});
