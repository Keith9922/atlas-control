// 统一 API 调用工具
import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  timeout: 30 * 1000
});

// 解开 agent 返回的多重 data 嵌套（主控 forward 时会嵌一层）
export function unwrap(resp) {
  // resp = axios response, .data = { success, data, message, error }
  const body = resp.data;
  if (body && body.data && body.data.data !== undefined) return body.data;
  return body;
}

// 通用 success/error 处理（不抛异常，返回 { ok, data, error }）
export async function call(method, url, data) {
  try {
    const resp = await api({ method, url, data });
    const r = unwrap(resp);
    return r.success
      ? { ok: true, data: r.data, message: r.message }
      : { ok: false, error: r.error || r.message || 'unknown error' };
  } catch (err) {
    const r = err.response?.data;
    return { ok: false, error: r?.error || r?.message || err.message };
  }
}
