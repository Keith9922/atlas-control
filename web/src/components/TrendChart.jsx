import React, { useEffect, useRef } from 'react';

/**
 * 极简实时折线图（Canvas，不引第三方）
 * props: data = [{ts, cpu, memory}], height, color
 * 自动按 props 更新；保留最近 60 个采样点（~2min 缓冲）
 */
export default function TrendChart({ data = [], height = 60, label = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = height;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (data.length === 0) return;

    const pad = 4;
    const w = cssW - pad * 2;
    const h = cssH - pad * 2;

    const drawSeries = (key, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = pad + (i / Math.max(data.length - 1, 1)) * w;
        const v = Math.max(0, Math.min(100, d[key] || 0));
        const y = pad + (1 - v / 100) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    // 网格 (25/50/75)
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 0.5;
    [0.25, 0.5, 0.75].forEach(p => {
      ctx.beginPath();
      ctx.moveTo(pad, pad + p * h);
      ctx.lineTo(pad + w, pad + p * h);
      ctx.stroke();
    });

    drawSeries('cpu', '#1890ff');
    drawSeries('memory', '#52c41a');

    // 当前值
    const last = data[data.length - 1] || {};
    ctx.fillStyle = '#666';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(`CPU ${(last.cpu || 0).toFixed(0)}%`, pad + 2, 14);
    ctx.fillStyle = '#52c41a';
    ctx.fillText(`MEM ${(last.memory || 0).toFixed(0)}%`, pad + 70, 14);
    if (label) {
      ctx.fillStyle = '#999';
      ctx.fillText(label, cssW - 60, 14);
    }
  }, [data, height, label]);

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
    />
  );
}
