import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { isWifiSupported, startWifiServer, stopWifiServer, getWifiAddress } from '../services/wifiUpload';
import { FontAwesome } from '@expo/vector-icons';

export default function WifiScreen() {
  const [address, setAddress] = useState(null);
  const [supported] = useState(isWifiSupported());

  useEffect(() => {
    let mounted = true;
    if (supported) {
      startWifiServer()
        .then(() => getWifiAddress())
        .then((addr) => mounted && setAddress(addr))
        .catch((e) => Alert.alert('启动失败', String(e && e.message)));
    }
    return () => {
      mounted = false;
      if (supported) stopWifiServer().catch(() => {});
    };
  }, [supported]);

  if (!supported) {
    return (
      <View style={styles.container}>
        <FontAwesome name="wifi" size={40} color="#444" />
        <Text style={styles.title}>WiFi 上传未启用</Text>
        <Text style={styles.sub}>当前安装包未包含 WiFi 上传原生模块。</Text>
        <Text style={styles.sub}>最快的替代方式：用数据线连电脑，在 iTunes/Finder「文件共享」里把音频拖进「云音乐」即可。</Text>
        <Text style={styles.sub}>如需启用 WiFi 上传：在 app.json 的 plugins 中加上 "./plugins/withWifiServer.js" 并重新构建（详见 README）。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FontAwesome name="wifi" size={40} color="#e60026" />
      <Text style={styles.title}>WiFi 上传</Text>
      {address ? (
        <>
          <Text style={styles.sub}>电脑连同一 WiFi，浏览器打开：</Text>
          <Text style={styles.addr}>{address}</Text>
          <Text style={styles.sub}>打开后把音乐文件拖进页面即可传到手机。</Text>
        </>
      ) : (
        <Text style={styles.sub}>正在启动本地服务…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 16 },
  sub: { color: '#999', fontSize: 13, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  addr: {
    color: '#e60026',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    padding: 10,
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
  },
});
