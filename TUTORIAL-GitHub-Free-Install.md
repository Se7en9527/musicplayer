# 教程：GitHub 免费打包 + Sideloadly 装进 iPhone（全程 0 元，只需 Windows）

> 适用场景：只有 Windows 电脑、不花一分钱、把音乐 App 装进自己的 iPhone（iOS 18.1.1）。
> 原理：GitHub 免费提供"苹果系统的云电脑"帮你编译出**未签名安装包（IPA）**，
> 你在 Windows 上用 **Sideloadly** 小工具用自己的 Apple ID 签名并装进手机。
> 签名 7 天有效，到期插线重签一次即可（App 和音乐数据会保留）。

---

## 第一部分：注册 GitHub 账号（5 分钟）

1. 浏览器打开 **https://github.com/signup**
2. 依次填写：
   - **Email**：你的邮箱 → 点 Continue
   - **Password**：设一个密码（要包含数字和字母）→ Continue
   - **Username**：起个用户名（只能小写字母数字和短横线，比如 `lovepowerstation`）→ Continue
   - 问要不要接收产品邮件 → 输 `n` → Continue
3. 做一个人类验证小拼图 → 验证邮箱（去邮箱点验证链接）

## 第二部分：安装 GitHub Desktop（图形化上传工具，不用敲命令）

1. 打开 **https://desktop.github.com** → 点 Download 下载 → 双击安装
2. 打开 GitHub Desktop → **Sign in to GitHub.com** → 用刚注册的账号登录
3. 它会问 Name 和 Email → Name 随便填，Email 填你的邮箱 → Finish

## 第三部分：把音乐 App 传上去（关键步骤）

1. GitHub Desktop 顶部菜单：**File → New repository**
   - Name：`musicplayer`
   - Local path：选一个好找的位置（比如桌面）
   - 其他都不勾 → **Create repository**
2. 打开这个本地文件夹：菜单 **Repository → Show in Explorer**
   （会打开一个空文件夹 `桌面\musicplayer`）
3. **把 `C:\Users\李安\WorkBuddy\2026-09-30-22-07-55\MusicPlayer` 里的所有内容复制粘贴进这个文件夹**
   （放心整包复制，`node_modules` 会被自动忽略不上传）
4. 回到 GitHub Desktop，左侧会列出所有变化的文件（可能几十个，正常）：
   - 左下角点 **Commit to main**
   - 然后点顶部 **Publish repository**
   - 弹窗里：**保持「Keep this code private」不勾选**（公开仓库 Actions 无限免费；不公开也能用但每月只有约 6 次打包额度）→ **Publish**

## 第四部分：云端打包（约 15~25 分钟）

1. 浏览器打开你的仓库页面：**https://github.com/你的用户名/musicplayer**
2. 点顶部的 **Actions** 标签
3. 左侧列表点 **Build unsigned iOS IPA**
4. 右侧点灰色按钮 **Run workflow →** → 弹出小窗直接点绿色 **Run workflow**
5. 出现一条正在运行的记录（黄色转圈 = 进行中）。**等它变绿勾 ✅**（约 15~25 分钟）
   - 如果变红叉 ❌：点进去截图发我
6. 点进这条成功的记录 → 拉到底部 **Artifacts** 区域 → 下载 **App-unsigned-ipa**
7. 下载下来是个 zip，**解压**得到 `App-unsigned.ipa`（放到桌面好找）

## 第五部分：Windows 装 Sideloadly 并装进手机

1. 打开 **https://sideloadly.io** → 下载 Windows 版 → 安装
2. **用数据线把 iPhone 连上电脑**，手机弹「信任此电脑」→ 信任并输锁屏密码
3. 打开 Sideloadly：
   - 顶部 **Apple ID** 框：输入你的 Apple ID（qqdahai521@163.com）
   - 把桌面的 **App-unsigned.ipa 拖进窗口**
   - 点 **Start**
4. 过程中会要求输 Apple ID 密码（可能还有 6 位双重验证码），照着输
5. 看到 Done/完成 → iPhone 上就会多出「云音乐」图标

## 第六部分：iPhone 上首次运行前必做（iOS 16+ 都要，很多人卡在这）

1. **开开发者模式**：设置 → 隐私与安全性 → **开发者模式** → 打开 → 重启手机
   （没看到这个选项就先重启一次手机再看）
2. **信任开发者**：设置 → 通用 → **VPN与设备管理** → 点你的 Apple ID 那一条 → **信任**
3. 打开「云音乐」就能用了！

## 第七部分：7 天到期怎么续（每次 2 分钟）

签名 7 天过期，过期后 App 打不开（不是坏了）。续期：
- 数据线连电脑 → 打开 Sideloadly → 再拖一次 ipa → Start（**App 数据和音乐保留**）
- 或者配 AltStore 实现同 WiFi 自动续签（教程：https://altstore.io）

## 常见坑对照表

| 现象 | 原因 | 解决 |
|---|---|---|
| Actions 打包红叉 | 多半是依赖版本/网络问题 | 点进失败记录截图发我 |
| 手机上装完图标是灰的/闪退 | 没开开发者模式或没信任 | 见第六部分 1、2 步 |
| Sideloadly 报 7 天/证书错误 | 免费账号装满 3 个自签 App 或 7 天到期 | 删掉不用的自签 App 再装；到期重签 |
| 手机连电脑没反应 | 数据线是充电线 | 换一根能传数据的线 |
| 双重验证码收不到 | 没弹窗 | 设置→顶部名字→看登录请求 |
| 每月打包次数用完 | 私有仓库限额 | 把仓库设为 Public（Settings→Danger Zone→Change visibility） |
