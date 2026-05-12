# Atlas Control Center

Atlas 盒子集群的 **Web 总控中心**。浏览器即开即用：
- 自动发现局域网内所有 Atlas 盒子（mDNS）
- 一站式监控（CPU / 内存 / 项目 / VNC 缩略图）
- 实时趋势图（CPU/内存 60 点滚动）
- 批量操作（一键切项目 / 重启项目 / 重启盒子）
- 设备级操作（关机 / 重启 / 重启项目 / 看日志）
- 项目矩阵（4 盒子 × N 项目，行内启停/重启/删除/看日志）
- 快捷部署（拖一个 .tar.gz/.zip 一键推到所有盒子）
- 剪贴板桥接（双向同步浏览器 ↔ 盒子 X 剪贴板）
- 操作历史（所有写操作记录在内存）

配合 [atlas-agent](https://github.com/Keith9922/atlas-agent) 一起用。

## 推荐部署方式：**装到一台 Atlas 盒子上**

我们用其中一台（比如 `davinci-mini`, IP 设为静态 `192.168.1.50`）当主控。盒子本来就 7×24 开机，零额外硬件成本。

### 一键部署到 Atlas 盒子（推荐）

```bash
# 在开发机上（已 npm run build）打包
cd atlas-control
bash scripts/deploy-to-box.sh root@<box-ip>
# 或者手动：
tar -czf /tmp/atlas-control.tar.gz \
  --exclude=node_modules --exclude=web/node_modules --exclude=.git \
  atlas-control/
scp /tmp/atlas-control.tar.gz <user>@<box-ip>:/tmp/
ssh <user>@<box-ip>
# 详细步骤见下面 "盒子端首次安装"
```

### 盒子端首次安装

盒子上默认 Node 12 太旧，先装 Node 20（不用 apt，避免冲突）：

```bash
sudo bash -c '
  curl -fsSL https://nodejs.org/dist/v20.18.1/node-v20.18.1-linux-arm64.tar.xz -o /tmp/node.tar.xz
  mkdir -p /opt/node20
  tar -xJf /tmp/node.tar.xz -C /opt/node20 --strip-components=1
  ln -sf /opt/node20/bin/node /usr/local/bin/node
  ln -sf /opt/node20/bin/npm  /usr/local/bin/npm
'
```

部署主控代码：

```bash
sudo bash -c '
  set -e
  mkdir -p /opt/atlas-control
  tar -xzf /tmp/atlas-control.tar.gz -C /opt --strip-components=1
  # 上一步可能把内容散到 /opt/，按需 mv 到 /opt/atlas-control/
  cd /opt/atlas-control
  /opt/node20/bin/npm install --omit=dev --no-audit --no-fund
  # 创建 systemd unit
  cat > /etc/systemd/system/atlas-control.service <<EOF
[Unit]
Description=Atlas Control Center
After=network.target NetworkManager-wait-online.service avahi-daemon.service
Wants=network.target avahi-daemon.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/atlas-control
Environment="PORT=3000"
Environment="NODE_ENV=production"
ExecStart=/opt/node20/bin/node server/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536
MemoryMax=512M

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable atlas-control
  systemctl start atlas-control
'
```

### 用户端访问

任何人连上同一个 WiFi，浏览器打开：

```
http://192.168.1.50:3000
```

或者（Mac/iOS/Win10+ 支持 mDNS）：

```
http://davinci-mini.local:3000
```

不需要装任何客户端软件。

## 本地开发

```bash
git clone https://github.com/Keith9922/atlas-control.git
cd atlas-control

# 装后端依赖
npm install

# 装前端依赖 + 构建
cd web && npm install && npm run build && cd ..

# 启动
PORT=3000 npm start
# → http://localhost:3000
```

dev 模式（前端 vite hot reload）：

```bash
# 终端 1: 后端
npm run dev
# 终端 2: 前端
cd web && npm run dev   # → http://localhost:5173, 通过 vite proxy 转发 /api 和 /ws 到 3000
```

## 架构

```
浏览器 (任意局域网内设备)
   │ HTTP / WebSocket
   ▼
┌─────────────────────────────────────────────┐
│  atlas-control (Node.js + Express)         │
│  ├─ /api/devices      设备列表（mDNS 实时）│
│  ├─ /api/devices/:id/*  转发给 agent       │
│  ├─ /api/batch/*      批量操作             │
│  ├─ /api/operations   操作历史             │
│  ├─ /ws               WebSocket 推送状态   │
│  ├─ /vnc/:id/*        VNC 反向代理         │
│  └─ /                 静态 React UI        │
│                                            │
│  bonjour-service 订阅 _atlas._tcp 自动发现 │
└─────────────────────────────────────────────┘
   │                  ↑ mDNS 服务广播
   ▼ HTTP
┌──────────────────────────────────────────┐
│  atlas-agent (Go, 每台 Atlas 盒子上跑)   │
│  ├─ /api/status                          │
│  ├─ /api/projects/*                      │
│  ├─ /api/system/*                        │
│  ├─ /api/clipboard                       │
│  └─ /api/projects/upload (multipart)     │
└──────────────────────────────────────────┘
   ↓ systemctl
   atlas-display@<name>.service
   ↓ X11 (DISPLAY=:0)
   HDMI 物理输出
```

## 主要页面

| 路径 | 说明 |
|---|---|
| `/` | 仪表盘（设备卡片 + 实时趋势 + 批量工具栏 + VNC 缩略图） |
| `/devices` | 设备列表（手动添加 / 重启 / 移除）|
| `/device/:id` | 设备详情（VNC 大屏 + 概览 + 项目控制 + 剪贴板 + 日志）|
| `/projects` | 项目矩阵（所有盒子 × 所有项目）+ 快捷部署 |
| `/operations` | 操作历史 |

## REST API

### 设备发现 / 状态

| Method | Path | 说明 |
|---|---|---|
| GET | /api/devices | 列出当前所有发现到的设备 |
| GET | /api/devices/:id | 单个设备信息 |
| GET | /api/devices/:id/status | 实时拉一次状态 |
| POST | /api/devices/add | 手动添加（一般不用，mDNS 自动）|
| DELETE | /api/devices/:id | 从列表移除 |

### 项目操作（forward 给 agent）

| Method | Path |
|---|---|
| GET | /api/devices/:id/projects |
| POST | /api/devices/:id/switch |
| POST | /api/devices/:id/start \| stop |
| POST | /api/devices/:id/projects/:name/restart |
| DELETE | /api/devices/:id/projects/:name |
| PATCH | /api/devices/:id/projects/:name |
| GET | /api/devices/:id/projects/:name/logs |
| POST | /api/devices/:id/upload-bundle |

### 系统 / 剪贴板

| Method | Path |
|---|---|
| POST | /api/devices/:id/reboot |
| POST | /api/devices/:id/shutdown |
| GET | /api/devices/:id/logs?unit=&lines= |
| GET / POST | /api/devices/:id/clipboard |

### 批量

| Method | Path |
|---|---|
| POST | /api/batch/switch (body: `{project}`) |
| POST | /api/batch/restart-project |
| POST | /api/batch/reboot |

### 操作历史

| Method | Path |
|---|---|
| GET | /api/operations?limit=N |

## WebSocket

`ws://<host>/ws`：

- → 客户端发 `{type: 'get_devices'}` 拉一次设备列表
- ← 服务端推 `device_list`（设备 add/remove 时）
- ← 服务端推 `device_status`（每 2s 状态刷新）
- ← 服务端推 `device_event`（设备 online/offline/project_switched）
- ← 服务端推 `op_logged`（每次写操作）

## 排查

| 问题 | 看哪 |
|---|---|
| 主控页面打不开 | `ssh root@<box>` + `systemctl status atlas-control` + `journalctl -u atlas-control -n 50` |
| 仪表盘看不到设备 | 看 atlas-control 日志有没有 "mDNS 发现设备" 行；如果没有，盒子端 avahi 可能挂了 |
| VNC "无法连线" | 浏览器硬刷新（旧 JS 缓存）；如果仍失败，看盒子端 `systemctl status atlas-vnc atlas-novnc` |
| 项目切换后没画面 | 盒子 X cookie 可能失效（hostname 改过）；重启 SDDM 或 reboot 盒子 |

## 依赖

后端：`express`, `ws`, `bonjour-service`, `http-proxy-middleware`, `multer`, `form-data`, `node-fetch`

前端：React 18, Ant Design 5, React Router 6, axios, Vite

## License

MIT
