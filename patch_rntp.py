#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
给 react-native-track-player v4.1.1 的 iOS 原生层做「MPRemoteCommandCenter 直接接管」补丁。

为什么需要这个补丁：
  锁屏/控制中心的按钮 -> MPRemoteCommandCenter -> RNTP/SwiftAudioEx 的 RemoteCommandController
  闭包。在部分 Expo/构建环境里，SwiftAudioEx 这一层没能把命令真正派发到闭包（表现为：进度条
  正常，但锁屏/控制中心点了完全没反应，连暂停/播放都不行）。这一层无法在本地可靠验证，是最可能
  的失败点。

本补丁的做法（最稳，不依赖 SwiftAudioEx 那层）：
  在 RNTP 的 setupPlayer 里，直接对 MPRemoteCommandCenter.shared() 的每个命令
  removeTarget(nil)（清掉 SwiftAudioEx 注册的目标），再用 addTarget 把命令直接绑到
  self?.player 的原生方法（play/pause/togglePlaying/next/previous/seek）。
  这样无论 SwiftAudioEx 的 RemoteCommandController 有没有正常接线，锁屏/控制中心都必定驱动播放器。

注意：
  - self?.player 的方法（play/pause/next/previous/togglePlaying/seek(to:)）已在上一版云构建中
    编译通过，确认是 SwiftAudioEx AudioPlayer 的合法方法。
  - 不双重触发：我们清掉了 SwiftAudioEx 的目标，且不再往它的闭包里注入 player 调用，
    所以 next/previous/toggle 不会因为两个目标都 firing 而跳两首 / 切换两次。
  - 注入唯一字符串标记 __LSCTL_TAKEOVER__，编译后作为字符串字面量留在二进制，便于下载后验证。
"""
import os
import sys

# 在 setupPlayer 中、configureAudioSession() 之后、事件监听闭包赋值之前，注入接管代码。
# 此位置在 SwiftAudioEx 的 bind()（init 时已注册目标）之后，removeTarget 能清掉它的目标。
TAKEOVER_ANCHOR_OLD = (
    "        configureAudioSession()\n"
    "\n"
    "        // setup event listeners\n"
)

TAKEOVER_ANCHOR_NEW = (
    "        configureAudioSession()\n"
    "\n"
    "        // === LSCTL takeover: bind MPRemoteCommandCenter directly to the player ===\n"
    "        let lsctlCenter = MPRemoteCommandCenter.shared()\n"
    "        lsctlCenter.playCommand.removeTarget(nil)\n"
    "        lsctlCenter.playCommand.addTarget { [weak self] _ in self?.player.play(); return .success }\n"
    "        lsctlCenter.pauseCommand.removeTarget(nil)\n"
    "        lsctlCenter.pauseCommand.addTarget { [weak self] _ in self?.player.pause(); return .success }\n"
    "        lsctlCenter.togglePlayPauseCommand.removeTarget(nil)\n"
    "        lsctlCenter.togglePlayPauseCommand.addTarget { [weak self] _ in self?.player.togglePlaying(); return .success }\n"
    "        lsctlCenter.nextTrackCommand.removeTarget(nil)\n"
    "        lsctlCenter.nextTrackCommand.addTarget { [weak self] _ in self?.player.next(); return .success }\n"
    "        lsctlCenter.previousTrackCommand.removeTarget(nil)\n"
    "        lsctlCenter.previousTrackCommand.addTarget { [weak self] _ in self?.player.previous(); return .success }\n"
    "        lsctlCenter.changePlaybackPositionCommand.removeTarget(nil)\n"
    "        lsctlCenter.changePlaybackPositionCommand.addTarget { [weak self] event in\n"
    "            if let e = event as? MPChangePlaybackPositionCommandEvent { self?.player.seek(to: e.positionTime) }\n"
    "            return .success\n"
    "        }\n"
    '        print("__LSCTL_TAKEOVER__")\n'
    "\n"
    "        // setup event listeners\n"
)

# 仅这一个替换：把接管代码插进 setupPlayer。不再往 SwiftAudioEx 的闭包里注入（避免双重触发）。
REPLACEMENTS = [
    (TAKEOVER_ANCHOR_OLD, TAKEOVER_ANCHOR_NEW),
]

# 用于「已打过补丁」判定的标记
ALREADY_MARKERS = [
    "lsctlCenter",
    "__LSCTL_TAKEOVER__",
]


def find_targets():
    targets = []
    # 不限制父目录名：Expo 把 RNTP 的 Pods 副本放在 ReactNativeTrackPlayer 等目录名下，
    # 必须靠文件名递归匹配，否则会漏掉真正被编译的那份（导致补丁白打）。
    for base in ("node_modules", "ios"):
        for root, _, files in os.walk(base):
            if "RNTrackPlayer.swift" in files:
                p = os.path.join(root, "RNTrackPlayer.swift")
                if p not in targets:
                    targets.append(p)
    return targets


def patch_file(path):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    if all(m in text for m in ALREADY_MARKERS):
        print(f"  SKIP (already patched): {path}")
        return "skip"
    applied = 0
    for old, new in REPLACEMENTS:
        if old in text:
            text = text.replace(old, new, 1)
            applied += 1
        elif new in text:
            # 单条已应用，跳过
            applied += 1
    if applied != len(REPLACEMENTS):
        print(
            f"  !! PATCH FAILED: {path} (only {applied}/{len(REPLACEMENTS)} applied; "
            f"source text mismatch)"
        )
        return "fail"
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"  PATCHED: {path}")
    return "ok"


def main():
    print("== patch RNTP: take over MPRemoteCommandCenter directly (lock-screen native fix) ==")
    targets = find_targets()
    if not targets:
        print("  !! No RNTrackPlayer.swift found — RNTP not installed? Aborting.")
        sys.exit(1)
    results = [patch_file(p) for p in targets]
    if "fail" in results:
        sys.exit(1)
    print("  RNTP takeover patch step done.")


if __name__ == "__main__":
    main()
