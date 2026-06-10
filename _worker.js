addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Only proxy GitHub API calls
  const url = new URL(request.url)
  const ghPath = url.pathname + url.search
  
  // Rate limit
  const ip = request.headers.get('CF-Connecting-IP')
  
  const ghUrl = 'https://api.github.com/repos' + ghPath
  
  // Forward the request with original headers
  const headers = new Headers(request.headers)
  headers.set('Host', 'api.github.com')
  
  // Remove Cloudflare-specific headers
  headers.delete('CF-Connecting-IP')
  headers.delete('CF-Ray')
  headers.delete('CF-Visitor')
  headers.delete('CF-IPCountry')
  
  try {
    const ghResp = await fetch(ghUrl, {
      method: request.method,
      headers: headers,
      body: request.method === 'PUT' ? await request.text() : undefined
    })
    
    const respHeaders = new Headers(ghResp.headers)
    respHeaders.set('Access-Control-Allow-Origin', 'https://wysdtsl.github.io')
    respHeaders.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
    respHeaders.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept')
    
    return new Response(ghResp.body, {
      status: ghResp.status,
      headers: respHeaders
    })
  } catch(e) {
    return new Response(JSON.stringify({ error: 'GitHub API unreachable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://wysdtsl.github.io' }
    })
  }
}
