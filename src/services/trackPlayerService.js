// RNTP v4 标准 PlaybackService 入口。
// 关键点：用 `module.exports = async function(){}`（CommonJS 导出），
// 不要用 `export default` —— 否则 App.js 里 `require('./src/services/trackPlayerService')`
// 拿到的是 { default: fn } 而非函数，registerPlaybackService 会拿到非函数 → iOS 启动闪退。
// 真正的远程控制逻辑在 remoteControls.js 的 registerRemoteHandlers() 里（含去重守卫）。
import { registerRemoteHandlers } from './remoteControls';

module.exports = async function playbackService() {
  registerRemoteHandlers();
};
