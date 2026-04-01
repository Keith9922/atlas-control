import fetch from 'node-fetch';
import { EventEmitter } from 'events';

// 设备信息
class Device {
  constructor(config) {
    this.id = config.name || config.host;
    this.name = config.name || config.host;
    this.host = config.host;
    this.port = config.port || 8080;
    this.status = 'offline';
    this.lastSeen = Date.now();
    this.info = null;
  }

  get url() {
    return `http://${this.host}:${this.port}`;
  }

  async request(path, method = 'GET', body = null) {
    const url = `${this.url}${path}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    try {
      const resp = await fetch(url, options);
      const data = await resp.json();
      return data;
    } catch (err) {
      throw new Error(`请求失败: ${err.message}`);
    }
  }

  async getStatus() {
    try {
      const resp = await this.request('/api/status');
      this.status = resp.success ? 'online' : 'error';
      this.lastSeen = Date.now();
      this.info = resp.data;
      return resp.data;
    } catch (err) {
      this.status = 'offline';
      return null;
    }
  }

  async getProjects() {
    return this.request('/api/projects');
  }

  async switchProject(project) {
    return this.request('/api/switch', 'POST', { project });
  }

  async deployProject(name, description, tarUrl) {
    return this.request('/api/projects/deploy', 'POST', {
      name,
      description,
      tar_url: tarUrl
    });
  }

  async startProject(name) {
    return this.request(`/api/projects/${name}/start`, 'POST');
  }

  async stopProject(name) {
    return this.request(`/api/projects/${name}/stop`, 'POST');
  }

  async setWiFi(ssid, password) {
    return this.request('/api/wifi', 'POST', { ssid, password });
  }
}

// 设备管理器
export class DeviceManager extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map();
    this.discoveryInterval = null;
  }

  // 添加设备
  addDevice(config) {
    const device = new Device(config);
    this.devices.set(device.id, device);
    this.emit('device:added', device);
    return device;
  }

  // 移除设备
  removeDevice(id) {
    const device = this.devices.get(id);
    if (device) {
      this.devices.delete(id);
      this.emit('device:removed', device);
    }
  }

  // 获取设备
  getDevice(id) {
    return this.devices.get(id);
  }

  // 获取所有设备
  getDevices() {
    return Array.from(this.devices.values()).map(d => ({
      id: d.id,
      name: d.name,
      host: d.host,
      port: d.port,
      status: d.status,
      lastSeen: d.lastSeen,
      info: d.info
    }));
  }

  // 获取设备状态
  async getDeviceStatus(id) {
    const device = this.devices.get(id);
    if (!device) throw new Error('设备不存在');
    return device.getStatus();
  }

  // 切换项目
  async switchProject(id, project) {
    const device = this.devices.get(id);
    if (!device) throw new Error('设备不存在');
    const result = await device.switchProject(project);
    this.emit('device:project-switched', { device, project });
    return result;
  }

  // 部署项目
  async deployProject(id, name, description, tarUrl) {
    const device = this.devices.get(id);
    if (!device) throw new Error('设备不存在');
    const result = await device.deployProject(name, description, tarUrl);
    this.emit('device:project-deployed', { device, name });
    return result;
  }

  // 启动项目
  async startProject(id, name) {
    const device = this.devices.get(id);
    if (!device) throw new Error('设备不存在');
    return device.startProject(name);
  }

  // 停止项目
  async stopProject(id, name) {
    const device = this.devices.get(id);
    if (!device) throw new Error('设备不存在');
    return device.stopProject(name);
  }

  // 获取项目列表
  async getProjects(id) {
    const device = this.devices.get(id);
    if (!device) throw new Error('设备不存在');
    return device.getProjects();
  }

  // 设置 WiFi
  async setWiFi(id, ssid, password) {
    const device = this.devices.get(id);
    if (!device) throw new Error('设备不存在');
    return device.setWiFi(ssid, password);
  }

  // 上传文件
  async uploadFile(id, fileData, path) {
    const device = this.devices.get(id);
    if (!device) throw new Error('设备不存在');
    // 通过 HTTP 上传
    return device.request('/api/files/upload', 'POST', { file: fileData, path });
  }

  // 启动设备发现（mDNS / 手动添加）
  startDiscovery() {
    // 尝试发现本地网络的 Atlas 设备
    this.discoverByMDNS();
    // 定期刷新状态
    this.discoveryInterval = setInterval(() => this.refreshAllStatus(), 10000);
  }

  // 停止发现
  stopDiscovery() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
  }

  // 通过 mDNS 发现设备
  async discoverByMDNS() {
    // 常见的本地网络设备发现方法
    // 1. 尝试常见的 .local 主机名
    const possibleHosts = [
      'atlas-1.local',
      'atlas-2.local',
      'atlas-3.local',
      'atlas-4.local'
    ];

    for (const host of possibleHosts) {
      try {
        const device = this.addDevice({ name: host.replace('.local', ''), host, port: 8080 });
        const status = await device.getStatus();
        if (status) {
          console.log(`发现设备: ${host}`);
          this.emit('device:discovered', device);
        }
      } catch (err) {
        // 设备不可达，忽略
      }
    }
  }

  // 刷新所有设备状态
  async refreshAllStatus() {
    const promises = Array.from(this.devices.values()).map(d => d.getStatus());
    await Promise.allSettled(promises);
    this.emit('status:refreshed', this.getDevices());
  }

  // 广播消息到所有设备
  async broadcast(action, data) {
    const results = await Promise.allSettled(
      Array.from(this.devices.values()).map(d => d.request(action, 'POST', data))
    );
    return results;
  }
}
