import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Space, message, Card } from 'antd';
import { ArrowLeftOutlined, ExpandOutlined } from '@ant-design/icons';

export default function VNCViewer() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [vncUrl, setVncUrl] = useState('');

  useEffect(() => {
    // VNC 地址：代理到设备的 VNC 服务
    // 设备 ID 用于标识连接哪个设备
    const baseUrl = `http://${window.location.host}`;
    // noVNC 页面会通过 /vnc 路由代理到设备
    setVncUrl(`${baseUrl}/vnc/?host=${window.location.hostname}&port=${window.location.port}&device=${deviceId}`);
  }, [deviceId]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <span style={{ fontSize: 16 }}>设备: {deviceId}</span>
        </Space>
      </div>

      <Card bodyStyle={{ padding: 0 }}>
        <div className="vnc-container" style={{ position: 'relative' }}>
          <iframe
            src={vncUrl}
            title={`VNC - ${deviceId}`}
            allow="fullscreen"
          />
        </div>
      </Card>

      <div style={{ marginTop: 16, color: '#999', fontSize: 12 }}>
        <p>提示：VNC 连接可能需要几秒钟建立。如果画面黑屏，请刷新页面。</p>
        <p>延迟说明：局域网内延迟约 1-3 秒，适合轻度操作。</p>
      </div>
    </div>
  );
}
