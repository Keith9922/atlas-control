import React from 'react';
import { Card, Table, Tag, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useDevices } from '../hooks/useDevices';

export default function Operations() {
  const { opsLog } = useDevices();

  const columns = [
    {
      title: '时间', dataIndex: 'ts', key: 'ts',
      width: 180,
      render: (ts) => new Date(ts).toLocaleString()
    },
    { title: '设备', dataIndex: 'deviceId', key: 'deviceId', width: 160 },
    { title: '操作', dataIndex: 'action', key: 'action', width: 180,
      render: (a) => <Tag>{a}</Tag>
    },
    { title: '详情', dataIndex: 'detail', key: 'detail',
      render: (d) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{d || '-'}</span>
    },
    { title: '结果', dataIndex: 'ok', key: 'ok', width: 80,
      render: (ok) => ok ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>
    }
  ];

  return (
    <Card title="操作历史"
      extra={<Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>刷新</Button>}
    >
      <div style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>
        所有写操作（切换项目、重启盒子、删除项目、剪贴板写入等）都会记录在这里。仅在内存中保留最近 500 条；主控重启后清空。
      </div>
      <Table
        rowKey={(r) => `${r.ts}-${r.deviceId}-${r.action}`}
        columns={columns}
        dataSource={opsLog}
        size="small"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: '暂无操作记录' }}
      />
    </Card>
  );
}
