import React, { useEffect, useRef } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { usePlayerStore } from './src/store/usePlayerStore';
import LibraryScreen from './src/screens/LibraryScreen';
import MyScreen from './src/screens/MyScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import WifiScreen from './src/screens/WifiScreen';
import MiniPlayer from './src/components/MiniPlayer';
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
    background: '#0c0c0c',
    card: '#0c0c0c',
    text: '#fff',
    border: '#222',
  },
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0c0c0c', borderTopColor: '#222' },
        tabBarActiveTintColor: '#e60026',
        tabBarInactiveTintColor: '#888',
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

  useEffect(() => {
    init();
  }, [init]);

  return (
    <NavigationContainer ref={navRef} theme={theme}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false, presentation: 'modal' }}>
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="NowPlaying" component={NowPlayingScreen} />
        <Stack.Screen name="Wifi" component={WifiScreen} />
      </Stack.Navigator>
      <MiniPlayer onExpand={() => navRef.current?.navigate('NowPlaying')} />
    </NavigationContainer>
  );
}
