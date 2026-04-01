import express from 'express';

const router = express.Router();

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

export default function(apiRouter, deviceManager) {
  // 将 deviceManager 附加到请求对象
  apiRouter.use((req, res, next) => {
    req.deviceManager = deviceManager;
    next();
  });
  return router;
}

export { router };
