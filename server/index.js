import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DeviceManager } from './services/device.js';
import { setupWSHandler } from './services/ws.js';
import apiRouter from './routes/api.js';

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

// WebSocket 服务
const wss = new WebSocketServer({ server, path: '/ws' });
setupWSHandler(wss, deviceManager);

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
