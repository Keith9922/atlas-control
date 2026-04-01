import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, DesktopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const API_BASE = `http://${window.location.host}/api`;

export default function Devices() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/devices`);
      const data = await resp.json();
      if (data.success) {
        setDevices(data.data);
      }
    } catch (err) {
      message.error('获取设备列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async (values) => {
    try {
      const resp = await fetch(`${API_BASE}/devices/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const data = await resp.json();
      if (data.success) {
        message.success('设备添加成功');
        setModalVisible(false);
        form.resetFields();
        fetchDevices();
      } else {
        message.error(data.error);
      }
    } catch (err) {
      message.error('添加设备失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const resp = await fetch(`${API_BASE}/devices/${id}`, { method: 'DELETE' });
      const data = await resp.json();
      if (data.success) {
        message.success('设备已移除');
        fetchDevices();
      }
    } catch (err) {
      message.error('移除设备失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <DesktopOutlined />
          {text}
        </Space>
      )
    },
    {
      title: '主机',
      dataIndex: 'host',
      key: 'host'
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'online' ? 'green' : 'red'}>
          {status === 'online' ? '在线' : '离线'}
        </Tag>
      )
    },
    {
      title: '当前项目',
      dataIndex: ['info', 'current_project'],
      key: 'project',
      render: (project) => project || '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/vnc/${record.id}`)}>
            查看
          </Button>
          <Popconfirm
            title="确定移除此设备？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              移除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            添加设备
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchDevices}>
            刷新
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={devices}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title="添加设备"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleAdd} layout="vertical">
          <Form.Item name="name" label="设备名称" rules={[{ required: true }]}>
            <Input placeholder="如: atlas-1" />
          </Form.Item>
          <Form.Item name="host" label="主机地址" rules={[{ required: true }]}>
            <Input placeholder="如: 192.168.1.100 或 atlas-1.local" />
          </Form.Item>
          <Form.Item name="port" label="端口" initialValue={8080}>
            <Input type="number" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              添加
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
