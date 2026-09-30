import { NativeModules } from 'react-native';

// WiFi 上传服务：依赖 App 内启的本地 HTTP 服务（需启用 plugins/withWifiServer 插件）。
// 若该原生模块未编译进 App，则 isWifiSupported() 返回 false。
const WifiUpload = NativeModules.WifiUpload;

export function isWifiSupported() {
  return !!WifiUpload;
}

export async function startWifiServer() {
  if (!WifiUpload) throw new Error('WIFI_MODULE_MISSING');
  return WifiUpload.startServer();
}

export async function stopWifiServer() {
  if (!WifiUpload) return;
  return WifiUpload.stopServer();
}

export async function getWifiAddress() {
  if (!WifiUpload) return null;
  return WifiUpload.getAddress();
}
