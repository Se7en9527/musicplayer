# 云音乐 · 离线音乐播放器（iPhone / iPad）

完全离线、不联网的本地音乐播放器，界面仿 QQ 音乐。支持：
- 底部悬浮迷你播放器（常驻在标签栏上方）
- 黑胶唱片转动播放页、随机 / 顺序 / 单曲循环
- 播放列表按「歌名 A-Z」「专辑 A-Z」排序
- 半屏播放列表，可点击切换歌曲、定位当前播放
- 三种离线导入：数据线 iTunes 文件共享 / 读取手机音乐库 / WiFi 上传页

> ⚠️ **重要结论（2026-09 实测）**：免费 Apple ID **无法**用 EAS 云编译给真机签名的 IPA
> （苹果硬限制：免费账号的"个人团队"只能由 Mac 上的 Xcode 创建）。
> 所以本教程已切换为：**GitHub Actions 云端打包未签名 IPA + Windows 上用 Sideloadly 签名安装**。
> 详见 `教程-GitHub免费打包安装.md`（新手一步步图文版）。

---

## 一、打包 IPA（GitHub 云端，免费，Windows 即可）

1. 注册 GitHub 账号（https://github.com/signup）；
2. 用 GitHub Desktop（https://desktop.github.com）把本项目上传到你的 GitHub 仓库（公开仓库 Actions 无限免费）；
3. 仓库页 → **Actions** → 选 **Build unsigned iOS IPA** → **Run workflow**；
4. 等 15~25 分钟变绿勾 → 记录页底部 **Artifacts** 下载 `App-unsigned-ipa` → 解压得到 `App-unsigned.ipa`。

工程已内置流水线：`.github/workflows/build-ipa.yml`（自动 prebuild → pod install → 无签名 archive → 打包 IPA）。

## 二、把 IPA 装进 iPhone（免费签名，Windows 即可）

**用 Sideloadly（推荐，最简单）**：https://sideloadly.io 下载 Windows 版 →
数据线连 iPhone（信任电脑）→ Sideloadly 里填你的 Apple ID → 拖入 `.ipa` → Start → 装好。

装完手机上首次运行前必做（很多人卡在这）：
1. 设置 → 隐私与安全性 → **开发者模式** → 打开（重启手机）；
2. 设置 → 通用 → **VPN与设备管理** → 信任你的 Apple ID。

> AltStore（https://altstore.io）是备选：优点是手机与电脑同 WiFi 时**自动续签**，
> 但安装步骤比 Sideloadly 多。想省事可先用 Sideloadly 装上，之后再补 AltStore 负责续签。

## 三、7 天续签（免费 Apple ID 的常态，你的实际情况）

免费签名每 7 天过期一次。续期任选其一：
- 数据线连电脑 → Sideloadly 再拖一次 ipa → Start（App 数据和音乐保留）；
- 或装 AltServer，让 AltStore 同 WiFi 自动续签。

> 想要「一年才管一次」→ 付费 $99/年开发者账号（届时 EAS 云编译也能直接用）。
> 「永久不过期」的 TrollStore 仅支持 iOS ≤16.6.1，你的 18.1.1 不支持。

---

## 四、把音乐弄进 App（三种方式，全离线）

### 方式一：数据线 + iTunes 文件共享（最稳，推荐先用这个）
1. iPhone 连电脑，打开 iTunes（Windows）→ 选你的设备。
2. 点「文件共享」→ App 列表里选「云音乐」。
3. 把 mp3 / m4a / wav / flac 拖进右侧窗口。
4. 打开 App，「音乐库」自动扫描出来。

### 方式二：读取手机音乐库
在 App 里点「从音乐库导入」→ 允许访问 → 选本机已授权的歌曲（读不到 Apple Music 订阅在线曲）。

### 方式三：WiFi 上传页（需重新打包启用，见下）

---

## 五、启用 WiFi 上传（可选，默认未开）
1. 编辑 `app.json`，plugins 改为：
```json
"plugins": [
  "expo-media-library",
  "./plugins/withWifiServer.js"
]
```
2. 提交到 GitHub，重新跑一次 Actions 打包 → Sideloadly 重装。
3. App 内「WiFi 上传」→ 手机电脑同一 WiFi → 电脑浏览器打开提示的地址 → 拖歌上传。

---

## 六、借 Mac 方案（备选）
借到 Mac 时：装 Xcode → 项目目录 `npx expo prebuild -p ios` → Xcode 打开 `ios` 工程，
设置里登录免费 Apple ID，连 iPhone 点 ▶ 运行即装上（7 天续签同上）。

---

## 七、目录结构
```
MusicPlayer/
├── App.js                  # 入口与导航
├── app.json                # Expo 配置（权限、插件）
├── eas.json                # 构建配置（付费账号时可用）
├── .github/workflows/build-ipa.yml  # GitHub 云打包流水线（免费通道）
├── plugins/                # 可选 WiFi 上传原生插件
└── src/
    ├── store/usePlayerStore.js   # 播放内核 + 曲库状态
    ├── services/wifiUpload.js    # WiFi 上传桥接
    ├── screens/                  # 音乐库 / 我的 / 播放页 / WiFi
    ├── components/               # 迷你播放器 / 黑胶 / 排序菜单 / 半屏列表
    └── utils/format.js
```

> iOS 读「手机音乐库」是用户手动授权选择，读不到 Apple Music 订阅的在线曲（系统限制）。USB 文件共享方式不受此限制，最稳妥。
