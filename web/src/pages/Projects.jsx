import React, { useEffect, useState } from 'react';
import { Select, Button, Space, Card, Tag, message, Modal, Form, Input, Upload } from 'antd';
import { UploadOutlined, SwapOutlined } from '@ant-design/icons';

const API_BASE = `http://${window.location.host}/api`;

export default function Projects() {
  const [devices, setDevices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [deployForm] = Form.useForm();

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    const resp = await fetch(`${API_BASE}/devices`);
    const data = await resp.json();
    if (data.success) {
      setDevices(data.data);
    }
  };

  const fetchProjects = async (deviceId) => {
    if (!deviceId) return;
    setSelectedDevice(deviceId);
    try {
      const resp = await fetch(`${API_BASE}/devices/${deviceId}/projects`);
      const data = await resp.json();
      if (data.success) {
        setProjects(data.data || []);
      }
    } catch (err) {
      message.error('获取项目列表失败');
    }
  };

  const handleSwitch = async () => {
    if (!selectedDevice || !selectedProject) {
      message.warning('请选择设备和项目');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/devices/${selectedDevice}/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject })
      });
      const data = await resp.json();
      if (data.success) {
        message.success(`已切换到项目: ${selectedProject}`);
        fetchProjects(selectedDevice);
      } else {
        message.error(data.error);
      }
    } catch (err) {
      message.error('切换失败');
    }
    setLoading(false);
  };

  const handleDeploy = async (values) => {
    if (!selectedDevice) {
      message.warning('请先选择设备');
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/devices/${selectedDevice}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const data = await resp.json();
      if (data.success) {
        message.success('项目部署成功');
        setModalVisible(false);
        deployForm.resetFields();
        fetchProjects(selectedDevice);
      } else {
        message.error(data.error);
      }
    } catch (err) {
      message.error('部署失败');
    }
  };

  return (
    <div>
      <Card title="切换项目" style={{ marginBottom: 16 }}>
        <Space size="large">
          <div>
            <label>选择设备: </label>
            <Select
              style={{ width: 200, marginLeft: 8 }}
              placeholder="选择设备"
              onChange={fetchProjects}
            >
              {devices.map(d => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name} {d.status === 'online' ? '🟢' : '🔴'}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <label>选择项目: </label>
            <Select
              style={{ width: 200, marginLeft: 8 }}
              placeholder="选择项目"
              value={selectedProject}
              onChange={setSelectedProject}
            >
              {projects.map(p => (
                <Select.Option key={p.name} value={p.name}>
                  {p.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <Button
            type="primary"
            icon={<SwapOutlined />}
            onClick={handleSwitch}
            loading={loading}
            disabled={!selectedDevice || !selectedProject}
          >
            切换
          </Button>
        </Space>
      </Card>

      <Card
        title="部署新项目"
        extra={
          <Button
            type="dashed"
            icon={<UploadOutlined />}
            onClick={() => setModalVisible(true)}
            disabled={!selectedDevice}
          >
            上传部署
          </Button>
        }
      >
        {selectedDevice ? (
          <div>
            <p>当前设备: <Tag color="blue">{selectedDevice}</Tag></p>
            <p>可用项目: {projects.length}</p>

            <div style={{ marginTop: 16 }}>
              {projects.map(p => (
                <Card key={p.name} size="small" style={{ marginBottom: 8 }}>
                  <Space>
                    <strong>{p.name}</strong>
                    <Tag color={p.status === 'running' ? 'green' : 'default'}>
                      {p.status === 'running' ? '运行中' : '已停止'}
                    </Tag>
                    <span style={{ color: '#999' }}>{p.description}</span>
                  </Space>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ color: '#999' }}>请先选择设备</p>
        )}
      </Card>

      <Modal
        title="部署项目"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={deployForm} onFinish={handleDeploy} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input placeholder="如: face-detection" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea placeholder="项目描述" />
          </Form.Item>
          <Form.Item name="tar_url" label="压缩包URL（可选）">
            <Input placeholder="http://example.com/project.tar.gz" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              部署
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
