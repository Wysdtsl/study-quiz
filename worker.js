/**
 * 学习伙伴 - AI 聊天代理 Worker
 *
 * ── 部署步骤 ──
 * 1. 注册 Cloudflare 账号（免费）：https://dash.cloudflare.com
 * 2. Node 安装：npm install -g wrangler
 * 3. 登录：wrangler login
 * 4. 部署：wrangler deploy
 * 5. 设置环境变量：
 *    wrangler secret put DEEPSEEK_API_KEY   ← 你的 DeepSeek API key
 *    wrangler secret put ACCESS_CODE         ← 你设的访问码密码
 * 6. 复制 worker 地址，更新 index.html 中的 CHAT_WORKER 变量
 *
 * ── 环境变量 ──
 *   DEEPSEEK_API_KEY  - DeepSeek API 密钥（必填）
 *   ACCESS_CODE       - 访问码（必填）
 */

// ── 用量限制 ──
const DAILY_LIMIT = 30; // 每个 IP 每天最多请求次数

export default {
  async fetch(request, env) {
    // 只接受 POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // 解析请求
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: '无效的请求格式' }, 400);
    }

    const { accessCode, message, history } = body;

    // ── 验证访问码 ──
    if (accessCode !== env.ACCESS_CODE) {
      return json({ error: '访问码错误' }, 403);
    }

    // ── 验证消息 ──
    if (!message || message.trim().length === 0) {
      return json({ error: '消息不能为空' }, 400);
    }
    if (message.length > 2000) {
      return json({ error: '消息太长，请控制在 2000 字以内' }, 400);
    }

    // ── 用量检查 ──
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const day = new Date().toISOString().slice(0, 10);
    const usageKey = `usage:${day}:${ip}`;

    let usage = 0;
    try {
      const val = await env.KV.get(usageKey);
      if (val) usage = parseInt(val, 10);
    } catch { /* KV 未绑定，不限流 */ }

    if (usage >= DAILY_LIMIT) {
      return json({ error: `今日对话次数已达上限（${DAILY_LIMIT} 次）` }, 429);
    }

    // ── 构建消息 ──
    const systemPrompt = `你是一个学习伙伴，帮助用户理解和记忆知识。你的特点是：
- 回答简洁、准确，直击重点
- 用户可能正在备考（公基/常识），你的回答要贴近考试知识点
- 如果用户问的是易混点，主动指出容易记错的地方
- 如果用户问的是有争议的知识点，告诉用户常见说法有哪些
- 不要闲聊，不要过度延伸，不要编造事实
- 不知道就说不知道`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history : []),
      { role: 'user', content: message }
    ];

    // ── 调用 DeepSeek ──
    try {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages,
          max_tokens: 1024,
          temperature: 0.3,
          stream: false
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return json({ error: `AI 服务错误: ${resp.status}` }, 502);
      }

      const data = await resp.json();
      const reply = data.choices?.[0]?.message?.content || '';

      // ── 更新用量 ──
      try {
        await env.KV.put(usageKey, String(usage + 1), { expirationTtl: 86400 });
      } catch { /* KV 未绑定，跳过 */ }

      return json({ reply });

    } catch (e) {
      return json({ error: '网络错误，请稍后重试' }, 502);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
