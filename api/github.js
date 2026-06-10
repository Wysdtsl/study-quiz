export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://wysdtsl.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const path = req.url.replace('/api/github', '');
  const ghUrl = 'https://api.github.com/repos/Wysdtsl/study-quiz/contents' + path;
  
  try {
    const headers = {};
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    headers.Accept = 'application/vnd.github.v3+json';
    
    const fetchOpts = { method: req.method, headers };
    if (req.method === 'PUT' && req.body) fetchOpts.body = JSON.stringify(req.body);
    
    const ghResp = await fetch(ghUrl, fetchOpts);
    const body = await ghResp.json();
    res.status(ghResp.status).json(body);
  } catch(e) {
    res.status(502).json({ error: 'GitHub API unreachable: ' + e.message });
  }
}
