require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const filesRouter = require('./routes/files');
const { setupSocket } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
  },
});

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  req.io = io;
  next();
});

app.use('/api', filesRouter);

app.use('/uploads', express.static(uploadsDir));

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

setupSocket(io);

function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();

  if (process.env.LAN_IP) {
    return process.env.LAN_IP;
  }

  const virtualKeywords = [
    'virtualbox', 'vmware', 'hyper-v', 'docker', 'wsl',
    'veth', 'br-', 'lo', 'utun', 'tun', 'tap',
    'pseudo', 'loopback', 'isatap', 'teredo', '6to4'
  ];

  const preferredNames = ['ethernet', 'wi-fi', 'wlan', 'wireless', 'lan', 'local area connection'];

  let fallbackIP = '127.0.0.1';

  for (const name of Object.keys(nets)) {
    const lowerName = name.toLowerCase();
    const isVirtual = virtualKeywords.some(kw => lowerName.includes(kw));
    if (isVirtual) continue;

    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        const isPreferred = preferredNames.some(pn => lowerName.includes(pn));
        if (isPreferred) return net.address;
        if (fallbackIP === '127.0.0.1') fallbackIP = net.address;
      }
    }
  }

  return fallbackIP;
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log('\nLAN Drop Server Started\n');
  console.log(`  Local:    http://127.0.0.1:${PORT}`);
  console.log(`  LAN:      http://${localIP}:${PORT}`);
  console.log(`\n  IP:       ${localIP}`);
  console.log(`  Port:     ${PORT}\n`);
});

module.exports = { app, server, io };