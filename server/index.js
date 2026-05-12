import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { DeviceManager } from './services/device.js';
import { setupWSHandler } from './services/ws.js';
import apiRouter from './routes/api.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const IS_DEV = process.env.NODE_ENV !== 'production';

// 创建 Express 应用
const app = express();
const server = createServer(app);

// 中间件
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件（生产环境）
if (!IS_DEV) {
  app.use(express.static(join(__dirname, '../web/dist')));
}

// 初始化设备管理器
const deviceManager = new DeviceManager();

// API 路由
app.use('/api', apiRouter(deviceManager));

// VNC 反向代理: /vnc/<deviceId>/* -> http://<host>:<vncPort>/*
// 包括 WebSocket /vnc/<deviceId>/websockify -> ws://<host>:<vncPort>/websockify
// 关键：用单个 proxy 实例 + 动态 router，避免多个 proxy 各自 attach upgrade listener
// 导致 WebSocket 握手被重复响应（客户端会看到两次 HTTP 101 而解析失败）。
function resolveTarget(req) {
  // 对 HTTP 请求，express app.use('/vnc/:deviceId', ...) 会把 req.url 改为 mount 后相对路径
  // （比如 /vnc.html），但保留原始 URL 在 req.originalUrl。对 WS upgrade，我们手动调
  // vncProxy.upgrade(req, ...)，req.url 是完整原始路径。两种情况都要兼容。
  const fullUrl = req.originalUrl || req.url || '';
  const m = fullUrl.match(/^\/vnc\/([^/]+)/);
  if (!m) return null;
  const dev = deviceManager.getDevice(m[1]);
  if (!dev) return null;
  return `http://${dev.host}:${dev.vncPort}`;
}

const vncProxy = createProxyMiddleware({
  target: 'http://placeholder',  // 实际 target 由 router 决定
  changeOrigin: true,
  ws: true,
  logLevel: 'warn',
  router: resolveTarget,
  pathRewrite: (path) => path.replace(/^\/vnc\/[^/]+/, ''),
  onProxyReqWs: (proxyReq, req) => {
    // 老 websockify (0.10) 不识别 permessage-deflate；浏览器会协商它导致 RSV1 错误
    proxyReq.removeHeader('sec-websocket-extensions');
  },
  onError: (err, req, res) => {
    console.error('VNC proxy error:', err.message, req.url);
    if (res && res.writeHead && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('VNC proxy error: ' + err.message);
    }
  }
});

app.use('/vnc/:deviceId', (req, res, next) => {
  if (!deviceManager.getDevice(req.params.deviceId)) {
    return res.status(404).send('Device not found');
  }
  return vncProxy(req, res, next);
});

// WebSocket 服务（手动路由 upgrade 以便和 VNC 代理共存）
const wss = new WebSocketServer({ noServer: true });
setupWSHandler(wss, deviceManager);

// 统一的 upgrade router：只一个 listener，按 path 分发
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  if (url === '/ws' || url.startsWith('/ws?')) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
    return;
  }
  if (url.startsWith('/vnc/')) {
    const m = url.match(/^\/vnc\/([^/]+)/);
    if (!m || !deviceManager.getDevice(m[1])) {
      socket.destroy();
      return;
    }
    // strip 浏览器主动协商的 deflate（盒子端 websockify 0.10 不支持）
    delete req.headers['sec-websocket-extensions'];
    vncProxy.upgrade(req, socket, head);
    return;
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 捕获未知路由，返回前端应用
app.get('*', (req, res) => {
  if (IS_DEV) {
    res.send('开发模式：请启动前端开发服务器 (cd web && npm run dev)');
  } else {
    res.sendFile(join(__dirname, '../web/dist/index.html'));
  }
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║         Atlas Control Center 已启动                ║
╠═══════════════════════════════════════════════════╣
║  本地访问:  http://localhost:${PORT}                  ║
║  WebSocket: ws://localhost:${PORT}/ws                ║
║  API 文档:  http://localhost:${PORT}/api              ║
╠═══════════════════════════════════════════════════╣
║  开发模式:  ${IS_DEV ? '✓' : '✗'}                              ║
╚═══════════════════════════════════════════════════╝
  `);

  // 启动设备发现
  deviceManager.startDiscovery();
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM，正在关闭...');
  deviceManager.stopDiscovery();
  wss.close();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

export { app, server };
