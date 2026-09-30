// Expo 配置插件：把本地 HTTP 上传服务（GCDWebServer）编译进 iOS 工程。
// 默认不启用（见 app.json 的 plugins）。启用方法见 README「启用 WiFi 上传」。
const { withPodfile, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

function withWifiPod(config) {
  return withPodfile(config, (cfg) => {
    const podfile = cfg.modResults;
    if (!podfile.contents.includes('GCDWebServer')) {
      podfile.contents = podfile.contents.replace(
        /use_expo_modules!\n/,
        "use_expo_modules!\npod 'GCDWebServer', '~> 3.5.0'\n"
      );
    }
    return cfg;
  });
}

function withWifiSource(config) {
  return withDangerousMod(config, ['ios', async (cfg) => {
    const projectRoot = cfg.modRequest.projectRoot;
    const iosDir = path.join(projectRoot, 'ios');
    const entries = fs.readdirSync(iosDir);
    const xc = entries.find((e) => e.endsWith('.xcodeproj'));
    if (!xc) return cfg;
    const projName = xc.replace('.xcodeproj', '');
    const pbxPath = path.join(iosDir, xc, 'project.pbxproj');
    const destDir = path.join(iosDir, projName);

    for (const f of ['WifiUpload.h', 'WifiUpload.m']) {
      fs.copyFileSync(path.join(__dirname, f), path.join(destDir, f));
    }

    const proj = xcode.project(pbxPath);
    proj.parseSync();
    if (!proj.getSourceByPath || !proj.getSourceByPath('WifiUpload.m')) {
      proj.addSourceFile('WifiUpload.m', { target: proj.getFirstTarget().uuid });
      proj.addSourceFile('WifiUpload.h', { target: proj.getFirstTarget().uuid });
    }
    fs.writeFileSync(pbxPath, proj.writeSync());
    return cfg;
  }]);
}

module.exports = function withWifiServer(config) {
  config = withWifiPod(config);
  config = withWifiSource(config);
  return config;
};
