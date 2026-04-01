import { WebSocketServer } from 'ws';

// WebSocket 消息类型
const MSG_TYPES = {
  // 客户端 -> 服务端
  REGISTER: 'register',           // 注册设备
  GET_DEVICES: 'get_devices',     // 获取设备列表
  GET_STATUS: 'get_status',       // 获取状态
  SWITCH_PROJECT: 'switch_project', // 切换项目
  DEPLOY: 'deploy',               // 部署项目

  // 服务端 -> 客户端
  DEVICE_LIST: 'device_list',      // 设备列表
  DEVICE_STATUS: 'device_status', // 设备状态
  DEVICE_EVENT: 'device_event',   // 设备事件
  ERROR: 'error'                  // 错误
};

// 设备事件类型
const DEVICE_EVENTS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  PROJECT_SWITCHED: 'project_switched',
  PROJECT_DEPLOYED: 'project_deployed'
};

export function setupWSHandler(wss, deviceManager) {
  // 客户端连接
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`WebSocket 客户端连接: ${clientIp}`);

    // 标记为已连接
    ws.isAlive = true;

    // 心跳
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // 消息处理
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleMessage(ws, msg, deviceManager);
      } catch (err) {
        console.error('WebSocket 消息处理错误:', err);
        sendError(ws, '消息格式错误');
      }
    });

    // 断开连接
    ws.on('close', () => {
      console.log(`WebSocket 客户端断开: ${clientIp}`);
    });

    // 发送欢迎消息
    send(ws, { type: MSG_TYPES.DEVICE_LIST, data: deviceManager.getDevices() });
  });

  // 心跳检测
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  // 监听设备事件
  deviceManager.on('device:discovered', (device) => {
    broadcast(wss, {
      type: MSG_TYPES.DEVICE_EVENT,
      event: DEVICE_EVENTS.ONLINE,
      device: { id: device.id, name: device.name, host: device.host }
    });
  });

  deviceManager.on('status:refreshed', (devices) => {
    broadcast(wss, {
      type: MSG_TYPES.DEVICE_STATUS,
      devices
    });
  });

  deviceManager.on('device:project-switched', ({ device, project }) => {
    broadcast(wss, {
      type: MSG_TYPES.DEVICE_EVENT,
      event: DEVICE_EVENTS.PROJECT_SWITCHED,
      device: device.id,
      project
    });
  });
}

// 消息处理
async function handleMessage(ws, msg, deviceManager) {
  const { type, ...payload } = msg;

  switch (type) {
    case MSG_TYPES.REGISTER:
      // 客户端注册
      send(ws, { type: MSG_TYPES.DEVICE_LIST, data: deviceManager.getDevices() });
      break;

    case MSG_TYPES.GET_DEVICES:
      send(ws, { type: MSG_TYPES.DEVICE_LIST, data: deviceManager.getDevices() });
      break;

    case MSG_TYPES.GET_STATUS:
      if (payload.deviceId) {
        const status = await deviceManager.getDeviceStatus(payload.deviceId);
        send(ws, { type: MSG_TYPES.DEVICE_STATUS, device: payload.deviceId, status });
      } else {
        // 获取所有设备状态
        const statuses = {};
        for (const device of deviceManager.devices.values()) {
          statuses[device.id] = await device.getStatus().catch(() => null);
        }
        send(ws, { type: MSG_TYPES.DEVICE_STATUS, devices: statuses });
      }
      break;

    case MSG_TYPES.SWITCH_PROJECT:
      try {
        await deviceManager.switchProject(payload.deviceId, payload.project);
        send(ws, {
          type: MSG_TYPES.DEVICE_EVENT,
          event: DEVICE_EVENTS.PROJECT_SWITCHED,
          device: payload.deviceId,
          project: payload.project
        });
      } catch (err) {
        sendError(ws, err.message);
      }
      break;

    case MSG_TYPES.DEPLOY:
      try {
        await deviceManager.deployProject(payload.deviceId, payload.name, payload.description, payload.tarUrl);
        send(ws, {
          type: MSG_TYPES.DEVICE_EVENT,
          event: DEVICE_EVENTS.PROJECT_DEPLOYED,
          device: payload.deviceId,
          name: payload.name
        });
      } catch (err) {
        sendError(ws, err.message);
      }
      break;

    default:
      sendError(ws, `未知消息类型: ${type}`);
  }
}

// 发送消息
function send(ws, data) {
  if (ws.readyState === 1) { // OPEN
    ws.send(JSON.stringify(data));
  }
}

// 发送错误
function sendError(ws, message) {
  send(ws, { type: MSG_TYPES.ERROR, message });
}

// 广播到所有客户端
function broadcast(wss, data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}
