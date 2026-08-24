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
- Folder uploads
- Real-time transfer progress
- Transfer speed display
- File size display
- Multi-file transfer queue with pause/resume
- QR-based LAN connection
- mDNS device discovery
- Localhost mode
- LAN mode
- Optional PIN protection for LAN access
- Large-file streaming
- End-to-end encryption (AES-GCM)
- Bandwidth limiting (upload/download)
- Custom storage directory
- Transfer history
- File previews (image, video, audio, PDF, text)
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
│   │   │   ├── FilePreview.tsx
│   │   │   ├── PinAuth.tsx
│   │   │   ├── QRCode.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── TransferHistory.tsx
│   │   │   ├── TransferProgress.tsx
│   │   │   ├── TransferQueue.tsx
│   │   │   └── UploadZone.tsx
│   │   │
│   │   ├── hooks/
│   │   │   └── useSocket.ts
│   │   │
│   │   ├── pages/
│   │   │   └── Dashboard.tsx
│   │   │
│   │   ├── utils/
│   │   │   ├── TransferManager.ts
│   │   │   └── encryption.ts
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
│   │   │   ├── config.js
│   │   │   ├── files.js
│   │   │   └── history.js
│   │   │
│   │   ├── bandwidth.js
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

### Upload (multipart)

```http
POST /api/upload
```

Uses multipart form data.

### Chunked upload (with pause/resume)

```http
POST /api/upload/init          # Initialize upload
POST /api/upload/chunk?uploadId=&index=  # Send chunk
GET  /api/upload/status/:uploadId  # Check resume state
DELETE /api/upload/cancel/:uploadId  # Cancel upload
```

### Download

```http
GET /api/download/:filename
```

### Delete

```http
DELETE /api/files/:filename
```

### Configuration

```http
GET  /api/config               # Get current settings
PUT  /api/config               # Update settings (bandwidth, storage dir)
```

### Transfer history

```http
GET    /api/history            # List past transfers
DELETE /api/history            # Clear history
DELETE /api/history/:id        # Delete single entry
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
- [x] Upload
- [x] Download
- [x] Delete
- [x] File listing
- [x] LAN access
- [x] QR connection
- [x] Real-time progress
- [x] Streaming
- [x] PIN protection

### Future

- [x] Multi-file transfer queue
- [x] Pause/resume
- [x] mDNS
- [x] Folder transfers
- [x] File previews
- [x] Transfer history
- [x] Bandwidth limiting
- [x] Custom storage directory
- [ ] Desktop application
- [ ] Mobile application
- [x] End-to-end encryption

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
