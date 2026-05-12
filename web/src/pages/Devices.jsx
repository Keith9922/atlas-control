import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, message, Popconfirm } from 'antd';
import {
  PlusOutlined, DeleteOutlined, ReloadOutlined, DesktopOutlined, EyeOutlined,
  PoweroffOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDevices } from '../hooks/useDevices';
import { call } from '../utils/api';

export default function Devices() {
  const navigate = useNavigate();
  const { devices } = useDevices();
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const handleAdd = async (values) => {
    const r = await call('post', '/devices/add', values);
    if (r.ok) {
      message.success('已添加');
      setModalVisible(false);
      form.resetFields();
    } else {
      message.error(r.error);
    }
  };

  const handleDelete = async (id) => {
    const r = await call('delete', `/devices/${id}`);
    message[r.ok ? 'success' : 'error'](r.ok ? '已移除' : r.error);
  };

  const columns = [
    {
      title: '名称', dataIndex: 'name', key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/device/${record.id}`)}>
          <Space>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: record.status === 'online' ? '#52c41a' : '#ff4d4f' }} />
            <DesktopOutlined />
            {text}
          </Space>
        </a>
      )
    },
    { title: 'IP / Host', dataIndex: 'host', key: 'host' },
    { title: '端口', dataIndex: 'port', key: 'port', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (status) => (
        <Tag color={status === 'online' ? 'green' : 'red'}>
          {status === 'online' ? '在线' : '离线'}
        </Tag>
      )
    },
    {
      title: '当前项目', dataIndex: ['info', 'current_project'], key: 'project',
      render: (project) => project ? <Tag color="blue">{project}</Tag> : <span style={{ color: '#bbb' }}>-</span>
    },
    {
      title: 'CPU / 内存', key: 'usage', width: 140,
      render: (_, row) => {
        const info = row.info || {};
        return <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12 }}>
          {(info.cpu || 0).toFixed(0)}% / {(info.memory || 0).toFixed(0)}%
        </span>;
      }
    },
    {
      title: '操作', key: 'action', width: 240,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/device/${record.id}`)}>
            查看
          </Button>
          <Popconfirm title="重启此设备？" onConfirm={async () => {
            const r = await call('post', `/devices/${record.id}/reboot`);
            message[r.ok ? 'success' : 'error'](r.ok ? r.message : r.error);
          }}>
            <Button size="small" danger icon={<ReloadOutlined />}>重启</Button>
          </Popconfirm>
          <Popconfirm title="从列表移除此设备？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" icon={<DeleteOutlined />}>移除</Button>
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
            手动添加
          </Button>
          <span style={{ color: '#999', fontSize: 12 }}>
            mDNS 会自动发现局域网内的盒子，一般不用手动添加
          </span>
        </Space>
      </div>

      <Table columns={columns} dataSource={devices} rowKey="id" pagination={false} />

      <Modal title="手动添加设备" open={modalVisible}
        onCancel={() => setModalVisible(false)} footer={null}>
        <Form form={form} onFinish={handleAdd} layout="vertical">
          <Form.Item name="name" label="设备名称" rules={[{ required: true }]}>
            <Input placeholder="如 atlas-1" />
          </Form.Item>
          <Form.Item name="host" label="主机地址" rules={[{ required: true }]}>
            <Input placeholder="192.168.x.x 或 *.local" />
          </Form.Item>
          <Form.Item name="port" label="端口" initialValue={8080}>
            <Input type="number" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>添加</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
