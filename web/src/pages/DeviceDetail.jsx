import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Tabs, Descriptions, Tag, Button, Space, Modal, Popconfirm, Input, Select, message,
  List
} from 'antd';
import {
  ArrowLeftOutlined, ReloadOutlined, PoweroffOutlined, DesktopOutlined, FileTextOutlined,
  CopyOutlined, SendOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined,
  EditOutlined, SwapOutlined, ExpandOutlined
} from '@ant-design/icons';
import { useDevices } from '../hooks/useDevices';
import { call } from '../utils/api';
import TrendChart from '../components/TrendChart';

const NATIVE_W = 1920;
const NATIVE_H = 1080;

export default function DeviceDetail() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const { getDevice, devices } = useDevices();
  const dev = getDevice(deviceId);
  const [tab, setTab] = useState('vnc');

  // 历史采样
  const historyRef = useRef([]);
  useEffect(() => {
    if (dev?.info) {
      historyRef.current.push({
        ts: Date.now(),
        cpu: dev.info.cpu || 0,
        memory: dev.info.memory || 0
      });
      if (historyRef.current.length > 60) historyRef.current.shift();
    }
  }, [dev?.info]);

  if (!dev) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
        <Card style={{ marginTop: 16 }}>设备 {deviceId} 不在线或未发现</Card>
      </div>
    );
  }

  const info = dev.info || {};
  const isOnline = dev.status === 'online';

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
          <span style={{ fontSize: 18, fontWeight: 500 }}>{dev.name}</span>
          <Tag color={isOnline ? 'green' : 'red'}>{isOnline ? '在线' : '离线'}</Tag>
        </Space>
        <Space>
          <Popconfirm title="重启当前项目？" disabled={!info.current_project}
            onConfirm={async () => {
              const r = await call('post', `/devices/${deviceId}/projects/${info.current_project}/restart`);
              message[r.ok ? 'success' : 'error'](r.ok ? '已重启' : r.error);
            }}
          >
            <Button icon={<ThunderboltIcon />} disabled={!info.current_project}>重启当前项目</Button>
          </Popconfirm>
          <Popconfirm title="重启盒子？大约 30-60 秒后自动恢复" onConfirm={async () => {
            const r = await call('post', `/devices/${deviceId}/reboot`);
            message[r.ok ? 'success' : 'error'](r.ok ? r.message : r.error);
          }}>
            <Button danger icon={<ReloadOutlined />}>重启盒子</Button>
          </Popconfirm>
          <Popconfirm title="关机？需要物理按电源键才能开机" onConfirm={async () => {
            const r = await call('post', `/devices/${deviceId}/shutdown`);
            message[r.ok ? 'success' : 'error'](r.ok ? r.message : r.error);
          }}>
            <Button danger icon={<PoweroffOutlined />}>关机</Button>
          </Popconfirm>
        </Space>
      </div>

      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'vnc',       label: <span><DesktopOutlined /> 屏幕</span>,    children: <VNCPane deviceId={deviceId} /> },
        { key: 'overview',  label: '概览',     children: <OverviewPane info={info} dev={dev} history={historyRef.current} /> },
        { key: 'projects',  label: '项目',     children: <ProjectsPane deviceId={deviceId} info={info} /> },
        { key: 'clipboard', label: '剪贴板',   children: <ClipboardPane deviceId={deviceId} /> },
        { key: 'logs',      label: <span><FileTextOutlined /> 日志</span>, children: <LogsPane deviceId={deviceId} /> },
      ]} />
    </div>
  );
}

function ThunderboltIcon() {
  return <span>⚡</span>;
}

// ============ VNC 屏幕（带等比缩放）============
function VNCPane({ deviceId }) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w && h) setScale(Math.min(w / NATIVE_W, h / NATIVE_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vncUrl =
    `/vnc/${deviceId}/vnc.html` +
    `?path=vnc/${deviceId}/websockify` +
    `&autoconnect=true&reconnect=true&quality=6&compression=2&show_dot=false`;

  return (
    <Card bodyStyle={{ padding: 0, background: '#000' }} id="vnc-wrap">
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          maxHeight: 'calc(100vh - 240px)',
          overflow: 'hidden',
          background: '#000'
        }}
      >
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: NATIVE_W * scale, height: NATIVE_H * scale,
          transform: 'translate(-50%, -50%)'
        }}>
          <iframe
            key={reloadKey}
            src={vncUrl}
            title={`vnc-${deviceId}`}
            style={{
              width: NATIVE_W, height: NATIVE_H, border: 0,
              transformOrigin: '0 0',
              transform: `scale(${scale})`,
              display: 'block', background: '#000'
            }}
            allow="fullscreen"
          />
        </div>
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <Space>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => setReloadKey(k => k + 1)}>重连</Button>
            <Button size="small" icon={<ExpandOutlined />} onClick={() => {
              const el = document.getElementById('vnc-wrap');
              el?.requestFullscreen?.();
            }}>全屏</Button>
          </Space>
        </div>
      </div>
    </Card>
  );
}

// ============ 概览 ============
function OverviewPane({ info, dev, history }) {
  return (
    <Card>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="设备 ID">{dev.id}</Descriptions.Item>
        <Descriptions.Item label="IP">{dev.host}</Descriptions.Item>
        <Descriptions.Item label="主机名">{info.hostname || '-'}</Descriptions.Item>
        <Descriptions.Item label="盒子内部 IP">{info.ip || '-'}</Descriptions.Item>
        <Descriptions.Item label="当前项目">
          {info.current_project ? <Tag color="blue">{info.current_project}</Tag> : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="CPU">{(info.cpu || 0).toFixed(1)}%</Descriptions.Item>
        <Descriptions.Item label="内存">{(info.memory || 0).toFixed(1)}%</Descriptions.Item>
        <Descriptions.Item label="温度">{info.temperature ? `${info.temperature}°C` : 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="Uptime">{fmtUptime(info.uptime || 0)}</Descriptions.Item>
        <Descriptions.Item label="VNC 端口">{info.vnc_port || 6080}</Descriptions.Item>
      </Descriptions>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>CPU / 内存 实时趋势</div>
        <Card size="small" bodyStyle={{ padding: 8 }}>
          <TrendChart data={history} height={120} />
        </Card>
      </div>
    </Card>
  );
}

// ============ 项目控制 ============
function ProjectsPane({ deviceId, info }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logProject, setLogProject] = useState(null);

  const load = async () => {
    setLoading(true);
    const r = await call('get', `/devices/${deviceId}/projects`);
    if (r.ok) setProjects(Array.isArray(r.data) ? r.data : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [deviceId]);

  const act = async (method, url, msg, body = undefined, refresh = true) => {
    const r = await call(method, url, body);
    message[r.ok ? 'success' : 'error'](r.ok ? msg : r.error);
    if (r.ok && refresh) load();
  };

  return (
    <Card extra={<Button size="small" icon={<ReloadOutlined />} onClick={load}>刷新</Button>}>
      <List
        loading={loading}
        dataSource={projects}
        locale={{ emptyText: '该设备没有项目，去「项目管理」上传一个' }}
        renderItem={(p) => {
          const isCurrent = info.current_project === p.name;
          const isRunning = p.status === 'running';
          return (
            <List.Item
              actions={[
                <Button key="switch" size="small" type="primary" icon={<SwapOutlined />}
                  disabled={isCurrent && isRunning}
                  onClick={() => act('post', `/devices/${deviceId}/switch`,
                    `已切换到 ${p.name}`, { project: p.name })}>切换</Button>,
                isRunning
                  ? <Button key="stop" size="small" icon={<PauseCircleOutlined />}
                      onClick={() => act('post', `/devices/${deviceId}/stop`, `已停止 ${p.name}`)}>停止</Button>
                  : <Button key="start" size="small" icon={<PlayCircleOutlined />}
                      onClick={() => act('post', `/devices/${deviceId}/start`, `已启动 ${p.name}`)}>启动</Button>,
                <Button key="restart" size="small"
                  onClick={() => act('post', `/devices/${deviceId}/projects/${p.name}/restart`, `已重启 ${p.name}`)}>
                  重启
                </Button>,
                <Button key="logs" size="small" icon={<FileTextOutlined />}
                  onClick={() => setLogProject(p.name)}>日志</Button>,
                <Popconfirm key="del" title={`删除项目 ${p.name}？文件会被永久删除`}
                  onConfirm={() => act('delete', `/devices/${deviceId}/projects/${p.name}`, `已删除 ${p.name}`)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              ]}
              extra={null}
            >
              <List.Item.Meta
                title={<Space>
                  <strong>{p.name}</strong>
                  <Tag color={isRunning ? 'green' : 'default'}>{isRunning ? '运行中' : '已停止'}</Tag>
                  {isCurrent && <Tag color="blue">当前</Tag>}
                </Space>}
                description={p.description || <span style={{ color: '#bbb' }}>无描述</span>}
              />
            </List.Item>
          );
        }}
        renderHeader={null}
      />

      <Modal
        title={`项目日志: ${logProject}`}
        open={!!logProject}
        onCancel={() => setLogProject(null)}
        footer={null}
        width={900}
      >
        {logProject && <LogViewer fetchUrl={`/devices/${deviceId}/projects/${logProject}/logs?lines=300`} />}
      </Modal>
    </Card>
  );
}

// ============ 剪贴板桥接 ============
function ClipboardPane({ deviceId }) {
  const [text, setText] = useState('');
  const [remoteText, setRemoteText] = useState('');
  const [loading, setLoading] = useState(false);

  const pull = async () => {
    setLoading(true);
    const r = await call('get', `/devices/${deviceId}/clipboard`);
    setRemoteText(r.ok ? (r.data?.text || '') : `(读取失败: ${r.error})`);
    setLoading(false);
  };

  const push = async () => {
    if (!text) return message.warning('输入要发送的文本');
    const r = await call('post', `/devices/${deviceId}/clipboard`, { text });
    message[r.ok ? 'success' : 'error'](r.ok ? '已写入设备剪贴板（在设备 GUI 里 Ctrl+V 粘贴）' : r.error);
  };

  return (
    <Card>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <div style={{ marginBottom: 8 }}>
            <strong>本地 → 设备</strong>
            <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
              输入或粘贴文字 → 写入设备的 X 剪贴板 → 在设备 GUI 里 Ctrl+V 粘贴
            </span>
          </div>
          <Input.TextArea
            rows={4}
            placeholder="在这里输入或粘贴文本…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={push} style={{ marginTop: 8 }}>
            发送到设备
          </Button>
        </div>

        <div>
          <div style={{ marginBottom: 8 }}>
            <strong>设备 → 本地</strong>
            <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
              点击"拉取"读取设备当前剪贴板内容
            </span>
          </div>
          <Input.TextArea rows={4} readOnly value={remoteText} placeholder="点拉取后这里会显示设备剪贴板内容" />
          <Space style={{ marginTop: 8 }}>
            <Button icon={<ReloadOutlined />} onClick={pull} loading={loading}>拉取设备剪贴板</Button>
            <Button icon={<CopyOutlined />} onClick={() => {
              navigator.clipboard.writeText(remoteText).then(() => message.success('已复制到本地剪贴板'));
            }} disabled={!remoteText}>复制到本地</Button>
          </Space>
        </div>
      </Space>
    </Card>
  );
}

// ============ 日志（项目 + 系统 unit）============
function LogsPane({ deviceId }) {
  const [unit, setUnit] = useState('atlas-agent');
  return (
    <Card extra={
      <Space>
        <Select value={unit} onChange={setUnit} style={{ width: 180 }}
          options={[
            { value: 'atlas-agent', label: 'atlas-agent' },
            { value: 'atlas-vnc', label: 'atlas-vnc' },
            { value: 'atlas-novnc', label: 'atlas-novnc' },
            { value: 'atlas-noidle', label: 'atlas-noidle' }
          ]}
        />
      </Space>
    }>
      <LogViewer fetchUrl={`/devices/${deviceId}/logs?unit=${unit}&lines=300`} key={unit} />
    </Card>
  );
}

function LogViewer({ fetchUrl }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    const r = await call('get', fetchUrl);
    setContent(r.ok ? (typeof r.data === 'string' ? r.data : JSON.stringify(r.data)) : `读取失败: ${r.error}`);
    setLoading(false);
  };
  useEffect(() => { load(); }, [fetchUrl]);

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>
      <pre style={{
        background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 4,
        fontSize: 12, fontFamily: 'ui-monospace, monospace',
        maxHeight: 'calc(100vh - 320px)', overflow: 'auto',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word'
      }}>{content || '(无日志)'}</pre>
    </div>
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
