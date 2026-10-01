import React, { useEffect, useRef, useState } from 'react';
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
import playbackService from './src/services/trackPlayerService';

// 注册后台播放服务（锁屏/控制中心/线控），必须在模块顶层注册一次
TrackPlayer.registerPlaybackService(() => playbackService);

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
  const [topRoute, setTopRoute] = useState('Main');
  const init = usePlayerStore((s) => s.init);

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
        <NavigationContainer
          ref={navRef}
          theme={theme}
          onStateChange={() => {
            const name = navRef.current?.getCurrentRoute()?.name;
            setTopRoute(name || 'Main');
          }}
        >
          <StatusBar style="dark" />
          <Stack.Navigator screenOptions={{ headerShown: false, presentation: 'modal' }}>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="NowPlaying" component={NowPlayingScreen} />
            <Stack.Screen name="Wifi" component={WifiScreen} />
          </Stack.Navigator>
          {/* 只在主界面（Tab 页）显示迷你播放条；播放页/WiFi 页隐藏，与 QQ 音乐一致 */}
          {topRoute === 'Main' && <MiniPlayer onExpand={() => navRef.current?.navigate('NowPlaying')} />}
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
