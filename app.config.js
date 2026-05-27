const appJson = require('./app.json');

function getLanIp() {
  const os = require('os');
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

const lanIp = getLanIp();
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (lanIp ? `http://${lanIp}:4000` : 'http://localhost:4000');

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      apiBaseUrl,
      lanIp,
    },
  },
};
