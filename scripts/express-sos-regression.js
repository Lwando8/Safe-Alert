/**
 * Express SOS regression — legacy emergency path only.
 * Root Expo SOS has cut over to Firestore callables; this script keeps Express healthy
 * for responder-app / historical probes. It does NOT assert mobile cutover.
 *
 * Usage:
 *   EXPRESS_BASE_URL=http://127.0.0.1:4000 node scripts/express-sos-regression.js
 */
const BASE = process.env.EXPRESS_BASE_URL || 'http://127.0.0.1:4000';

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

function record(id, ok, detail) {
  console.log(`${ok ? '✓' : '✗'} ${id}: ${detail}`);
  return { id, ok, detail };
}

async function main() {
  const results = [];

  const health = await req('/health');
  results.push(
    record('health', health.ok && health.json.ok === true, `status=${health.status}`)
  );
  if (!health.ok) {
    console.error('Express server not reachable at', BASE);
    process.exit(2);
  }

  // Citizen register/login (idempotent email)
  const email = `golden_sos_${Date.now()}@example.com`;
  const password = 'TestPass123!';
  const reg = await req('/auth/citizen/register', {
    method: 'POST',
    body: { email, password, fullName: 'Golden SOS', phone: '+27000000000' },
  });
  results.push(
    record(
      'citizen-register',
      reg.ok || reg.status === 409 || /exists|already/i.test(String(reg.json.error || '')),
      `status=${reg.status}`
    )
  );

  const login = await req('/auth/citizen/login', {
    method: 'POST',
    body: { email, password },
  });
  const citizenToken = login.json.token;
  results.push(
    record('citizen-login', login.ok && !!citizenToken, `status=${login.status}`)
  );
  if (!citizenToken) {
    finish(results);
    return;
  }

  const alert = await req('/alerts', {
    method: 'POST',
    token: citizenToken,
    body: {
      type: 'sos',
      location: { latitude: -33.9249, longitude: 18.4241 },
      meta: { source: 'express-sos-regression' },
    },
  });
  // /alerts may be public route or auth — accept either shape
  const alertId =
    alert.json.id ||
    alert.json.alert?.id ||
    alert.json.incident?.id ||
    null;
  results.push(
    record(
      'create-sos-alert',
      (alert.ok || alert.status === 201) && !!alertId,
      `status=${alert.status} alertId=${alertId}`
    )
  );

  // Public unauthenticated path (mounted at /alerts/public)
  const publicAlert = await req('/alerts/public', {
    method: 'POST',
    body: {
      type: 'sos',
      location: { latitude: -33.93, longitude: 18.42 },
      meta: { source: 'express-sos-regression-public' },
    },
  });
  const publicId =
    publicAlert.json.id ||
    publicAlert.json.alert?.id ||
    publicAlert.json.incident?.id ||
    null;
  results.push(
    record(
      'create-sos-public',
      (publicAlert.ok || publicAlert.status === 201) && !!publicId,
      `status=${publicAlert.status} alertId=${publicId}`
    )
  );

  // Responder login + accept (uses seeded unit if present)
  const responderLogin = await req('/auth/responder/login', {
    method: 'POST',
    body: {
      loginId: 'ALPHA-12',
      password: 'unit123',
      deviceId: 'regression-device',
      deviceModel: 'probe',
    },
  });
  const responderToken = responderLogin.json.token;
  results.push(
    record(
      'responder-login',
      responderLogin.ok && !!responderToken,
      `status=${responderLogin.status}`
    )
  );

  if (responderToken && alertId) {
    const shift = await req('/responder/shift/start', {
      method: 'POST',
      token: responderToken,
      body: { primaryOfficerId: 'officer-1', pin: 'unit123' },
    });
    results.push(
      record(
        'responder-shift-start',
        shift.ok || shift.status === 200 || shift.status === 201,
        `status=${shift.status}`
      )
    );

    const accept = await req(`/responder/incidents/${alertId}/accept`, {
      method: 'POST',
      token: responderToken,
    });
    results.push(
      record(
        'responder-accept',
        accept.ok || accept.status === 200 || accept.status === 409,
        `status=${accept.status} ${accept.json.error || ''}`
      )
    );
    const statusUpdate = await req(`/responder/incidents/${alertId}/status`, {
      method: 'POST',
      token: responderToken,
      body: { status: 'en_route' },
    });
    results.push(
      record(
        'responder-status',
        statusUpdate.ok || statusUpdate.status === 200,
        `status=${statusUpdate.status}`
      )
    );
  }

  const nearby = await req(
    `/responder/map/nearby?latitude=-33.9249&longitude=18.4241&radiusKm=50`,
    { token: responderToken }
  );
  results.push(
    record(
      'responder-nearby',
      nearby.status !== 500,
      `status=${nearby.status}`
    )
  );

  results.push(
    record(
      'firestore-untouched',
      true,
      'This script only hits Express; Firestore SOS cutover NOT performed'
    )
  );

  finish(results);
}

function finish(results) {
  const failed = results.filter(r => !r.ok);
  console.log(
    JSON.stringify(
      {
        summary: {
          total: results.length,
          passed: results.length - failed.length,
          failed: failed.length,
        },
        results,
      },
      null,
      2
    )
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
