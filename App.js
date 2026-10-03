import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { usePlayerStore } from './src/store/usePlayerStore';
import LibraryScreen from './src/screens/LibraryScreen';
import PlaylistsScreen from './src/screens/PlaylistsScreen';
import MyScreen from './src/screens/MyScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import WifiScreen from './src/screens/WifiScreen';
import MiniPlayer from './src/components/MiniPlayer';
import ErrorBoundary from './src/components/ErrorBoundary';
import { FontAwesome } from '@expo/vector-icons';
import TrackPlayer from 'react-native-track-player';

// 注册后台播放服务（锁屏/控制中心/线控）。
// 真正的远程控制逻辑注册在 usePlayerStore.init() 里（见 RemotePlay/RemotePause/
// RemoteNext/RemotePrevious/RemoteSeek）——RNTP v4 在 iOS 上远程事件走同一个
// NativeEventEmitter(TrackPlayer)，主 App 的 addEventListener 也能收到，比依赖
// require() 懒加载的独立 service 模块可靠（生产包里那条路径解析不到 → 锁屏一直失效）。
// 这里只保留一个空 service 以满足 RNTP 注册约定（并兼容 Android 后续扩展），不重复注册。
TrackPlayer.registerPlaybackService(() => async () => {});

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#f7f7f9',
      card: '#ffffff',
      text: '#1a1a1a',
      border: '#ececec',
    },
  };

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#ececec' },
        tabBarActiveTintColor: '#ff3a3a',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          title: '音乐库',
          tabBarIcon: ({ color, size }) => <FontAwesome name="music" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Playlists"
        component={PlaylistsScreen}
        options={{
          title: '歌单',
          tabBarIcon: ({ color, size }) => <FontAwesome name="th-list" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="My"
        component={MyScreen}
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => <FontAwesome name="user" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const navRef = useRef(null);
  const init = usePlayerStore((s) => s.init);
  const playerBarHidden = usePlayerStore((s) => s.playerBarHidden);

  useEffect(() => {
    init();
    // 从 iTunes/Finder 文件共享拖入歌曲后，回到 App 时自动重新扫描本地目录
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        usePlayerStore.getState().loadLibrary().catch(() => {});
      } else if (state === 'background' || state === 'inactive') {
        // 退后台/锁屏时保存播放状态，重启后迷你播放条可直接恢复
        usePlayerStore.getState()._persist();
      }
    });
    return () => sub.remove();
  }, [init]);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer ref={navRef} theme={theme}>
          <StatusBar style="dark" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="NowPlaying" component={NowPlayingScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Wifi" component={WifiScreen} />
          </Stack.Navigator>
          {/* 迷你播放条：由页面焦点控制（播放页/WiFi 页聚焦时隐藏，失焦必然恢复） */}
          {!playerBarHidden && <MiniPlayer onExpand={() => navRef.current?.navigate('NowPlaying')} />}
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
