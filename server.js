const express = require('express');
const path = require('path');

const list = (value) => value.split(',').map((v) => v.trim()).filter(Boolean);

const PORT = parseInt(process.env.PORT || '8080', 10);
const CAPTURE_PATHS = list(process.env.CAPTURE_PATHS || '/test');
const CAPTURE_METHODS = list(process.env.CAPTURE_METHODS || 'POST').map((m) => m.toUpperCase());
const MAX_REQUESTS = parseInt(process.env.MAX_REQUESTS || '500', 10);
const MAX_BODY = process.env.MAX_BODY || '10mb';
const RESPONSE_STATUS = parseInt(process.env.RESPONSE_STATUS || '200', 10);

const captureAllMethods = CAPTURE_METHODS.includes('ALL') || CAPTURE_METHODS.includes('*');
const TEXT_TYPES = /json|text|xml|x-www-form-urlencoded|javascript|graphql/i;

const app = express();
app.disable('x-powered-by');

const requests = [];
const clients = new Set();
let seq = 0;

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

function decodeBody(buffer, contentType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { size: 0, encoding: 'none', raw: '', parsed: null };
  }
  if (!contentType || TEXT_TYPES.test(contentType)) {
    const raw = buffer.toString('utf8');
    let parsed = null;
    if (/json/i.test(contentType || '') || /^\s*[{[]/.test(raw)) {
      try { parsed = JSON.parse(raw); } catch { /* no es JSON válido */ }
    } else if (/x-www-form-urlencoded/i.test(contentType)) {
      parsed = Object.fromEntries(new URLSearchParams(raw));
    }
    return { size: buffer.length, encoding: 'utf8', raw, parsed };
  }
  return { size: buffer.length, encoding: 'base64', raw: buffer.toString('base64'), parsed: null };
}

// ---------- Panel /info ----------
app.get('/info', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/info/api/config', (req, res) => {
  res.json({ paths: CAPTURE_PATHS, methods: captureAllMethods ? ['ALL'] : CAPTURE_METHODS, maxRequests: MAX_REQUESTS });
});

app.get('/info/api/requests', (req, res) => res.json(requests));

app.delete('/info/api/requests', (req, res) => {
  requests.length = 0;
  broadcast('cleared', {});
  res.status(204).end();
});

app.get('/info/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('retry: 3000\n\n');
  clients.add(res);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

// ---------- Endpoint(s) capturados ----------
app.all(CAPTURE_PATHS, express.raw({ type: () => true, limit: MAX_BODY }), (req, res, next) => {
  if (!captureAllMethods && !CAPTURE_METHODS.includes(req.method)) return next();

  const contentType = req.get('content-type') || '';
  const entry = {
    id: ++seq,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    query: req.query,
    source: {
      ip: req.socket.remoteAddress,
      port: req.socket.remotePort,
      forwardedFor: req.get('x-forwarded-for') || null,
      realIp: req.get('x-real-ip') || null,
      host: req.get('host') || null,
      origin: req.get('origin') || null,
      referer: req.get('referer') || null,
      userAgent: req.get('user-agent') || null,
    },
    contentType,
    headers: req.headers,
    body: decodeBody(req.body, contentType),
  };

  requests.unshift(entry);
  if (requests.length > MAX_REQUESTS) requests.length = MAX_REQUESTS;
  broadcast('request', entry);

  console.log(`[${entry.timestamp}] ${entry.method} ${entry.url} desde ${entry.source.ip} (${entry.body.size} bytes)`);
  res.status(RESPONSE_STATUS).json({ status: 'received', id: entry.id });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Body demasiado grande' });
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

app.listen(PORT, () => {
  console.log(`request-viewer escuchando en puerto ${PORT}`);
  console.log(`Capturando ${captureAllMethods ? 'ALL' : CAPTURE_METHODS.join(',')} en: ${CAPTURE_PATHS.join(', ')}`);
  console.log(`Panel: http://localhost:${PORT}/info`);
});
