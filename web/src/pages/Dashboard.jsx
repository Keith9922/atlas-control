import React, { useEffect, useState, useRef } from 'react';
import {
  Row, Col, Card, Statistic, Button, Space, Tag, Dropdown, Modal, Select,
  Switch, message, Tooltip, Popconfirm, Empty
} from 'antd';
import {
  DesktopOutlined, CheckCircleOutlined, DisconnectOutlined, ReloadOutlined,
  PoweroffOutlined, MoreOutlined, ThunderboltOutlined, FileTextOutlined,
  EyeOutlined, SwapOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDevices } from '../hooks/useDevices';
import { call } from '../utils/api';
import TrendChart from '../components/TrendChart';

// 每台设备保留最近 60 个采样点（CPU/MEM）
const HISTORY_LEN = 60;

export default function Dashboard() {
  const navigate = useNavigate();
  const { devices, opsLog } = useDevices();
  const [showThumbs, setShowThumbs] = useState(false); // 默认关，可手动打开
  const [batchProject, setBatchProject] = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const historyRef = useRef({});  // id -> [{ts, cpu, memory}]
  const [tick, setTick] = useState(0);

  // 每次设备状态更新，append 一个历史点
  useEffect(() => {
    const now = Date.now();
    devices.forEach(d => {
      const info = d.info || {};
      const key = d.id;
      if (!historyRef.current[key]) historyRef.current[key] = [];
      const arr = historyRef.current[key];
      arr.push({ ts: now, cpu: info.cpu || 0, memory: info.memory || 0 });
      if (arr.length > HISTORY_LEN) arr.shift();
    });
    setTick(t => t + 1);
  }, [devices]);

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const totalCount = devices.length;
  // 项目模板（用于批量切换的下拉）—— 取所有设备出现过的项目并集
  const allProjects = Array.from(new Set(
    devices.flatMap(d => (d.info?.current_project ? [d.info.current_project] : []))
  ));

  const doBatchSwitch = async () => {
    if (!batchProject) return message.warning('选个项目');
    const r = await call('post', '/batch/switch', { project: batchProject });
    if (r.ok) {
      const okN = r.data?.filter(x => x.ok).length || 0;
      const failN = r.data?.length - okN;
      message.success(`批量切换：${okN} 成功 / ${failN} 失败`);
      setBatchOpen(false);
    } else {
      message.error(r.error);
    }
  };

  const doBatchRestart = async () => {
    const r = await call('post', '/batch/restart-project');
    if (r.ok) {
      message.success('批量重启已发送');
    } else {
      message.error(r.error);
    }
  };

  return (
    <div>
      {/* 顶部统计 + 批量工具栏 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="设备总数" value={totalCount} prefix={<DesktopOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在线设备"
              value={onlineCount}
              suffix={`/ ${totalCount}`}
              valueStyle={{ color: onlineCount > 0 ? '#52c41a' : '#ff4d4f' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="离线设备"
              value={totalCount - onlineCount}
              prefix={<DisconnectOutlined />}
              valueStyle={{ color: totalCount - onlineCount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Space direction="vertical" size="small">
              <Space wrap>
                <Button type="primary" icon={<SwapOutlined />} onClick={() => setBatchOpen(true)}>
                  批量切项目
                </Button>
                <Popconfirm
                  title="重启所有盒子当前项目？"
                  onConfirm={doBatchRestart}
                >
                  <Button icon={<ThunderboltOutlined />}>批量重启项目</Button>
                </Popconfirm>
              </Space>
              <Space>
                <span style={{ fontSize: 12, color: '#666' }}>实时画面：</span>
                <Switch size="small" checked={showThumbs} onChange={setShowThumbs} />
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 设备卡片 */}
      {devices.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Empty description="暂未发现设备 — 请确保 Atlas 盒子已启动 Agent 并连入同一 WiFi" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {devices.map(device => (
            <Col xs={24} sm={12} md={12} lg={showThumbs ? 12 : 6} key={device.id}>
              <DeviceCard
                device={device}
                history={historyRef.current[device.id] || []}
                showThumb={showThumbs}
                onView={() => navigate(`/device/${device.id}`)}
              />
            </Col>
          ))}
        </Row>
      )}

      {/* 最近操作（迷你版，更详细在 /operations） */}
      {opsLog.length > 0 && (
        <Card
          title="最近操作"
          size="small"
          style={{ marginTop: 16 }}
          extra={<a onClick={() => navigate('/operations')}>查看全部 →</a>}
        >
          <div style={{ maxHeight: 160, overflow: 'auto', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>
            {opsLog.slice(0, 8).map((e, i) => (
              <div key={i} style={{ color: e.ok ? '#666' : '#ff4d4f' }}>
                [{new Date(e.ts).toLocaleTimeString()}] {e.deviceId}/{e.action} {e.detail}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 批量切项目 Modal */}
      <Modal
        title="批量切项目（应用到所有在线设备）"
        open={batchOpen}
        onCancel={() => setBatchOpen(false)}
        onOk={doBatchSwitch}
        okText="一键切换"
      >
        <p>选择一个项目名 —— 所有在线设备会被同时切换到这个项目：</p>
        <Select
          style={{ width: '100%' }}
          placeholder="项目名"
          value={batchProject}
          onChange={setBatchProject}
          options={allProjects.map(p => ({ label: p, value: p }))}
          showSearch
        />
        <p style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
          提示：项目名需要已经部署到对应设备。否则那台设备会切换失败（其他设备正常）。
        </p>
      </Modal>
    </div>
  );
}

// 单张设备卡片
function DeviceCard({ device, history, showThumb, onView }) {
  const info = device.info || {};
  const isOnline = device.status === 'online';
  const navigate = useNavigate();

  const menu = {
    items: [
      { key: 'view', label: '查看屏幕', onClick: onView },
      { key: 'detail', label: '设备详情', onClick: () => navigate(`/device/${device.id}`) },
      { type: 'divider' },
      {
        key: 'restart-project',
        label: '重启当前项目',
        disabled: !info.current_project,
        onClick: async () => {
          const r = await call('post', `/devices/${device.id}/projects/${info.current_project}/restart`);
          message[r.ok ? 'success' : 'error'](r.ok ? '已重启' : r.error);
        }
      },
      {
        key: 'reboot',
        label: '重启盒子',
        danger: true,
        onClick: () => Modal.confirm({
          title: `确定重启 ${device.id}？`,
          content: '盒子会断开 30-60 秒，然后自动恢复。',
          onOk: async () => {
            const r = await call('post', `/devices/${device.id}/reboot`);
            message[r.ok ? 'success' : 'error'](r.ok ? r.message : r.error);
          }
        })
      },
      {
        key: 'shutdown',
        label: '关机',
        danger: true,
        onClick: () => Modal.confirm({
          title: `确定关机 ${device.id}？`,
          content: '关机后需要物理按电源键才能开机',
          onOk: async () => {
            const r = await call('post', `/devices/${device.id}/shutdown`);
            message[r.ok ? 'success' : 'error'](r.ok ? r.message : r.error);
          }
        })
      }
    ]
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: isOnline ? '#52c41a' : '#ff4d4f' }} />
          {device.name}
        </Space>
      }
      extra={
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={onView}>查看</Button>
          <Dropdown menu={menu} trigger={['click']}>
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      }
    >
      {!isOnline ? (
        <p style={{ color: '#999', textAlign: 'center', padding: 12 }}>设备离线</p>
      ) : (
        <>
          {showThumb && (
            <div style={{
              marginBottom: 8,
              border: '1px solid #eee',
              borderRadius: 4,
              overflow: 'hidden',
              aspectRatio: '16 / 9',
              position: 'relative',
              background: '#000'
            }}>
              <iframe
                src={`/vnc/${device.id}/vnc.html?path=vnc/${device.id}/websockify&autoconnect=true&view_only=true&reconnect=true&quality=2&compression=6`}
                style={{
                  position: 'absolute', inset: 0,
                  width: '1920px', height: '1080px',
                  transform: 'scale(0.18)',
                  transformOrigin: '0 0',
                  border: 0, pointerEvents: 'none'
                }}
                title={`thumb-${device.id}`}
              />
              <div style={{
                position: 'absolute', bottom: 4, right: 4,
                background: 'rgba(0,0,0,0.5)', color: '#fff',
                fontSize: 11, padding: '1px 6px', borderRadius: 2
              }}>
                view-only · click 查看 进入操作
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            <div>IP: <span style={{ fontFamily: 'ui-monospace,monospace' }}>{device.host}</span></div>
            <div>
              项目: {info.current_project
                ? <Tag color="blue">{info.current_project}</Tag>
                : <span style={{ color: '#999' }}>无</span>}
            </div>
            <div>uptime: {fmtUptime(info.uptime || 0)}</div>
          </div>
          <div style={{ marginTop: 4 }}>
            <TrendChart data={history} height={56} />
          </div>
        </>
      )}
    </Card>
  );
}

function fmtUptime(sec) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
