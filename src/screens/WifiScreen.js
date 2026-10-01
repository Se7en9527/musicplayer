import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startWifiServer, stopWifiServer, setOnFileUploaded } from '../services/wifiUpload';
import { usePlayerStore } from '../store/usePlayerStore';
import { FontAwesome } from '@expo/vector-icons';

export default function WifiScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);

  // WiFi 页聚焦时隐藏迷你播放条，返回时必然恢复
  useFocusEffect(
    useCallback(() => {
      usePlayerStore.getState().hidePlayerBar();
      return () => usePlayerStore.getState().showPlayerBar();
    }, [])
  );

  useEffect(() => {
    let mounted = true;
    // 收到上传的文件后自动刷新音乐库
    setOnFileUploaded(() => {
      usePlayerStore.getState().loadLibrary().catch(() => {});
    });
    startWifiServer()
      .then((addr) => {
        if (mounted) setAddress(addr);
      })
      .catch((e) => {
        if (mounted) setError(String((e && e.message) || e));
      });
    return () => {
      mounted = false;
      stopWifiServer();
    };
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <FontAwesome name="chevron-left" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>WiFi 上传</Text>
        <View style={{ width: 34 }} />
      </View>
      <View style={styles.body}>
        <FontAwesome name="wifi" size={40} color="#ff3a3a" />
        <Text style={styles.title}>电脑传歌到手机</Text>
        {error ? (
          <Text style={styles.sub}>启动失败：{error}</Text>
        ) : address ? (
          <>
            <Text style={styles.sub}>手机和电脑连同一个 WiFi，电脑浏览器打开：</Text>
            <Text style={styles.addr}>{address}</Text>
            <Text style={styles.sub}>打开页面 → 选择音乐文件 → 开始上传。</Text>
            <Text style={styles.sub}>上传完成后自动进入音乐库。</Text>
          </>
        ) : (
          <Text style={styles.sub}>正在启动本地服务…</Text>
        )}
        <Text style={styles.tip}>
          提示：若浏览器打不开该地址，请在手机「设置 → 隐私与安全性 → 本地网络」中允许「云音乐」。
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f9' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#1a1a1a', fontSize: 17, fontWeight: '700' },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: { color: '#1a1a1a', fontSize: 20, fontWeight: '700', marginTop: 16 },
  sub: { color: '#666', fontSize: 13, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  addr: {
    color: '#ff3a3a',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tip: { color: '#b0b0b0', fontSize: 12, marginTop: 24, textAlign: 'center', lineHeight: 18 },
});
