import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Progress, Tag, Button, Space } from 'antd';
import { DesktopOutlined, CheckCircleOutlined, DisconnectOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const WS_URL = `ws://${window.location.host}/ws`;

export default function Dashboard() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('WebSocket 已连接');
      socket.send(JSON.stringify({ type: 'get_devices' }));
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'device_list') {
        setDevices(msg.data || []);
      } else if (msg.type === 'device_status') {
        updateDeviceStatus(msg.devices);
      }
    };

    socket.onclose = () => console.log('WebSocket 已断开');
    socket.onerror = (err) => console.error('WebSocket 错误:', err);

    setWs(socket);

    // 定期刷新状态
    const interval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'get_status' }));
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      socket.close();
    };
  }, []);

  const updateDeviceStatus = (statuses) => {
    if (!statuses) return;
    setDevices(prev => prev.map(d => ({
      ...d,
      info: statuses[d.id] || d.info
    })));
  };

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const totalCount = devices.length;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="设备总数"
              value={totalCount}
              prefix={<DesktopOutlined />}
            />
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
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => ws?.send(JSON.stringify({ type: 'get_devices' }))}
            >
              刷新设备
            </Button>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {devices.map(device => (
          <Col span={6} key={device.id}>
            <Card
              className="device-card"
              title={
                <Space>
                  <span className={`status-indicator status-${device.status}`} />
                  {device.name}
                </Space>
              }
              extra={
                <Button size="small" onClick={() => navigate(`/vnc/${device.id}`)}>
                  查看屏幕
                </Button>
              }
            >
              {device.info ? (
                <>
                  <p>IP: {device.info.ip || device.host}</p>
                  <p>项目: <Tag color="blue">{device.info.current_project || '无'}</Tag></p>
                  <p>CPU: <Progress percent={Math.round(device.info.cpu || 0)} size="small" /></p>
                  <p>内存: <Progress percent={Math.round(device.info.memory || 0)} size="small" /></p>
                </>
              ) : (
                <p style={{ color: '#999' }}>设备离线</p>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {devices.length === 0 && (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#999', fontSize: 16 }}>暂未发现设备</p>
          <p style={{ color: '#999' }}>请确保 Atlas 盒子已启动 Agent 服务</p>
        </Card>
      )}
    </div>
  );
}
