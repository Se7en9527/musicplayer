import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

// 兜住首屏渲染期的 JS 报错：Release 包默认一报错就闪退，
// 有了这个边界，会直接把错误文字显示出来，方便截图发给开发者定位。
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const e = this.state.error;
      const text = String(e && (e.stack || e.message || e));
      return (
        <ScrollView style={styles.box}>
          <Text style={styles.title}>出错了（请把这页截图发我）</Text>
          <Text style={styles.msg}>{text}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: '#0c0c0c', padding: 20, paddingTop: 60 },
  title: { color: '#e60026', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  msg: { color: '#ddd', fontSize: 12, lineHeight: 20 },
});
