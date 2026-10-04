#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
给 react-native-track-player v4.1.1 的 iOS 原生远程控制 handler 打“原生兜底”补丁。

问题背景：
  锁屏/控制中心的按钮 -> SwiftAudioEx 的 MPRemoteCommandCenter -> RNTP 在 setupPlayer 里
  注册的闭包。RNTP 默认把闭包写成“只把事件 emit 给 JS”。
  在部分 Expo/构建环境里，JS 侧始终收不到 remote-* 事件（进度事件却能收到），
  导致锁屏按钮点了音乐完全不动。

修复思路：
  让每个原生 handler 先直接驱动 SwiftAudioEx 的播放器（player.play/pause/next/previous/seek
  /togglePlaying），再 emit 给 JS。这样即使 JS 事件链路是坏的，锁屏也能直接控制音乐；
  若 JS 链路正常，emit 照常触发 store 的 next()/prev() 等逻辑（保留重复/随机模式与 UI 同步）。

补丁目标：node_modules 下（pod install 读取的源）以及 ios/Pods 下可能存在的副本。
等价于 RNTP 官方仓库 v4.1.1 标签的 ios 源码，文本逐字匹配。
"""
import os
import sys

# 6 个关键 handler 的 (旧闭包片段, 新闭包片段) —— 旧片段取自 RNTP v4.1.1 真实源码
REPLACEMENTS = [
    # 拖动进度条快进
    (
        '            if let event = event as? MPChangePlaybackPositionCommandEvent {\n'
        '                self?.emit(event: EventType.RemoteSeek, body: ["position": event.positionTime])\n'
        '                return MPRemoteCommandHandlerStatus.success\n'
        '            }',
        '            if let event = event as? MPChangePlaybackPositionCommandEvent {\n'
        '                self?.player.seek(to: event.positionTime)\n'
        '                self?.emit(event: EventType.RemoteSeek, body: ["position": event.positionTime])\n'
        '                return MPRemoteCommandHandlerStatus.success\n'
        '            }',
    ),
    # 下一首
    (
        '        player.remoteCommandController.handleNextTrackCommand = { [weak self] _ in\n'
        '            self?.emit(event: EventType.RemoteNext)\n'
        '            return MPRemoteCommandHandlerStatus.success\n'
        '        }',
        '        player.remoteCommandController.handleNextTrackCommand = { [weak self] _ in\n'
        '            self?.player.next()\n'
        '            self?.emit(event: EventType.RemoteNext)\n'
        '            return MPRemoteCommandHandlerStatus.success\n'
        '        }',
    ),
    # 暂停
    (
        '        player.remoteCommandController.handlePauseCommand = { [weak self] _ in\n'
        '            self?.emit(event: EventType.RemotePause)\n'
        '            return MPRemoteCommandHandlerStatus.success\n'
        '        }',
        '        player.remoteCommandController.handlePauseCommand = { [weak self] _ in\n'
        '            self?.player.pause()\n'
        '            self?.emit(event: EventType.RemotePause)\n'
        '            return MPRemoteCommandHandlerStatus.success\n'
        '        }',
    ),
    # 播放
    (
        '        player.remoteCommandController.handlePlayCommand = { [weak self] _ in\n'
        '            self?.emit(event: EventType.RemotePlay)\n'
        '            return MPRemoteCommandHandlerStatus.success\n'
        '        }',
        '        player.remoteCommandController.handlePlayCommand = { [weak self] _ in\n'
        '            self?.player.play()\n'
        '            self?.emit(event: EventType.RemotePlay)\n'
        '            return MPRemoteCommandHandlerStatus.success\n'
        '        }',
    ),
    # 上一首
    (
        '        player.remoteCommandController.handlePreviousTrackCommand = { [weak self] _ in\n'
        '            self?.emit(event: EventType.RemotePrevious)\n'
        '            return MPRemoteCommandHandlerStatus.success\n'
        '        }',
        '        player.remoteCommandController.handlePreviousTrackCommand = { [weak self] _ in\n'
        '            self?.player.previous()\n'
        '            self?.emit(event: EventType.RemotePrevious)\n'
        '            return MPRemoteCommandHandlerStatus.success\n'
        '        }',
    ),
    # 播放/暂停切换（锁屏圆按钮）
    (
        '        player.remoteCommandController.handleTogglePlayPauseCommand = { [weak self] _ in\n'
        '            self?.emit(event: self?.player.playerState == .paused\n'
        '                ? EventType.RemotePlay\n'
        '                : EventType.RemotePause\n'
        '            )\n'
        '\n'
        '            return MPRemoteCommandHandlerStatus.success\n'
        '        }',
        '        player.remoteCommandController.handleTogglePlayPauseCommand = { [weak self] _ in\n'
        '            self?.player.togglePlaying()\n'
        '            self?.emit(event: self?.player.playerState == .paused\n'
        '                ? EventType.RemotePlay\n'
        '                : EventType.RemotePause\n'
        '            )\n'
        '\n'
        '            return MPRemoteCommandHandlerStatus.success\n'
        '        }',
    ),
]

# 用于“已打过补丁”判定的标记
ALREADY_MARKERS = [
    'self?.player.next()',
    'self?.player.pause()',
    'self?.player.play()',
    'self?.player.previous()',
    'self?.player.togglePlaying()',
    'self?.player.seek(to: event.positionTime)',
]


def find_targets():
    targets = []
    # node_modules 源（pod install 读取）
    for root, _, files in os.walk('node_modules'):
        if os.path.basename(root) == 'RNTrackPlayer' and 'RNTrackPlayer.swift' in files:
            targets.append(os.path.join(root, 'RNTrackPlayer.swift'))
    # 已生成的 Pods 副本（若已 prebuild 过）
    for root, _, files in os.walk('ios'):
        if os.path.basename(root) == 'RNTrackPlayer' and 'RNTrackPlayer.swift' in files:
            p = os.path.join(root, 'RNTrackPlayer.swift')
            if p not in targets:
                targets.append(p)
    return targets


def patch_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    if all(m in text for m in ALREADY_MARKERS):
        print(f'  SKIP (already patched): {path}')
        return 'skip'
    applied = 0
    for old, new in REPLACEMENTS:
        if old in text:
            text = text.replace(old, new, 1)
            applied += 1
        elif new in text:
            # 单条已应用，跳过
            applied += 1
    if applied != len(REPLACEMENTS):
        print(f'  !! PATCH FAILED: {path} (only {applied}/{len(REPLACEMENTS)} applied; '
              f'source text mismatch)')
        return 'fail'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'  PATCHED: {path}')
    return 'ok'


def main():
    print('== patch RNTP native remote handlers (native fallback for lock screen) ==')
    targets = find_targets()
    if not targets:
        print('  !! No RNTrackPlayer.swift found — RNTP not installed? Aborting.')
        sys.exit(1)
    results = [patch_file(p) for p in targets]
    if 'fail' in results:
        sys.exit(1)
    print('  RNTP patch step done.')


if __name__ == '__main__':
    main()
