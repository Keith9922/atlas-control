# Atlas Control Center

Atlas 展示控制系统的主控端，浏览器即可控制所有 Atlas 盒子。

## 功能特性

- 设备自动发现（mDNS）
- 实时状态监控
- 远程屏幕查看（noVNC）
- 远程控制操作
- 项目上传/部署/切换
- 批量操作
- 跨平台支持（Mac/Win/Linux）

## 系统要求

- Node.js 18+
- 现代浏览器（Chrome/Firefox/Safari/Edge）

## 快速启动

### Mac / Linux

```bash
git clone https://github.com/your-org/atlas-control.git
cd atlas-control
npm install
npm run dev
```

### Windows

```powershell
git clone https://github.com/your-org/atlas-control.git
cd atlas-control
npm install
npm run dev
```

然后打开浏览器访问 http://localhost:3000

## 生产环境部署

```bash
npm install
npm run build
npm start
# 访问 http://localhost:3000
```

## 使用 Docker 运行

```bash
docker build -t atlas-control .
docker run -d -p 3000:3000 atlas-control
```

## 主要功能

### 设备管理
- 自动发现局域网内的 Atlas 盒子
- 手动添加设备（IP/主机名）
- 设备分组管理

### 远程查看
- 实时屏幕查看（noVNC）
- 支持全屏模式
- 画面缩放

### 远程控制
- 鼠标/键盘操作
- 复制粘贴支持
- 组合键支持

### 项目管理
- 上传项目压缩包
- 部署到指定设备
- 一键切换项目
- 项目列表管理

### 系统监控
- CPU/内存使用率
- 芯片温度
- 运行时间
- 当前项目状态

## API 接口

控制中心同时也提供 REST API：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/devices | 获取设备列表 |
| GET | /api/devices/:id/status | 获取设备状态 |
| POST | /api/devices/:id/switch | 切换项目 |
| POST | /api/devices/:id/deploy | 部署项目 |
| GET | /ws | WebSocket 服务 |

## 项目结构

```
atlas-control/
├── server/
│   ├── index.js           # 服务入口
│   ├── routes/
│   │   └── api.js         # REST API
│   ├── services/
│   │   ├── device.js      # 设备管理
│   │   └── ws.js          # WebSocket 服务
│   └── utils/
│       └── mdns.js        # mDNS 发现
├── web/
│   ├── src/
│   │   ├── App.jsx        # 主组件
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    # 仪表盘
│   │   │   ├── Devices.jsx      # 设备列表
│   │   │   └── VNCViewer.jsx    # VNC 查看器
│   │   ├── components/
│   │   │   ├── DeviceCard.jsx   # 设备卡片
│   │   │   └── StatusBadge.jsx  # 状态徽章
│   │   └── hooks/
│   │       └── useDevice.js      # 设备 hook
│   └── package.json
├── scripts/
│   └── start.sh           # 启动脚本
├── Dockerfile
└── package.json
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 运行测试
npm test

# 代码检查
npm run lint
```

## 许可证

MIT
