// Health check API route

export default function handler(req, res) {
  // Set CORS headers to allow health checks from any source
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Plain text response is safer for health checks
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send('OK');
}
