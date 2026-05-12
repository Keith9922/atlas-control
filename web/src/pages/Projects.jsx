import React, { useEffect, useState } from 'react';
import {
  Select, Button, Space, Card, Tag, message, Form, Input, Upload, Checkbox,
  Progress, Alert, Divider, Table, Popconfirm, Modal
} from 'antd';
import {
  UploadOutlined, RocketOutlined, InboxOutlined, SwapOutlined,
  PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined, FileTextOutlined,
  ReloadOutlined, ApiOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useDevices } from '../hooks/useDevices';
import { call } from '../utils/api';

const { Dragger } = Upload;

export default function Projects() {
  const { devices } = useDevices();
  const [matrix, setMatrix] = useState({});  // { deviceId: [project, ...] }
  const [batchTarget, setBatchTarget] = useState('all');  // 'all' 或 single device id

  // 快捷部署相关
  const [file, setFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [autostart, setAutostart] = useState(true);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [logModal, setLogModal] = useState(null); // { deviceId, name }

  // 拉每台设备的项目列表
  const loadMatrix = async () => {
    const next = {};
    await Promise.all(devices.map(async (d) => {
      const r = await call('get', `/devices/${d.id}/projects`);
      next[d.id] = r.ok ? (Array.isArray(r.data) ? r.data : []) : [];
    }));
    setMatrix(next);
  };

  useEffect(() => {
    if (devices.length) loadMatrix();
  }, [devices.length]);

  // 项目操作（针对单个设备）
  const op = async (deviceId, action, projectName, refresh = true) => {
    let r;
    switch (action) {
      case 'switch':  r = await call('post', `/devices/${deviceId}/switch`, { project: projectName }); break;
      case 'start':   r = await call('post', `/devices/${deviceId}/start`, { project: projectName }); break;
      case 'stop':    r = await call('post', `/devices/${deviceId}/stop`, { project: projectName }); break;
      case 'restart': r = await call('post', `/devices/${deviceId}/projects/${projectName}/restart`); break;
      case 'delete':  r = await call('delete', `/devices/${deviceId}/projects/${projectName}`); break;
      default: return;
    }
    message[r.ok ? 'success' : 'error'](r.ok ? `${action} ok` : r.error);
    if (refresh) loadMatrix();
  };

  // 快捷部署
  const handleQuickDeploy = async () => {
    if (!file) return message.warning('选个压缩包');
    if (!uploadName.trim()) return message.warning('填项目名');
    if (!/^[a-zA-Z0-9_-]+$/.test(uploadName.trim())) {
      return message.warning('项目名仅允许 a-z A-Z 0-9 _ -');
    }

    const targets = batchTarget === 'all' ? devices.map(d => d.id) : [batchTarget];
    if (targets.length === 0) return message.warning('没有目标设备');

    setUploading(true);
    setUploadPercent(0);
    let okCount = 0, failCount = 0;

    for (const did of targets) {
      const fd = new FormData();
      fd.append('name', uploadName.trim());
      if (uploadDesc.trim()) fd.append('description', uploadDesc.trim());
      fd.append('autostart', autostart ? 'true' : 'false');
      fd.append('file', file);

      try {
        const resp = await axios.post(`/api/devices/${did}/upload-bundle`, fd, {
          onUploadProgress: (e) => e.total && setUploadPercent(Math.round((e.loaded / e.total) * 100)),
          timeout: 5 * 60 * 1000
        });
        if (resp.data.success) okCount++; else failCount++;
      } catch { failCount++; }
    }

    message[failCount === 0 ? 'success' : 'warning'](
      `部署完成: ${okCount} 成功, ${failCount} 失败 / 共 ${targets.length} 台`
    );
    setUploading(false);
    setFile(null); setUploadName(''); setUploadDesc('');
    loadMatrix();
  };

  // 表格列
  const columns = [
    { title: '设备', dataIndex: 'deviceId', key: 'deviceId', width: 160,
      render: (id) => <Space>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: devices.find(d => d.id === id)?.status === 'online' ? '#52c41a' : '#ff4d4f' }} />
        {id}
      </Space>
    },
    { title: '项目', dataIndex: 'name', key: 'name',
      render: (name, row) => <Space>
        <strong>{name}</strong>
        <Tag color={row.status === 'running' ? 'green' : 'default'}>
          {row.status === 'running' ? '运行中' : '已停止'}
        </Tag>
        {row.isCurrent && <Tag color="blue">当前</Tag>}
      </Space>
    },
    { title: '描述', dataIndex: 'description', key: 'description',
      render: (d) => d || <span style={{ color: '#bbb' }}>-</span>
    },
    { title: '操作', key: 'action', width: 360,
      render: (_, row) => (
        <Space size="small" wrap>
          <Button size="small" type="primary" icon={<SwapOutlined />}
            onClick={() => op(row.deviceId, 'switch', row.name)}
            disabled={row.isCurrent && row.status === 'running'}>切换</Button>
          {row.status === 'running' ? (
            <Button size="small" icon={<PauseCircleOutlined />}
              onClick={() => op(row.deviceId, 'stop', row.name)}>停止</Button>
          ) : (
            <Button size="small" icon={<PlayCircleOutlined />}
              onClick={() => op(row.deviceId, 'start', row.name)}>启动</Button>
          )}
          <Button size="small" onClick={() => op(row.deviceId, 'restart', row.name)}>重启</Button>
          <Button size="small" icon={<FileTextOutlined />}
            onClick={() => setLogModal({ deviceId: row.deviceId, name: row.name })}>日志</Button>
          <Popconfirm title={`删除 ${row.name}？`}
            onConfirm={() => op(row.deviceId, 'delete', row.name)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 把 matrix 平铺成行
  const rows = devices.flatMap(d => {
    const list = matrix[d.id] || [];
    return list.map(p => ({
      key: `${d.id}/${p.name}`,
      deviceId: d.id,
      name: p.name,
      status: p.status,
      description: p.description,
      isCurrent: d.info?.current_project === p.name
    }));
  });

  return (
    <div>
      <Card title="项目矩阵" style={{ marginBottom: 16 }}
        extra={<Button icon={<ReloadOutlined />} onClick={loadMatrix}>刷新</Button>}
      >
        <Table
          columns={columns}
          dataSource={rows}
          size="small"
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          scroll={{ x: 720 }}
          locale={{ emptyText: '没有任何项目 — 用下面的"快捷部署"上传一个' }}
        />
      </Card>

      {/* 快捷部署 */}
      <Card title={<><RocketOutlined /> 快捷部署</>}
        extra={<span style={{ color: '#999', fontSize: 12 }}>支持一次部署到所有设备</span>}
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="打包约定"
          description={<div style={{ fontSize: 13, lineHeight: 1.7 }}>
            压缩包根目录或顶层目录里需要有 <code>start.sh</code> 启动脚本。
            例：<code>tar czf my-demo.tar.gz my-demo/</code>（自动识别顶层同名目录）<br />
            start.sh 示例：<code>{'#!/bin/bash'}<br />{'exec ./my-app --fullscreen'}</code>
          </div>}
        />

        <Form layout="vertical">
          <Form.Item label="部署到">
            <Select value={batchTarget} onChange={setBatchTarget} style={{ width: '100%', maxWidth: 320 }}>
              <Select.Option value="all">📡 所有设备 ({devices.length} 台)</Select.Option>
              {devices.map(d => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name} ({d.status === 'online' ? '🟢' : '🔴'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="项目压缩包" required>
            <Dragger
              accept=".tar.gz,.tgz,.zip"
              maxCount={1}
              fileList={file ? [file] : []}
              beforeUpload={(f) => {
                const lname = f.name.toLowerCase();
                if (!lname.match(/\.(tar\.gz|tgz|zip)$/)) {
                  message.error('只支持 .tar.gz / .tgz / .zip');
                  return Upload.LIST_IGNORE;
                }
                if (f.size > 100 * 1024 * 1024) {
                  message.error('文件超过 100MB');
                  return Upload.LIST_IGNORE;
                }
                setFile(f);
                if (!uploadName) {
                  setUploadName(f.name.replace(/\.(tar\.gz|tgz|zip)$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-'));
                }
                return false;
              }}
              onRemove={() => { setFile(null); return true; }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p>点击或拖放 .tar.gz / .zip（≤ 100MB）</p>
            </Dragger>
          </Form.Item>

          <Form.Item label="项目名称" required>
            <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)}
              placeholder="例: face-detection；仅 a-z A-Z 0-9 _ -" maxLength={64} />
          </Form.Item>

          <Form.Item label="项目描述（可选）">
            <Input.TextArea rows={2} value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} />
          </Form.Item>

          <Form.Item>
            <Checkbox checked={autostart} onChange={(e) => setAutostart(e.target.checked)}>
              部署后立即启动并设为当前项目（断电恢复也会跑这个）
            </Checkbox>
          </Form.Item>

          {uploading && (
            <Form.Item>
              <Progress percent={uploadPercent} status={uploadPercent === 100 ? 'success' : 'active'} />
            </Form.Item>
          )}

          <Divider style={{ margin: '12px 0' }} />

          <Button type="primary" size="large" icon={<RocketOutlined />}
            loading={uploading} onClick={handleQuickDeploy}
            disabled={!file || !uploadName.trim()} block>
            {batchTarget === 'all'
              ? `部署到所有 ${devices.length} 台`
              : `部署到 ${batchTarget}`}
          </Button>
        </Form>
      </Card>

      <Modal
        title={`项目日志: ${logModal?.deviceId}/${logModal?.name}`}
        open={!!logModal}
        onCancel={() => setLogModal(null)}
        footer={null}
        width={900}
      >
        {logModal && <ProjectLogViewer deviceId={logModal.deviceId} name={logModal.name} />}
      </Modal>
    </div>
  );
}

function ProjectLogViewer({ deviceId, name }) {
  const [content, setContent] = useState('加载中…');
  useEffect(() => {
    call('get', `/devices/${deviceId}/projects/${name}/logs?lines=300`)
      .then(r => setContent(r.ok ? (typeof r.data === 'string' ? r.data : '(无日志)') : `读取失败: ${r.error}`));
  }, [deviceId, name]);
  return (
    <pre style={{
      background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 4,
      fontSize: 12, maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap'
    }}>{content}</pre>
  );
}
