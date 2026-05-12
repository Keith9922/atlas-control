import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, message, Popconfirm, Tooltip, Grid } from 'antd';
import {
  PlusOutlined, ReloadOutlined, DesktopOutlined, EyeOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDevices } from '../hooks/useDevices';
import { call } from '../utils/api';

export default function Devices() {
  const navigate = useNavigate();
  const { devices } = useDevices();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
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

  const handleRemove = async (id) => {
    const r = await call('delete', `/devices/${id}`);
    message[r.ok ? 'success' : 'error'](r.ok ? '已从列表移除（盒子本身未受影响）' : r.error);
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
            <span style={{ fontWeight: 500 }}>{text}</span>
          </Space>
        </a>
      )
    },
    { title: 'IP 地址', dataIndex: 'host', key: 'host',
      render: (h) => <span style={{ fontFamily: 'ui-monospace,monospace' }}>{h}</span>
    },
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
      render: (project) => project ? <Tag color="blue">{project}</Tag> : <span style={{ color: '#bbb' }}>无</span>
    },
    {
      title: 'CPU / 内存', key: 'usage', width: 140, responsive: ['md'],
      render: (_, row) => {
        const info = row.info || {};
        return <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12 }}>
          {(info.cpu || 0).toFixed(0)}% / {(info.memory || 0).toFixed(0)}%
        </span>;
      }
    },
    {
      title: '操作', key: 'action', width: isMobile ? 100 : 260,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button size="small" type="primary" icon={<EyeOutlined />}
            onClick={() => navigate(`/device/${record.id}`)}>
            查看
          </Button>
          {!isMobile && (
            <>
              <Popconfirm title="重启此设备？约 30-60 秒后自动恢复" onConfirm={async () => {
                const r = await call('post', `/devices/${record.id}/reboot`);
                message[r.ok ? 'success' : 'error'](r.ok ? r.message : r.error);
              }}>
                <Tooltip title="重启盒子（系统重启，会断网 30-60 秒）">
                  <Button size="small" icon={<ReloadOutlined />} style={{ color: '#faad14', borderColor: '#faad14' }}>
                    重启
                  </Button>
                </Tooltip>
              </Popconfirm>
              <Popconfirm
                title="从列表中移除？"
                description="只是清理本地缓存，设备仍会通过 mDNS 自动重新发现"
                onConfirm={() => handleRemove(record.id)}
              >
                <Tooltip title="只从列表移除，不影响设备本身（mDNS 会再次发现）">
                  <Button size="small" icon={<CloseOutlined />}>移除</Button>
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            手动添加
          </Button>
          <span style={{ color: '#999', fontSize: 12 }}>
            主控会自动发现局域网内的盒子，一般不用手动添加
          </span>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={devices}
        rowKey="id"
        pagination={false}
        scroll={{ x: isMobile ? 480 : undefined }}
        size={isMobile ? 'small' : 'middle'}
      />

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
