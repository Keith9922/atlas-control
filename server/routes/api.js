import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

/**
 * GET /api/devices
 * 获取所有设备列表
 */
router.get('/devices', async (req, res) => {
  try {
    const devices = req.deviceManager.getDevices();
    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/devices/:id
 * 获取指定设备信息
 */
router.get('/devices/:id', async (req, res) => {
  try {
    const device = req.deviceManager.getDevice(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, error: '设备未找到' });
    }
    res.json({ success: true, data: device });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/devices/:id/status
 * 获取设备状态
 */
router.get('/devices/:id/status', async (req, res) => {
  try {
    const status = await req.deviceManager.getDeviceStatus(req.params.id);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/devices/:id/switch
 * 切换设备项目
 */
router.post('/devices/:id/switch', async (req, res) => {
  try {
    const { project } = req.body;
    if (!project) {
      return res.status(400).json({ success: false, error: '项目名称不能为空' });
    }
    await req.deviceManager.switchProject(req.params.id, project);
    res.json({ success: true, message: `已切换到项目: ${project}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/devices/:id/deploy
 * 部署项目到设备
 */
router.post('/devices/:id/deploy', async (req, res) => {
  try {
    const { name, description, tar_url } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: '项目名称不能为空' });
    }
    await req.deviceManager.deployProject(req.params.id, name, description, tar_url);
    res.json({ success: true, message: `项目 ${name} 部署成功` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/devices/:id/start
 * 启动设备上的项目
 */
router.post('/devices/:id/start', async (req, res) => {
  try {
    const { project } = req.body;
    await req.deviceManager.startProject(req.params.id, project);
    res.json({ success: true, message: `项目已启动` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/devices/:id/stop
 * 停止设备上的项目
 */
router.post('/devices/:id/stop', async (req, res) => {
  try {
    const { project } = req.body;
    await req.deviceManager.stopProject(req.params.id, project);
    res.json({ success: true, message: `项目已停止` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/devices/:id/projects
 * 获取设备上的项目列表
 */
router.get('/devices/:id/projects', async (req, res) => {
  try {
    const projects = await req.deviceManager.getProjects(req.params.id);
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/devices/:id/upload-bundle
 * 一站式上传项目压缩包：multipart (name, description?, autostart?, file)
 * 主控端用 multer 接收后用 form-data 转发到 agent /api/projects/upload
 */
router.post('/devices/:id/upload-bundle', upload.single('file'), async (req, res) => {
  try {
    const device = req.deviceManager.getDevice(req.params.id);
    if (!device) return res.status(404).json({ success: false, error: '设备不存在' });
    if (!req.file) return res.status(400).json({ success: false, error: '缺少 file 字段' });

    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: '缺少 name' });
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ success: false, error: '项目名仅允许 a-z A-Z 0-9 _ - ' });
    }

    const fd = new FormData();
    fd.append('name', name);
    if (req.body.description) fd.append('description', req.body.description);
    fd.append('autostart', req.body.autostart === 'true' || req.body.autostart === true ? 'true' : 'false');
    fd.append('file', req.file.buffer, { filename: req.file.originalname });

    const resp = await fetch(`${device.url}/api/projects/upload`, {
      method: 'POST',
      body: fd,
      headers: fd.getHeaders()
    });
    const data = await resp.json();
    res.status(resp.ok ? 200 : 500).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/devices/:id/upload
 * 上传文件到设备
 */
router.post('/devices/:id/upload', async (req, res) => {
  try {
    const { file, path } = req.body;
    await req.deviceManager.uploadFile(req.params.id, file, path);
    res.json({ success: true, message: '文件上传成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/devices/:id/wifi
 * 配置设备 WiFi
 */
router.post('/devices/:id/wifi', async (req, res) => {
  try {
    const { ssid, password } = req.body;
    await req.deviceManager.setWiFi(req.params.id, ssid, password);
    res.json({ success: true, message: 'WiFi 配置已更新' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/devices/add
 * 手动添加设备
 */
router.post('/devices/add', async (req, res) => {
  try {
    const { name, host, port } = req.body;
    if (!name || !host) {
      return res.status(400).json({ success: false, error: '设备名称和主机不能为空' });
    }
    const device = req.deviceManager.addDevice({ name, host, port: port || 8080 });
    res.json({ success: true, data: device });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/devices/:id
 * 删除设备
 */
router.delete('/devices/:id', async (req, res) => {
  try {
    req.deviceManager.removeDevice(req.params.id);
    res.json({ success: true, message: '设备已移除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= 项目操作增强 =============

router.post('/devices/:id/projects/:name/restart', async (req, res) => {
  try {
    const dev = req.deviceManager.getDevice(req.params.id);
    if (!dev) return res.status(404).json({ success: false, error: '设备不存在' });
    await req.deviceManager.withLog(req.params.id, 'project-restart', req.params.name,
      () => dev.restartProject(req.params.name));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/devices/:id/projects/:name', async (req, res) => {
  try {
    const dev = req.deviceManager.getDevice(req.params.id);
    if (!dev) return res.status(404).json({ success: false, error: '设备不存在' });
    await req.deviceManager.withLog(req.params.id, 'project-delete', req.params.name,
      () => dev.deleteProject(req.params.name));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.patch('/devices/:id/projects/:name', async (req, res) => {
  try {
    const dev = req.deviceManager.getDevice(req.params.id);
    if (!dev) return res.status(404).json({ success: false, error: '设备不存在' });
    await req.deviceManager.withLog(req.params.id, 'project-patch', req.params.name,
      () => dev.patchProject(req.params.name, req.body));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/devices/:id/projects/:name/logs', async (req, res) => {
  try {
    const dev = req.deviceManager.getDevice(req.params.id);
    if (!dev) return res.status(404).json({ success: false, error: '设备不存在' });
    const r = await dev.projectLogs(req.params.name, parseInt(req.query.lines, 10) || 200);
    res.json(r);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ============= 系统操作 =============

router.post('/devices/:id/reboot', async (req, res) => {
  try {
    const dev = req.deviceManager.getDevice(req.params.id);
    if (!dev) return res.status(404).json({ success: false, error: '设备不存在' });
    await req.deviceManager.withLog(req.params.id, 'system-reboot', '',
      () => dev.systemReboot());
    res.json({ success: true, message: '盒子将在 2 秒后重启' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/devices/:id/shutdown', async (req, res) => {
  try {
    const dev = req.deviceManager.getDevice(req.params.id);
    if (!dev) return res.status(404).json({ success: false, error: '设备不存在' });
    await req.deviceManager.withLog(req.params.id, 'system-shutdown', '',
      () => dev.systemShutdown());
    res.json({ success: true, message: '盒子将在 2 秒后关机' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/devices/:id/logs', async (req, res) => {
  try {
    const dev = req.deviceManager.getDevice(req.params.id);
    if (!dev) return res.status(404).json({ success: false, error: '设备不存在' });
    const r = await dev.systemLogs(req.query.unit || 'atlas-agent', parseInt(req.query.lines, 10) || 200);
    res.json(r);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ============= 剪贴板 =============

router.get('/devices/:id/clipboard', async (req, res) => {
  try {
    const dev = req.deviceManager.getDevice(req.params.id);
    if (!dev) return res.status(404).json({ success: false, error: '设备不存在' });
    const r = await dev.clipboardGet();
    res.json(r);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/devices/:id/clipboard', async (req, res) => {
  try {
    const dev = req.deviceManager.getDevice(req.params.id);
    if (!dev) return res.status(404).json({ success: false, error: '设备不存在' });
    await req.deviceManager.withLog(req.params.id, 'clipboard-set',
      `${(req.body.text || '').slice(0, 30)}...`,
      () => dev.clipboardSet(req.body.text || ''));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ============= 批量操作 =============

router.post('/batch/switch', async (req, res) => {
  const { project } = req.body;
  if (!project) return res.status(400).json({ success: false, error: '需要 project' });
  const results = await req.deviceManager.batchSwitchProject(project);
  res.json({ success: true, data: results });
});

router.post('/batch/restart-project', async (req, res) => {
  const results = await req.deviceManager.batchRestartProject();
  res.json({ success: true, data: results });
});

router.post('/batch/reboot', async (req, res) => {
  const results = await req.deviceManager.batchReboot();
  res.json({ success: true, data: results });
});

// ============= 操作日志 =============

router.get('/operations', (req, res) => {
  res.json({ success: true, data: req.deviceManager.getOpsLog(parseInt(req.query.limit, 10) || 100) });
});

/**
 * GET /api/projects/templates
 * 获取可用项目模板列表
 */
router.get('/projects/templates', (req, res) => {
  const templates = [
    {
      name: 'face-detection',
      description: '人脸检测与情感识别',
      port: 3001
    },
    {
      name: 'pose-estimation',
      description: '人体姿态识别',
      port: 3002
    },
    {
      name: 'style-transfer',
      description: '风格迁移艺术墙',
      port: 3003
    },
    {
      name: 'particle-wall',
      description: '粒子可视化墙',
      port: 3004
    }
  ];
  res.json({ success: true, data: templates });
});

export default function(deviceManager) {
  // 用一个包裹 router 注入 deviceManager，保证中间件在所有已注册路由之前生效
  const wrap = express.Router();
  wrap.use((req, res, next) => {
    req.deviceManager = deviceManager;
    next();
  });
  wrap.use(router);
  return wrap;
}

export { router };
