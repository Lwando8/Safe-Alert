const store = require('./store');

const ROLES = {
  CITIZEN: 'CITIZEN',
  RESPONDER_UNIT: 'RESPONDER_UNIT',
  DISPATCHER: 'DISPATCHER',
  SUPER_ADMIN: 'SUPER_ADMIN',
};

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.DISPATCHER];

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function resolveSession(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const session = store.getSession(token);
  if (!session) return null;
  return { token, ...session };
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  const session = token ? store.getSession(token) : null;
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.auth = { token, ...session };
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    const token = getBearerToken(req);
    const session = token ? store.getSession(token) : null;
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(session.role)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INSUFFICIENT_ROLE' });
    }
    req.auth = { token, ...session };
    next();
  };
}

function requireCitizen(req, res, next) {
  return requireRoles(ROLES.CITIZEN)(req, res, next);
}

function requireResponder(req, res, next) {
  return requireRoles(ROLES.RESPONDER_UNIT)(req, res, next);
}

function requireAdmin(req, res, next) {
  return requireRoles(...ADMIN_ROLES)(req, res, next);
}

function requireSuperAdmin(req, res, next) {
  return requireRoles(ROLES.SUPER_ADMIN)(req, res, next);
}

function forbidCitizenFromResponderData(req, res, next) {
  const session = resolveSession(req);
  if (session?.role === ROLES.CITIZEN) {
    return res.status(403).json({
      error: 'Citizens cannot access operational dispatch data',
      code: 'CITIZEN_FORBIDDEN',
    });
  }
  next();
}

module.exports = {
  ROLES,
  ADMIN_ROLES,
  getBearerToken,
  resolveSession,
  requireAuth,
  requireRoles,
  requireCitizen,
  requireResponder,
  requireAdmin,
  requireSuperAdmin,
  forbidCitizenFromResponderData,
};
