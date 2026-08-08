const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');

// Load server/.env (Express Clerk compat secrets) without adding a dotenv dependency.
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eq = trimmed.indexOf('=');
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  }
} catch {
  // ignore
}

const { seedIfEmpty } = require('./lib/seed');
const dispatch = require('./lib/dispatch');
const store = require('./lib/store');

const authRoutes = require('./routes/auth');
const incidentRoutes = require('./routes/incidents');
const responderRoutes = require('./routes/responder');
const adminRoutes = require('./routes/admin');
const analytics = require('./lib/analytics');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 4000;

seedIfEmpty();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const alertSubscriptions = new Map();
const globalSubscribers = new Set();

const broadcastToAlert = (alertId, payload) => {
  const subs = alertSubscriptions.get(alertId);
  if (subs) {
    subs.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });
  }
  globalSubscribers.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  });
};

dispatch.setBroadcastHandlers({ broadcast: broadcastToAlert, subscribers: globalSubscribers });

const addSubscription = (ws, alertId) => {
  if (!alertSubscriptions.has(alertId)) {
    alertSubscriptions.set(alertId, new Set());
  }
  alertSubscriptions.get(alertId).add(ws);
};

const removeSubscription = ws => {
  alertSubscriptions.forEach(set => set.delete(ws));
  globalSubscribers.delete(ws);
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'seren-alert-dispatch', version: 2 });
});

app.use('/auth', authRoutes);
app.use('/incidents', incidentRoutes);
app.use('/alerts', incidentRoutes);
app.use('/responder', responderRoutes);
app.use('/admin', adminRoutes);

// Legacy unauthenticated alert creation (dev / backward compat)
app.post('/alerts', (req, res, next) => {
  req.url = '/public';
  incidentRoutes(req, res, next);
});

app.post('/responders/heartbeat', (req, res) => {
  const { id, name, role, status, latitude, longitude, providerId } = req.body || {};
  if (!id || !role) {
    return res.status(400).json({ error: 'id and role are required' });
  }
  store.setLiveResponder(id, {
    id,
    name: name || id,
    role,
    status: status || 'available',
    providerId: providerId || null,
    location:
      latitude != null && longitude != null ? { lat: latitude, lng: longitude } : undefined,
    lastSeenAt: store.now(),
  });
  res.json({ ok: true });
});

app.get('/analytics/summary', (req, res) => {
  res.json(analytics.computeResponseMetrics());
});

app.get('/health', (_req, res) => res.json({ ok: true, version: 2 }));

wss.on('connection', ws => {
  ws.on('message', message => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === 'subscribe' && parsed.alertId) {
        addSubscription(ws, parsed.alertId);
        const incident = store.getIncident(parsed.alertId);
        if (incident) {
          ws.send(JSON.stringify({ event: 'alert_snapshot', alert: incident }));
        }
      }
      if (parsed.type === 'subscribe_all') {
        globalSubscribers.add(ws);
        ws.send(
          JSON.stringify({
            event: 'welcome',
            alerts: store.listIncidents(),
          })
        );
      }
    } catch (err) {
      console.error('WS message error', err);
    }
  });
  ws.on('close', () => removeSubscription(ws));
  ws.on('error', () => removeSubscription(ws));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Seren Alert Dispatch API v2 on http://0.0.0.0:${PORT}`);
  console.log('Citizen:  demo@safealert.com / demo123  (Auth → Citizen)');
  console.log('Unit:     ALPHA-12 / unit123            (Auth → Responder unit)');
  console.log('Admin:    dispatch@safealert.com / admin123');
});
