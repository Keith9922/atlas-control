import { useEffect, useRef, useState } from 'react';

// useDevices: 全局设备列表，订阅主控 WebSocket 实时获取
// 返回 { devices, getDevice, opsLog }
export function useDevices() {
  const [devices, setDevices] = useState([]);
  const [opsLog, setOpsLog] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    let ws;
    let backoff = 1000;
    let timer = null;

    const connect = () => {
      const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        backoff = 1000;
        ws.send(JSON.stringify({ type: 'get_devices' }));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'device_list' && Array.isArray(msg.data)) {
            setDevices(msg.data);
          } else if (msg.type === 'device_status' && Array.isArray(msg.devices)) {
            setDevices(msg.devices);
          } else if (msg.type === 'op_logged' && msg.entry) {
            setOpsLog((prev) => [msg.entry, ...prev].slice(0, 200));
          }
        } catch {}
      };
      ws.onclose = () => {
        wsRef.current = null;
        // 指数退避重连
        timer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 10000);
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };

    // 也先 fetch 一次，让首屏立刻有数据
    fetch('/api/devices').then(r => r.json()).then(d => {
      if (d.success && Array.isArray(d.data)) setDevices(d.data);
    }).catch(() => {});
    fetch('/api/operations?limit=50').then(r => r.json()).then(d => {
      if (d.success && Array.isArray(d.data)) setOpsLog(d.data);
    }).catch(() => {});

    connect();
    return () => {
      if (timer) clearTimeout(timer);
      if (ws) { try { ws.close(); } catch {} }
    };
  }, []);

  const getDevice = (id) => devices.find(d => d.id === id);

  return { devices, getDevice, opsLog };
}
