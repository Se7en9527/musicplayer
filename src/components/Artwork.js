import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 占位封面：用歌曲标题首字 + 由标题生成的色相做渐变，模拟 QQ 音乐无封面时的效果
export default function Artwork({ title, hue, size = 48, radius = 6 }) {
  const h = hue == null ? 200 : hue;
  const bg = {
    backgroundColor: `hsl(${h}, 45%, 28%)`,
  };
  const letter = (title || '♪').trim().charAt(0) || '♪';
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: radius, backgroundColor: `hsl(${h}, 45%, 30%)` },
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `hsl(${h}, 55%, 18%)`, opacity: 0.5 }]} />
      <Text style={[styles.letter, { fontSize: size * 0.4 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letter: {
    color: '#fff',
    fontWeight: '700',
  },
});
