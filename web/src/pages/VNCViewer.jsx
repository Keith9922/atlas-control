import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Space, Card } from 'antd';
import { ArrowLeftOutlined, ExpandOutlined, ReloadOutlined } from '@ant-design/icons';

// 盒子 HDMI 原生分辨率
const NATIVE_W = 1920;
const NATIVE_H = 1080;

export default function VNCViewer() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  // noVNC 在 iframe 里以 1920x1080 1:1 渲染，外层用 CSS transform 等比缩放
  // 这样不依赖 noVNC 自身的 resize 设置（1.0.0 默认是 off 不易覆盖）
  const vncUrl =
    `/vnc/${deviceId}/vnc.html` +
    `?path=vnc/${deviceId}/websockify` +
    `&autoconnect=true&reconnect=true&quality=6&compression=2&show_dot=false`;

  // 监听容器尺寸，动态算 scale 让 1920x1080 完全装进容器（保留宽高比）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w && h) {
        setScale(Math.min(w / NATIVE_W, h / NATIVE_H));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const goFullscreen = () => {
    const el = document.getElementById('vnc-wrap');
    if (el?.requestFullscreen) el.requestFullscreen();
  };

  const scaledW = NATIVE_W * scale;
  const scaledH = NATIVE_H * scale;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <span style={{ fontSize: 16 }}>设备: {deviceId}</span>
          <Button icon={<ReloadOutlined />} onClick={() => setReloadKey(k => k + 1)}>
            重连
          </Button>
          <Button icon={<ExpandOutlined />} onClick={goFullscreen}>
            全屏
          </Button>
          <span style={{ color: '#999', fontSize: 12 }}>
            缩放 {(scale * 100).toFixed(0)}%（原始 {NATIVE_W}×{NATIVE_H}）
          </span>
        </Space>
      </div>

      <Card bodyStyle={{ padding: 0, background: '#000' }} id="vnc-wrap">
        {/* 外层容器：16:9 比例，宽自适应，限制最大高度 */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            maxHeight: 'calc(100vh - 180px)',
            overflow: 'hidden',
            background: '#000'
          }}
        >
          {/* 居中放置：缩放后的可视尺寸 scaledW × scaledH */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: scaledW,
              height: scaledH,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <iframe
              key={reloadKey}
              id="vnc-frame"
              src={vncUrl}
              title={`VNC - ${deviceId}`}
              allow="fullscreen"
              style={{
                width: NATIVE_W,
                height: NATIVE_H,
                border: 0,
                background: '#000',
                transformOrigin: '0 0',
                transform: `scale(${scale})`,
                display: 'block'
              }}
            />
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 16, color: '#999', fontSize: 12 }}>
        <p>
          盒子 HDMI 输出 {NATIVE_W}×{NATIVE_H}，浏览器内画面会自动等比缩放到窗口大小（鼠标键盘坐标自动还原）。
        </p>
        <p>点击「全屏」获得最佳观看尺寸；窗口拉大/缩小都会自动适配。</p>
      </div>
    </div>
  );
}
