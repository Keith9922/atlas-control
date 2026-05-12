import fetch from 'node-fetch';
import { EventEmitter } from 'events';
import { Bonjour } from 'bonjour-service';
import { lookup as dnsLookup } from 'dns/promises';

const isIPv4 = (s) => /^\d+\.\d+\.\d+\.\d+$/.test(s || '');

// 设备信息
class Device {
  constructor(config) {
    this.id = config.name || config.host;
    this.name = config.name || config.host;
    this.host = config.host;
    this.port = config.port || 8080;
    this.vncPort = config.vncPort || 6080;
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
      // 如果当前 host 仍是 .local 主机名（bonjour 没给 IP），主动解析一次回填
      // 这样 host 最终稳定为 IP，对 IP 漂移和 Bonjour 后缀漂移都免疫
      if (!isIPv4(this.host) && this.host.endsWith('.local')) {
        try {
          const { address } = await dnsLookup(this.host, { family: 4 });
          if (isIPv4(address) && address !== this.host) {
            this.host = address;
          }
        } catch (_) { /* mDNS 解析失败：忽略，继续用 .local */ }
      }
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

  // --- 新增 (project ops 增强) ---
  async restartProject(name) {
    return this.request(`/api/projects/${encodeURIComponent(name)}/restart`, 'POST');
  }
  async deleteProject(name) {
    return this.request(`/api/projects/${encodeURIComponent(name)}`, 'DELETE');
  }
  async patchProject(name, patch) {
    return this.request(`/api/projects/${encodeURIComponent(name)}`, 'PATCH', patch);
  }
  async projectLogs(name, lines = 200) {
    return this.request(`/api/projects/${encodeURIComponent(name)}/logs?lines=${lines}`);
  }

  // --- system ops ---
  async systemReboot() {
    return this.request('/api/system/reboot', 'POST');
  }
  async systemShutdown() {
    return this.request('/api/system/shutdown', 'POST');
  }
  async systemLogs(unit = 'atlas-agent', lines = 200) {
    return this.request(`/api/system/logs?unit=${encodeURIComponent(unit)}&lines=${lines}`);
  }

  // --- clipboard ---
  async clipboardGet() {
    return this.request('/api/clipboard');
  }
  async clipboardSet(text) {
    return this.request('/api/clipboard', 'POST', { text });
  }
}

// 设备管理器
export class DeviceManager extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map();
    this.discoveryInterval = null;
    this.opsLog = []; // 操作历史，内存中保留最近 500 条
  }

  // 记录一次操作
  logOp(deviceId, action, detail, ok = true) {
    const entry = {
      ts: Date.now(),
      deviceId,
      action,
      detail: detail || '',
      ok
    };
    this.opsLog.unshift(entry);
    if (this.opsLog.length > 500) this.opsLog.length = 500;
    this.emit('op:logged', entry);
    return entry;
  }

  getOpsLog(limit = 100) {
    return this.opsLog.slice(0, limit);
  }

  // 包装的设备方法：自动记 ops
  async withLog(deviceId, action, detail, fn) {
    try {
      const ret = await fn();
      this.logOp(deviceId, action, detail, true);
      return ret;
    } catch (err) {
      this.logOp(deviceId, action, `${detail} - ${err.message}`, false);
      throw err;
    }
  }

  // 批量操作（一键全部 X）
  async batchSwitchProject(project) {
    const results = [];
    for (const dev of this.devices.values()) {
      try {
        await dev.switchProject(project);
        this.logOp(dev.id, 'batch-switch', `to ${project}`, true);
        results.push({ id: dev.id, ok: true });
      } catch (err) {
        this.logOp(dev.id, 'batch-switch', `to ${project} - ${err.message}`, false);
        results.push({ id: dev.id, ok: false, error: err.message });
      }
    }
    return results;
  }

  async batchRestartProject() {
    const results = [];
    for (const dev of this.devices.values()) {
      const current = dev.info?.current_project;
      if (!current) {
        results.push({ id: dev.id, ok: false, error: 'no current project' });
        continue;
      }
      try {
        await dev.restartProject(current);
        this.logOp(dev.id, 'batch-restart-project', current, true);
        results.push({ id: dev.id, ok: true });
      } catch (err) {
        this.logOp(dev.id, 'batch-restart-project', `${current} - ${err.message}`, false);
        results.push({ id: dev.id, ok: false, error: err.message });
      }
    }
    return results;
  }

  async batchReboot() {
    const results = [];
    for (const dev of this.devices.values()) {
      try {
        await dev.systemReboot();
        this.logOp(dev.id, 'batch-reboot', '', true);
        results.push({ id: dev.id, ok: true });
      } catch (err) {
        this.logOp(dev.id, 'batch-reboot', err.message, false);
        results.push({ id: dev.id, ok: false, error: err.message });
      }
    }
    return results;
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
      vncPort: d.vncPort,
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

  // 启动设备发现：监听 mDNS _atlas._tcp 服务
  startDiscovery() {
    this.bonjour = new Bonjour();
    this.browser = this.bonjour.find({ type: 'atlas' });

    this.browser.on('up', (svc) => this.onMDNSUp(svc));
    this.browser.on('down', (svc) => this.onMDNSDown(svc));

    // 定期刷新状态（仅状态字段，发现交给 mDNS）。
    // 2 秒一次让前端实时趋势图能滚动；服务端开销很小（每个 device 一次 fetch /api/status）。
    this.discoveryInterval = setInterval(() => this.refreshAllStatus(), 2000);
  }

  // 停止发现
  stopDiscovery() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }
    if (this.bonjour) {
      this.bonjour.destroy();
      this.bonjour = null;
    }
  }

  // mDNS 上线
  onMDNSUp(svc) {
    // bonjour-service: svc.host 是 hostname (.local), svc.port, svc.txt, svc.addresses
    const txt = svc.txt || {};
    const id = txt.device || svc.name || svc.host;
    // 优先用 IP 地址（避免主机名冲突时 Bonjour 给出的临时 -2/-3 后缀漂移）
    const addresses = Array.isArray(svc.addresses) ? svc.addresses : [];
    const ipv4 = addresses.find(a => /^\d+\.\d+\.\d+\.\d+$/.test(a));
    const host = ipv4 || svc.host || (id + '.local');
    const port = svc.port || 8080;
    const vncPort = parseInt(txt.vnc, 10) || 6080;

    if (this.devices.has(id)) {
      const existing = this.devices.get(id);
      existing.host = host;
      existing.port = port;
      existing.vncPort = vncPort;
    } else {
      console.log(`mDNS 发现设备: ${id} @ ${host}:${port}${ipv4 ? '' : ' (using hostname fallback)'}`);
      this.addDevice({ name: id, host, port, vncPort });
    }
    // 立刻取一次状态
    const dev = this.devices.get(id);
    if (dev) dev.getStatus().catch(() => {});
  }

  // mDNS 下线
  onMDNSDown(svc) {
    const id = (svc.txt && svc.txt.device) || svc.name || svc.host;
    if (this.devices.has(id)) {
      console.log(`mDNS 设备下线: ${id}`);
      this.removeDevice(id);
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
