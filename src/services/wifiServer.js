import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';

// 纯 JS 实现的本地 HTTP 上传服务器（基于 react-native-tcp-socket，无需原生插件）。
// 浏览器打开 http://<手机IP>:<port> 后选择音频文件，前端用 PUT /upload/<文件名> 上传原始字节。
const AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.opus', '.ogg', '.wma'];
const PORTS = [8080, 8081, 8090];

let server = null;
let port = null;
let onFileUploaded = null;

function isAudio(name) {
  const lower = (name || '').toLowerCase();
  return AUDIO_EXT.some((ext) => lower.endsWith(ext));
}

export function isWifiSupported() {
  return true;
}

export function setOnFileUploaded(cb) {
  onFileUploaded = cb;
}

function chunksToBase64(chunks) {
  try {
    return Buffer.concat(chunks).toString('base64');
  } catch (e) {
    // 兜底：手动拼接后按 3 的倍数分块转 base64（保证拼接正确性）
    let total = 0;
    chunks.forEach((c) => {
      total += c.length;
    });
    const all = new Uint8Array(total);
    let off = 0;
    chunks.forEach((c) => {
      all.set(new Uint8Array(c), off);
      off += c.length;
    });
    let out = '';
    const CH = 3 * 32768; // 3 的倍数，分块 base64 可直接拼接
    for (let i = 0; i < all.length; i += CH) {
      out += Buffer.from(all.subarray(i, Math.min(i + CH, all.length))).toString('base64');
    }
    return out;
  }
}

function respond(socket, status, type, body) {
  try {
    const buf = Buffer.from(body, 'utf8');
    socket.write(`HTTP/1.1 ${status}\r\nContent-Type: ${type}\r\nContent-Length: ${buf.length}\r\nConnection: close\r\n\r\n`);
    socket.write(buf);
    setTimeout(() => {
      try {
        socket.destroy();
      } catch (e) {
        /* noop */
      }
    }, 500);
  } catch (e) {
    /* noop */
  }
}

function handleRequest(socket, req) {
  if (req.method === 'GET') {
    respond(socket, '200 OK', 'text/html; charset=utf-8', UPLOAD_PAGE);
    return;
  }
  if (req.method === 'PUT' && req.path.indexOf('/upload/') === 0) {
    let name = 'track';
    try {
      name = decodeURIComponent(req.path.slice('/upload/'.length));
    } catch (e) {
      /* keep default */
    }
    name = (name || 'track').split(/[\\/]/).pop().replace(/[:*?"<>|]/g, '_');
    if (!isAudio(name)) {
      respond(socket, '400 Bad Request', 'text/plain; charset=utf-8', '不是音频文件');
      return;
    }
    const b64 = chunksToBase64(req.body);
    const dest = FileSystem.documentDirectory + name;
    FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 })
      .then(() => {
        if (onFileUploaded) {
          try {
            onFileUploaded(name);
          } catch (e) {
            /* noop */
          }
        }
        respond(socket, '200 OK', 'text/plain; charset=utf-8', 'OK');
      })
      .catch(() => {
        respond(socket, '500 Internal Server Error', 'text/plain; charset=utf-8', '写入失败');
      });
    return;
  }
  respond(socket, '404 Not Found', 'text/plain; charset=utf-8', 'Not Found');
}

function onConnection(socket) {
  let headerChunks = [];
  let req = null;
  socket.on('error', () => {});
  socket.on('data', (data) => {
    try {
      if (!req) {
        headerChunks.push(data);
        const all = Buffer.concat(headerChunks);
        const headStr = all.toString('utf8');
        const sep = headStr.indexOf('\r\n\r\n');
        if (sep < 0) return; // 头部未接收完整，继续等
        const lines = headStr.slice(0, sep).split('\r\n');
        const reqLine = lines[0].split(' ');
        let contentLength = 0;
        lines.slice(1).forEach((ln) => {
          const ci = ln.indexOf(':');
          if (ci > 0 && ln.slice(0, ci).trim().toLowerCase() === 'content-length') {
            contentLength = parseInt(ln.slice(ci + 1).trim(), 10) || 0;
          }
        });
        const bodyFirst = all.subarray(sep + 4);
        req = {
          method: reqLine[0],
          path: reqLine[1] || '/',
          contentLength,
          body: [bodyFirst],
          received: bodyFirst.length,
        };
        headerChunks = [];
        if (req.method === 'GET' || req.received >= req.contentLength) {
          handleRequest(socket, req);
        }
      } else {
        req.body.push(data);
        req.received += data.length;
        if (req.received >= req.contentLength) {
          handleRequest(socket, req);
        }
      }
    } catch (e) {
      try {
        socket.destroy();
      } catch (e2) {
        /* noop */
      }
    }
  });
}

function tryPort(p) {
  return new Promise((resolve) => {
    let settled = false;
    const srv = TcpSocket.createServer(onConnection);
    srv.on('error', () => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    });
    srv.listen({ port: p, host: '0.0.0.0' }, () => {
      if (!settled) {
        settled = true;
        resolve(srv);
      }
    });
  });
}

export async function startWifiServer() {
  if (server && port) return getAddress();
  for (const p of PORTS) {
    const srv = await tryPort(p);
    if (srv) {
      server = srv;
      port = p;
      return getAddress();
    }
  }
  throw new Error('本地服务启动失败（端口被占用）');
}

export function stopWifiServer() {
  if (server) {
    try {
      server.close();
    } catch (e) {
      /* noop */
    }
    server = null;
    port = null;
  }
}

export async function getWifiAddress() {
  return getAddress();
}

async function getAddress() {
  try {
    const st = await Network.getNetworkStateAsync();
    const ip = st && st.details && st.details.ipAddress;
    return ip ? `http://${ip}:${port}` : null;
  } catch (e) {
    return null;
  }
}

const UPLOAD_PAGE = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>云音乐 · WiFi 上传</title>
<style>
body{font-family:-apple-system,sans-serif;background:#f7f7f9;color:#1a1a1a;margin:0;padding:24px;}
h2{margin:0 0 16px;}
.card{background:#fff;border-radius:12px;padding:20px;max-width:480px;margin:0 auto;}
input{margin:8px 0 16px;width:100%;}
button{background:#ff3a3a;color:#fff;border:none;border-radius:20px;padding:10px 28px;font-size:15px;}
#log{margin-top:16px;font-size:13px;color:#555;line-height:1.9;}
</style>
</head>
<body>
<div class="card">
<h2>📶 WiFi 上传</h2>
<div>选择手机同一 WiFi 下要传的音乐文件（可多选）：</div>
<input type="file" id="files" multiple accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus">
<button onclick="up()">开始上传</button>
<div id="log"></div>
</div>
<script>
function log(m){document.getElementById('log').innerHTML+=m+'<br>';}
async function up(){
  var fs=document.getElementById('files').files;
  if(!fs.length){log('请先选择文件');return;}
  for(var i=0;i<fs.length;i++){
    var f=fs[i];
    log('上传中 '+f.name+' …');
    try{
      var r=await fetch('/upload/'+encodeURIComponent(f.name),{method:'PUT',body:f});
      log(r.ok?('✔ 完成 '+f.name):('✘ 失败 '+f.name+' ('+r.status+')'));
    }catch(e){log('✘ 失败 '+f.name+' '+e);}
  }
  log('全部完成！回到 App 音乐库即可看到（或按刷新）。');
}
</script>
</body>
</html>`;
