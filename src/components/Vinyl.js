import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Artwork from './Artwork';

// 黑胶唱片转动画面：外圈黑胶 + 中间封面圆，播放时匀速旋转
export default function Vinyl({ title, hue, playing, size = 260 }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim;
    if (playing) {
      anim = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 16000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      anim.start();
    } else {
      // 暂停时定格
      spin.stopAnimation();
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [playing, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.disc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ rotate }],
          },
        ]}
      >
        {/* 黑胶纹理 */}
        <View style={[styles.groove, { width: size * 0.92, height: size * 0.92, borderRadius: size * 0.46 }]} />
        <View style={[styles.groove, { width: size * 0.78, height: size * 0.78, borderRadius: size * 0.39 }]} />
        <View style={[styles.groove, { width: size * 0.64, height: size * 0.64, borderRadius: size * 0.32 }]} />
        {/* 中心封面 */}
        <View style={[styles.center, { width: size * 0.46, height: size * 0.46, borderRadius: size * 0.23 }]}>
          <Artwork title={title} hue={hue} size={size * 0.46} radius={size * 0.23} />
          <View style={[styles.spindle, { width: size * 0.06, height: size * 0.06, borderRadius: size * 0.03 }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  groove: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'transparent',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  spindle: {
    position: 'absolute',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#444',
  },
});
