import React from 'react';
import { Card, Table, Tag, Button, Grid } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useDevices } from '../hooks/useDevices';

// 操作名称翻译字典
const ACTION_LABELS = {
  'project-restart':       { label: '重启项目', color: 'blue' },
  'project-delete':        { label: '删除项目', color: 'red' },
  'project-patch':         { label: '编辑项目', color: 'blue' },
  'project-start':         { label: '启动项目', color: 'green' },
  'project-stop':          { label: '停止项目', color: 'orange' },
  'system-reboot':         { label: '重启盒子', color: 'red' },
  'system-shutdown':       { label: '关机', color: 'red' },
  'clipboard-set':         { label: '写入剪贴板', color: 'purple' },
  'batch-switch':          { label: '批量切项目', color: 'cyan' },
  'batch-restart-project': { label: '批量重启项目', color: 'cyan' },
  'batch-reboot':          { label: '批量重启盒子', color: 'volcano' },
};

function actionDisplay(action) {
  return ACTION_LABELS[action] || { label: action, color: 'default' };
}

export default function Operations() {
  const { opsLog } = useDevices();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const columns = [
    {
      title: '时间', dataIndex: 'ts', key: 'ts',
      width: isMobile ? 90 : 180,
      render: (ts) => isMobile
        ? new Date(ts).toLocaleTimeString()
        : new Date(ts).toLocaleString()
    },
    { title: '设备', dataIndex: 'deviceId', key: 'deviceId', width: isMobile ? 100 : 160 },
    {
      title: '操作', dataIndex: 'action', key: 'action', width: 140,
      render: (a) => {
        const d = actionDisplay(a);
        return <Tag color={d.color}>{d.label}</Tag>;
      }
    },
    {
      title: '详情', dataIndex: 'detail', key: 'detail',
      responsive: ['md'],
      render: (d) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{d || '-'}</span>
    },
    {
      title: '结果', dataIndex: 'ok', key: 'ok', width: 70,
      render: (ok) => ok ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>
    }
  ];

  return (
    <Card
      title="操作历史"
      extra={<Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>刷新</Button>}
    >
      <div style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>
        所有写操作（切换项目、重启盒子、删除项目、写入剪贴板等）都记录在这里。
        在内存中保留最近 500 条；主控重启后清空。
      </div>
      <Table
        rowKey={(r) => `${r.ts}-${r.deviceId}-${r.action}`}
        columns={columns}
        dataSource={opsLog}
        size="small"
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        scroll={{ x: isMobile ? 380 : undefined }}
        locale={{ emptyText: '还没有操作记录' }}
      />
    </Card>
  );
}
