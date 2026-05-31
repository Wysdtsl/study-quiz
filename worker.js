/**
 * 学习伙伴 - AI 聊天代理 Worker
 *
 * 环境变量：
 *   DEEPSEEK_API_KEY  - DeepSeek API 密钥（必填）
 *   ACCESS_CODE       - 访问码（必填）
 */

const DAILY_LIMIT = 30;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default {
  async fetch(request, env) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: '无效的请求格式' }, 400);
    }

    const { accessCode, message, history } = body;

    if (accessCode !== env.ACCESS_CODE) {
      return json({ error: '访问码错误' }, 403);
    }

    if (!message || message.trim().length === 0) {
      return json({ error: '消息不能为空' }, 400);
    }
    if (message.length > 2000) {
      return json({ error: '消息太长，请控制在 2000 字以内' }, 400);
    }

    // ── 用量（无 KV 时跳过） ──
    try {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const day = new Date().toISOString().slice(0, 10);
      const val = await env.KV?.get(`usage:${day}:${ip}`);
      if (val && parseInt(val) >= DAILY_LIMIT) {
        return json({ error: `今日对话次数已达上限（${DAILY_LIMIT} 次）` }, 429);
      }
    } catch { /* skip */ }

    // ── 调 DeepSeek ──
    try {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: '你是一个学习伙伴，帮助用户理解和记忆公基/常识知识。回答简洁准确，直击重点。易混点主动指出。不要闲聊不要编造。不知道就说不知道。' },
            ...(Array.isArray(history) ? history : []),
            { role: 'user', content: message }
          ],
          max_tokens: 1024,
          temperature: 0.3,
          stream: false
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return json({ error: `AI 服务错误 (${resp.status})` }, 502);
      }

      const data = await resp.json();
      const reply = data.choices?.[0]?.message?.content || '';

      // 更新用量（无 KV 跳过）
      try {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const day = new Date().toISOString().slice(0, 10);
        const key = `usage:${day}:${ip}`;
        const current = parseInt(await env.KV?.get(key) || '0');
        await env.KV?.put(key, String(current + 1), { expirationTtl: 86400 });
      } catch { /* skip */ }

      return json({ reply });

    } catch (e) {
      return json({ error: '网络错误，请稍后重试' }, 502);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
