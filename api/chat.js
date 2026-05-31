// 学习伙伴 AI 聊天代理 - Vercel Serverless Function
// 环境变量: DEEPSEEK_API_KEY, ACCESS_CODE

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const ACCESS_CODE = process.env.ACCESS_CODE;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { accessCode, message, history } = req.body || {};

  if (accessCode !== ACCESS_CODE) {
    return res.status(403).json({ error: '访问码错误' });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ error: '消息不能为空' });
  }

  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: '你是一个学习伙伴，帮助用户理解和记忆公基/常识知识。回答简洁准确，直击重点。易混点主动指出。不要闲聊不要编造。不知道就说不知道。' },
          ...(Array.isArray(history) ? history : []),
          { role: 'user', content: message }
        ],
        max_tokens: 1024,
        temperature: 0.3
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: `AI 服务错误 (${resp.status})` });
    }

    const data = await resp.json();
    return res.json({ reply: data.choices?.[0]?.message?.content || '' });

  } catch (e) {
    return res.status(502).json({ error: '网络错误，请稍后重试' });
  }
}
