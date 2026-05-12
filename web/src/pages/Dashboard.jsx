import React, { useEffect, useState, useRef } from 'react';
import {
  Row, Col, Card, Statistic, Button, Space, Tag, Dropdown, Modal, Select,
  Switch, message, Tooltip, Popconfirm, Empty, Progress, Grid
} from 'antd';
import {
  DesktopOutlined, CheckCircleOutlined, DisconnectOutlined,
  MoreOutlined, ThunderboltOutlined, EyeOutlined, SwapOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDevices } from '../hooks/useDevices';
import { call } from '../utils/api';
import TrendChart from '../components/TrendChart';

const HISTORY_LEN = 60;
const NATIVE_W = 1920;
const NATIVE_H = 1080;

export default function Dashboard() {
  const navigate = useNavigate();
  const { devices, opsLog } = useDevices();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [showThumbs, setShowThumbs] = useState(false);
  const [batchProject, setBatchProject] = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const historyRef = useRef({});
  const [, force] = useState(0);

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
    force(t => t + 1);
  }, [devices]);

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const totalCount = devices.length;
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
    message[r.ok ? 'success' : 'error'](r.ok ? '批量重启已发送' : r.error);
  };

  return (
    <div>
      {/* 顶部统计 + 批量工具栏 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={12} md={6}>
          <Card bodyStyle={{ padding: 16 }}>
            <Statistic
              title={<span style={{ color: '#262626', fontWeight: 500 }}>设备总数</span>}
              value={totalCount}
              prefix={<DesktopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card bodyStyle={{ padding: 16 }}>
            <Statistic
              title={<span style={{ color: '#262626', fontWeight: 500 }}>在线</span>}
              value={onlineCount}
              suffix={`/ ${totalCount}`}
              valueStyle={{ color: onlineCount === totalCount ? '#52c41a' : '#faad14' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card bodyStyle={{ padding: 16 }}>
            <Statistic
              title={<span style={{ color: '#262626', fontWeight: 500 }}>离线</span>}
              value={totalCount - onlineCount}
              prefix={<DisconnectOutlined />}
              valueStyle={{ color: totalCount - onlineCount > 0 ? '#ff4d4f' : '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card bodyStyle={{ padding: 12 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap size="small">
                <Tooltip title="选一个项目名，所有在线设备同时切换">
                  <Button type="primary" size={isMobile ? 'small' : 'middle'}
                    icon={<SwapOutlined />} onClick={() => setBatchOpen(true)}>
                    批量切项目
                  </Button>
                </Tooltip>
                <Popconfirm title="重启所有盒子当前项目？" onConfirm={doBatchRestart}>
                  <Tooltip title={`重启每台盒子的"当前项目"`}>
                    <Button size={isMobile ? 'small' : 'middle'} icon={<ThunderboltOutlined />}>
                      批量重启项目
                    </Button>
                  </Tooltip>
                </Popconfirm>
              </Space>
              <Space size="small">
                <Tooltip title="开启后每张卡显示盒子屏幕缩略图。会消耗带宽 / CPU，多人查看时建议关闭。">
                  <span style={{ fontSize: 12, color: '#666' }}>
                    实时画面 <InfoCircleOutlined style={{ color: '#bbb' }} />
                  </span>
                </Tooltip>
                <Switch size="small" checked={showThumbs} onChange={setShowThumbs} />
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 设备卡片 */}
      {devices.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Empty description="还没有发现设备 — 请确保 Atlas 盒子已开机并连入同一 WiFi" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {devices.map(device => (
            <Col xs={24} sm={12} lg={showThumbs ? 12 : 6} key={device.id}>
              <DeviceCard
                device={device}
                history={historyRef.current[device.id] || []}
                showThumb={showThumbs}
                onView={() => navigate(`/device/${device.id}`)}
                onGoProjects={() => navigate('/projects')}
                isMobile={isMobile}
              />
            </Col>
          ))}
        </Row>
      )}

      {/* 最近操作 */}
      {opsLog.length > 0 && (
        <Card title="最近操作" size="small" style={{ marginTop: 16 }}
          extra={<a onClick={() => navigate('/operations')}>查看全部 →</a>}
        >
          <div style={{ maxHeight: 160, overflow: 'auto', fontSize: 12 }}>
            {opsLog.slice(0, 8).map((e, i) => (
              <div key={i} style={{ color: e.ok ? '#666' : '#ff4d4f', padding: '2px 0' }}>
                <span style={{ color: '#999' }}>[{new Date(e.ts).toLocaleTimeString()}]</span>
                {' '}{e.deviceId} · {opActionLabel(e.action)}
                {e.detail && <span style={{ color: '#999' }}> ({e.detail})</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 批量切项目 */}
      <Modal
        title="批量切换项目"
        open={batchOpen}
        onCancel={() => setBatchOpen(false)}
        onOk={doBatchSwitch}
        okText="一键切换"
      >
        <p>选择一个项目名 — 所有在线设备会被同时切换到这个项目：</p>
        <Select
          style={{ width: '100%' }}
          placeholder="选择项目"
          value={batchProject}
          onChange={setBatchProject}
          options={allProjects.map(p => ({ label: p, value: p }))}
          showSearch
        />
        <p style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
          提示：项目名需要已经部署到对应设备。否则那台设备会切换失败（不影响其他设备）。
        </p>
      </Modal>
    </div>
  );
}

// 操作名称翻译（与 Operations.jsx 共用同一份字典也行，但这里只用前 8 个常见）
function opActionLabel(action) {
  const map = {
    'project-restart': '重启项目',
    'project-delete': '删除项目',
    'project-patch': '编辑项目',
    'system-reboot': '重启盒子',
    'system-shutdown': '关机',
    'clipboard-set': '剪贴板写入',
    'batch-switch': '批量切换',
    'batch-restart-project': '批量重启',
    'batch-reboot': '批量重启盒子',
  };
  return map[action] || action;
}

function DeviceCard({ device, history, showThumb, onView, onGoProjects, isMobile }) {
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
          content: '关机后需要物理按电源键才能重新开机。',
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
          <span style={{ fontWeight: 600 }}>{device.name}</span>
        </Space>
      }
      extra={
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={onView}>查看</Button>
          <Dropdown menu={menu} trigger={['click']}>
            <Button size="small" icon={<MoreOutlined />} title="更多操作" />
          </Dropdown>
        </Space>
      }
    >
      {!isOnline ? (
        <p style={{ color: '#999', textAlign: 'center', padding: 12 }}>设备离线</p>
      ) : (
        <>
          {showThumb && (
            <ThumbnailFrame deviceId={device.id} />
          )}

          <div style={{ fontSize: 13, lineHeight: 1.9 }}>
            <div>IP：<span style={{ fontFamily: 'ui-monospace, monospace' }}>{device.host}</span></div>
            <div>
              当前项目：
              {info.current_project
                ? <Tag color="blue" style={{ marginLeft: 4 }}>{info.current_project}</Tag>
                : <a style={{ marginLeft: 4 }} onClick={onGoProjects}>无 (去部署 →)</a>}
            </div>
            <div>运行时长：{fmtUptime(info.uptime || 0)}</div>
          </div>

          {/* CPU / 内存 用进度条 + 数字 */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 36, color: '#666' }}>CPU</span>
              <Progress
                percent={Math.round(info.cpu || 0)}
                size="small"
                strokeColor={(info.cpu || 0) > 80 ? '#ff4d4f' : '#1890ff'}
                style={{ flex: 1, margin: 0 }}
                showInfo={false}
              />
              <span style={{ width: 36, textAlign: 'right', fontFamily: 'ui-monospace,monospace' }}>
                {Math.round(info.cpu || 0)}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 4 }}>
              <span style={{ width: 36, color: '#666' }}>内存</span>
              <Progress
                percent={Math.round(info.memory || 0)}
                size="small"
                strokeColor={(info.memory || 0) > 80 ? '#ff4d4f' : '#52c41a'}
                style={{ flex: 1, margin: 0 }}
                showInfo={false}
              />
              <span style={{ width: 36, textAlign: 'right', fontFamily: 'ui-monospace,monospace' }}>
                {Math.round(info.memory || 0)}%
              </span>
            </div>
          </div>

          {/* 趋势图（数据少时不显示，避免视觉空白） */}
          {history.length >= 3 && (
            <div style={{ marginTop: 8 }}>
              <TrendChart data={history} height={50} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// 缩略图：iframe 固定 1920×1080，外层 ResizeObserver 算 scale 让画面填满容器
function ThumbnailFrame({ deviceId }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / NATIVE_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        marginBottom: 8,
        border: '1px solid #eee',
        borderRadius: 4,
        overflow: 'hidden',
        aspectRatio: '16 / 9',
        position: 'relative',
        background: '#000'
      }}
    >
      <iframe
        src={`/vnc/${deviceId}/vnc.html?path=vnc/${deviceId}/websockify&autoconnect=true&view_only=true&reconnect=true&quality=2&compression=6`}
        style={{
          position: 'absolute', left: 0, top: 0,
          width: NATIVE_W, height: NATIVE_H,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          border: 0, pointerEvents: 'none'
        }}
        title={`thumb-${deviceId}`}
      />
      <div style={{
        position: 'absolute', bottom: 4, right: 4,
        background: 'rgba(0,0,0,0.6)', color: '#fff',
        fontSize: 11, padding: '1px 6px', borderRadius: 2
      }}>
        仅预览 · 点"查看"操作
      </div>
    </div>
  );
}

function fmtUptime(sec) {
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时 ${m % 60} 分`;
  return `${Math.floor(h / 24)} 天 ${h % 24} 小时`;
}
