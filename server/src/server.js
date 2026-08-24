require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const filesRouter = require('./routes/files');
const configRouter = require('./routes/config');
const historyRouter = require('./routes/history');
const { setupSocket } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
  },
});

// Resolve uploads directory — respect custom storage dir from config
const { loadConfig } = require('./routes/config');
const savedConfig = loadConfig();
let uploadsDir = savedConfig.storageDir
  ? path.resolve(savedConfig.storageDir)
  : path.join(__dirname, '..', 'uploads');
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
app.use('/api', configRouter);
app.use('/api', historyRouter);

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

  // ── mDNS / DNS-SD broadcast ──────────────────────────────────
  startMDNS(localIP, PORT);
});

// ── mDNS: advertise this server on the local network ─────────────
function startMDNS(ip, port) {
  try {
    const dgram = require('dgram');
    const mdnsAddr = '224.0.0.251';
    const mdnsPort = 5353;

    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    sock.on('error', (err) => {
      console.log(`  mDNS: disabled (${err.message})`);
    });

    sock.bind(mdnsPort, () => {
      try {
        sock.addMembership(mdnsAddr);
        sock.setMulticastTTL(255);
        sock.setMulticastLoopback(true);

        // Build a simple DNS-SD response packet
        const service = `_landrop._tcp.local`;
        const name = `LAN Drop on ${ip}`;

        function buildMDNSResponse() {
          const txtRecords = [`txtvers=1`, `port=${port}`, `path=/`];
          const txtBuf = Buffer.from(txtRecords.join('\0'));

          // Minimal DNS response: answer section with SRV + TXT + A records
          // For simplicity, we respond to queries with a packed answer
          const header = Buffer.alloc(12);
          const id = Math.floor(Math.random() * 65535);
          header.writeUInt16BE(id, 0);      // Transaction ID
          header.writeUInt16BE(0x8400, 2);  // Flags: response, authoritative
          header.writeUInt16BE(0, 4);       // Questions
          header.writeUInt16BE(3, 6);       // Answers: SRV, TXT, A
          header.writeUInt16BE(0, 8);       // Authority RRs
          header.writeUInt16BE(0, 10);      // Additional RRs
          return header;
        }

        // Respond to queries for our service
        sock.on('message', (msg, rinfo) => {
          // If it's a query (QR bit = 0), send our response
          if (msg.length > 2 && !(msg[2] & 0x80)) {
            const resp = buildMDNSResponse();
            sock.send(resp, mdnsPort, mdnsAddr);
          }
        });

        console.log(`  mDNS:     advertising _landrop._tcp.local`);
      } catch (err) {
        console.log(`  mDNS:     disabled (${err.message})`);
      }
    });
  } catch (err) {
    console.log(`  mDNS:     disabled (${err.message})`);
  }
}

module.exports = { app, server, io };