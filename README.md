# LAN Drop

> Fast, browser-based file transfer over your local network.

LAN Drop turns your computer into a temporary file server. Devices connected to the same Wi-Fi/LAN can open a browser, upload files to the host, download files from it, and manage stored files.

No cloud storage. No account. No external file-sharing service.

---

## Demo Flow

```text
Start LAN Drop
      ↓
Get LAN URL / QR Code
      ↓
Scan from phone
      ↓
Open browser
      ↓
Select file
      ↓
Transfer over LAN
      ↓
File appears on host
```

---

## Features

- Upload files from phones, laptops, and other LAN devices
- Download files from the host
- Delete files
- Drag-and-drop uploads
- Real-time transfer progress
- Transfer speed display
- File size display
- QR-based LAN connection
- Localhost mode
- LAN mode
- Optional PIN protection for LAN access
- Large-file streaming
- Responsive UI

---

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React

### Backend

- Node.js
- Express
- Socket.IO
- Multer
- Node.js filesystem APIs and streams

---

## Architecture

```text
                   Local Network
                        │
             ┌──────────┼──────────┐
             │          │          │
           Phone      Laptop     Tablet
             │          │          │
             └──────────┼──────────┘
                        │
                 HTTP + WebSocket
                        │
                        ▼
               ┌────────────────┐
               │  Node / Express│
               │     Server     │
               └───────┬────────┘
                       │
                ┌──────┴──────┐
                │             │
             REST API      Socket.IO
                │             │
                ▼             ▼
         File operations   Live events
                │
                ▼
          Local filesystem
             /uploads
```

---

## Project Structure

```text
lan-drop/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DeviceInfo.tsx
│   │   │   ├── FileCard.tsx
│   │   │   ├── FileList.tsx
│   │   │   ├── PinAuth.tsx
│   │   │   ├── QRCode.tsx
│   │   │   ├── TransferProgress.tsx
│   │   │   └── UploadZone.tsx
│   │   │
│   │   ├── hooks/
│   │   │   └── useSocket.ts
│   │   │
│   │   ├── pages/
│   │   │   └── Dashboard.tsx
│   │   │
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.ts
│
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   └── files.js
│   │   │
│   │   ├── socket.js
│   │   └── server.js
│   │
│   └── package.json
│
├── .gitignore
├── LAN_Drop_README.md
└── LAN_Drop_PRD.md
```

---

## Requirements

You should have:

- Node.js (v18+)
- npm
- A modern web browser
- Devices connected to the same network for LAN testing

---

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd lan-drop
```

Install frontend dependencies:

```bash
cd client
npm install
```

Install backend dependencies:

```bash
cd ../server
npm install
```

---

## Running the Application

Start the backend:

```bash
cd server
npm run dev
```

Start the frontend in another terminal:

```bash
cd client
npm run dev
```

The frontend runs on `http://localhost:5173` by default.

---

## Localhost Mode

For development, the application can run locally:

```text
http://localhost:5173
```

or:

```text
http://127.0.0.1:5173
```

In this mode, only the host computer needs access to the application.

---

## LAN Mode

To allow other devices on the same network to connect, the backend should listen on:

```text
0.0.0.0
```

Find your computer's local IP address.

Example:

```text
192.168.1.15
```

Another device connected to the same Wi-Fi can then open:

```text
http://192.168.1.15:3000
```

Windows Firewall may ask for permission the first time the server is exposed on the network.

---

## QR Code Connection

LAN Drop can generate a QR code containing the LAN URL.

Example:

```text
http://192.168.1.15:3000
```

A phone can scan the QR code and immediately open the file-transfer interface.

This avoids manually typing a local IP address.

---

## File Transfer

### Upload

```text
Client
  │
  │ POST /api/upload
  ▼
Express
  │
  │ Stream / file handling
  ▼
/uploads
```

### Download

```text
/uploads/file.zip
       │
       ▼
Node Read Stream
       │
       ▼
HTTP Response
       │
       ▼
Client
```

Large files should be streamed rather than read entirely into memory.

---

## API

### List files

```http
GET /api/files
```

### Upload

```http
POST /api/upload
```

Uses multipart form data.

### Download

```http
GET /api/download/:filename
```

### Delete

```http
DELETE /api/files/:filename
```

### PIN authentication

```http
POST /api/auth/pin
```

Used only when LAN PIN protection is enabled.

---

## WebSocket Events

Socket.IO is used for live transfer updates.

```text
upload_started
upload_progress
upload_completed
upload_failed
file_deleted
```

Example UI:

```text
video.mp4

████████████████░░░░ 82%

1.64 GB / 2.00 GB
18.4 MB/s
```

---

## Security

LAN Drop is intended for trusted local networks.

### Localhost

If the server only listens on:

```text
127.0.0.1
```

then it is accessible only from the local machine.

No authentication is required for the intended MVP.

### LAN

If the server listens on:

```text
0.0.0.0
```

other devices on the local network may access it.

For LAN mode, a simple PIN should be used to prevent casual unauthorized access.

LAN Drop should not be exposed directly to the public internet without additional security controls.

The backend should also validate filenames and restrict file operations to the configured upload directory.

---

## Why No Database?

LAN Drop does not need a database for the MVP.

Files live directly in:

```text
server/uploads/
```

Metadata can be derived from the filesystem.

A database only becomes useful if the project later introduces persistent transfer history, users, device permissions, or richer metadata.

---

## Roadmap

### MVP

- [x] Local file server concept
- [ ] Upload
- [ ] Download
- [ ] Delete
- [ ] File listing
- [ ] LAN access
- [ ] QR connection
- [ ] Real-time progress
- [ ] Streaming
- [ ] PIN protection

### Future

- [ ] Multi-file transfer queue
- [ ] Pause/resume
- [ ] Automatic device discovery
- [ ] mDNS
- [ ] Folder transfers
- [ ] File previews
- [ ] Transfer history
- [ ] Bandwidth limiting
- [ ] Custom storage directory
- [ ] Desktop application
- [ ] Mobile application
- [ ] End-to-end encryption
- [ ] WebRTC peer-to-peer mode

---

## Development Philosophy

LAN Drop intentionally keeps the first version small.

The core question is:

> Can two devices reliably transfer a large file over the same LAN through a browser?

Everything else is secondary.

Avoid adding accounts, databases, cloud storage, native apps, or complicated network discovery until the basic transfer pipeline is reliable.

---

## License

MIT
