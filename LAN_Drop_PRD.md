# LAN Drop — Product Requirements Document

## 1. Product Overview

**Product Name:** LAN Drop  
**Product Type:** Local Network File Transfer Web Application  
**Target Platform:** Desktop host + mobile/desktop browsers  
**Primary Goal:** Allow devices on the same local network to transfer files through a browser without cloud storage or external file-sharing services.

LAN Drop turns a computer into a lightweight local file server. Devices connected to the same LAN can open a browser, connect to the host, upload files, download files, and manage files stored on the host machine.

---

## 2. Problem Statement

Transferring large files between a phone and a computer often involves cables, cloud storage, messaging applications, USB drives, or third-party services.

These approaches can introduce unnecessary friction:

- Cloud services require uploads to external infrastructure.
- Messaging applications may compress or limit files.
- USB transfers require physical access.
- Third-party services add accounts or external dependencies.
- Existing tools may be unnecessarily complicated for a simple local transfer.

LAN Drop solves this by providing a browser-based transfer interface that works directly over the local network.

---

## 3. Product Vision

Create a simple, fast, self-hosted file transfer utility that makes moving files between nearby devices as easy as opening a webpage.

The core experience should be:

**Start server → Scan QR → Select file → Transfer → Done.**

---

## 4. Goals

### Primary Goals

1. Transfer files between devices on the same LAN.
2. Allow the host computer to act as the storage server.
3. Provide a clean browser-based interface.
4. Support large file transfers using streaming.
5. Show real-time transfer progress.
6. Make mobile connection easy using a QR code.
7. Keep the initial product simple enough to build in approximately 5–6 hours.

### Secondary Goals

1. Provide basic LAN-mode access protection.
2. Allow users to view and delete stored files.
3. Provide useful transfer metadata such as size and speed.
4. Keep the application lightweight and self-hosted.

---

## 5. Non-Goals

The first version will intentionally NOT include:

- Cloud storage
- User accounts
- Social login
- Database-backed file storage
- Public internet hosting
- Full peer-to-peer WebRTC architecture
- Automatic device discovery
- Native Android/iOS applications
- Advanced file synchronization
- End-to-end encryption
- Enterprise authentication
- Complex permissions systems

These may be considered for future versions.

---

## 6. Target Users

### Primary User

A person who wants to quickly transfer files between their own computer and nearby devices on the same Wi-Fi/LAN.

### Example Use Cases

- Sending phone photos to a PC.
- Sending a large video from a PC to a phone.
- Moving project files between two computers.
- Sharing a file temporarily with another trusted device on the same network.
- Transferring a build, ZIP archive, or media file without uploading it to the cloud.

---

## 7. User Stories

### Host

- As a user, I want to start the server and immediately see the connection address.
- As a user, I want to see the QR code for the LAN URL.
- As a user, I want to see which files are currently stored.
- As a user, I want to delete files from the server.

### Client

- As a user, I want to open the LAN URL from my phone or another computer.
- As a user, I want to upload a file using a file picker.
- As a user, I want to drag and drop files where supported.
- As a user, I want to see upload progress.
- As a user, I want to see transfer speed and remaining data.
- As a user, I want to download files stored on the host.

### LAN Security

- As a user, I want a simple PIN when LAN mode is enabled so another device on the network cannot casually access the file manager.

---

## 8. Product Modes

### 8.1 Localhost Mode

The application listens only on localhost.

Example:

```text
http://127.0.0.1:3000
```

Characteristics:

- Host computer only
- No authentication required for the MVP
- Useful for development and single-device use

### 8.2 LAN Mode

The backend listens on the local network interface.

Example:

```text
http://192.168.1.15:3000
```

Characteristics:

- Accessible to devices on the same LAN
- QR code is displayed
- PIN protection should be supported
- Intended for trusted local networks

The application is not intended to be exposed directly to the public internet.

---

## 9. Functional Requirements

### FR-01 — Server Startup

The backend must start successfully and expose the configured port.

The application should display:

- Server status
- Host IP
- Port
- Local URL
- LAN URL when available

### FR-02 — File Upload

Users must be able to select one or more files and upload them to the host.

Requirements:

- Multipart upload support
- File name preservation
- File size tracking
- Upload error handling
- Successful completion notification

### FR-03 — File Download

Users must be able to download any file available in the server's storage directory.

Downloads should be streamed rather than loading complete files into memory.

### FR-04 — File Listing

The application must display available files with:

- Name
- Size
- Type or extension
- Upload time if available
- Download action
- Delete action

### FR-05 — File Deletion

Authorized users must be able to delete files from the server.

The UI should request confirmation before destructive deletion.

### FR-06 — Real-Time Transfer Status

The UI should receive real-time transfer events.

Minimum event types:

```text
upload_started
upload_progress
upload_completed
upload_failed
file_deleted
```

### FR-07 — QR Connection

LAN mode should display a QR code containing the LAN URL.

A mobile device should be able to scan the code and open the application.

### FR-08 — PIN Authentication

When LAN mode protection is enabled:

1. User enters the PIN.
2. Backend validates the PIN.
3. A valid client receives access.
4. Invalid PINs are rejected.

The authentication system should remain intentionally simple for the MVP.

### FR-09 — Responsive Interface

The UI must work on:

- Desktop browsers
- Mobile browsers
- Tablet-sized screens

---

## 10. Non-Functional Requirements

### Performance

- Large files should be handled with streams.
- The server should avoid loading complete large files into memory.
- UI updates should remain responsive during transfers.

### Reliability

- Failed uploads should report an error.
- Interrupted or invalid requests should not crash the server.
- File operations should validate the requested path.

### Usability

- A new user should understand how to connect without documentation.
- Upload and download actions should be obvious.
- Transfer progress should be visible.

### Compatibility

The application should work in modern browsers such as:

- Chrome
- Edge
- Firefox
- Safari where supported

---

## 11. Technical Architecture

```text
                    Local Network
                         │
             ┌───────────┼───────────┐
             │           │           │
           Phone       Laptop      Tablet
             │           │           │
             └───────────┼───────────┘
                         │
                  HTTP + WebSocket
                         │
                         ▼
                 ┌───────────────┐
                 │ Node / Express│
                 │    Server     │
                 └───────┬───────┘
                         │
             ┌───────────┴───────────┐
             │                       │
          REST API               Socket.IO
             │                       │
             ▼                       ▼
       File Operations         Live Events
             │
             ▼
        Local Filesystem
          /uploads
```

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
- Native filesystem APIs/streams

### Optional

- QR code library
- Local network interface detection

---

## 12. API Requirements

### GET /api/files

Returns the files stored by the server.

Example response:

```json
[
  {
    "name": "video.mp4",
    "size": 1840000000,
    "uploadedAt": "2026-08-20T18:00:00.000Z"
  }
]
```

### POST /api/upload

Accepts multipart form data.

Expected behavior:

- Validate input
- Save file
- Emit transfer events
- Return upload result

### GET /api/download/:filename

Streams the selected file to the client.

### DELETE /api/files/:filename

Deletes the selected file after validating the requested path.

### POST /api/auth/pin

Validates the LAN access PIN if PIN protection is enabled.

---

## 13. Data and Storage

The MVP does not require a database.

Files should be stored in a dedicated directory such as:

```text
/server/uploads
```

Metadata can be calculated from the filesystem.

A future version may introduce a database if persistent transfer history or richer metadata becomes necessary.

---

## 14. Error Handling

The application should handle at least:

- File too large
- Unsupported upload request
- Failed file write
- Missing file
- Failed download
- Failed deletion
- Invalid filename/path
- Invalid PIN
- Network interruption
- Server unavailable
- Permission denied

Errors should be shown to users in readable language rather than raw server errors.

---

## 15. Security Requirements

This is a local-network application, so the MVP does not require enterprise-grade authentication.

### Localhost

If the server binds only to localhost:

```text
127.0.0.1
```

authentication is unnecessary for the intended MVP.

### LAN

If the server binds to:

```text
0.0.0.0
```

basic LAN protection should be available.

Minimum recommended protections:

- Optional/required PIN
- Filename/path validation
- Restriction of file operations to the configured storage directory
- Avoid exposing arbitrary filesystem paths
- Reasonable file size limits
- No direct public internet exposure

---

## 16. MVP Scope

The MVP is complete when all of the following work:

- [ ] Node server starts
- [ ] React application loads
- [ ] Host local/LAN URL is shown
- [ ] QR code is available in LAN mode
- [ ] File upload works
- [ ] File download works
- [ ] File deletion works
- [ ] Files are listed
- [ ] Large files are streamed
- [ ] Upload progress is visible
- [ ] Transfer completion/error is shown
- [ ] Application works from a phone on the same network
- [ ] LAN PIN protection works if enabled

---

## 17. Success Criteria

The project is considered successful if:

1. A user can start LAN Drop on a PC.
2. A phone on the same Wi-Fi can connect without installing an app.
3. The phone can upload a large file to the PC.
4. The PC can download a file to the phone.
5. Transfer progress is visible in real time.
6. The application does not require cloud storage.
7. The entire workflow is simple enough to understand without technical instructions.

---

## 18. Future Roadmap

### Version 1.1

- Multiple simultaneous uploads
- Transfer queue
- Pause/resume
- Better transfer statistics
- Custom storage directory

### Version 2

- Automatic device discovery
- mDNS
- File previews
- Folder upload/download
- Transfer history
- Bandwidth limiting

### Version 3

- Desktop wrapper
- Mobile application
- End-to-end encrypted transfers
- Peer-to-peer WebRTC mode
- More advanced device permissions

---

## 19. Development Constraint

The first version should be intentionally small.

The main engineering priority is:

**Reliable local file transfer over a LAN.**

UI polish, advanced discovery, authentication systems, cloud features, and native clients should not be allowed to delay the MVP.
