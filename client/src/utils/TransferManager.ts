/**
 * TransferManager — handles the multi-file upload queue with pause/resume/cancel.
 *
 * Files are uploaded in chunks to support pause/resume.
 * Optional AES-GCM encryption is applied before upload.
 *
 * Singleton pattern: one manager instance is shared across React components.
 */

import {
  generateKey,
  exportKey,
  importKey,
  encryptFile,
} from './encryption';

// ── Status constants ──────────────────────────────────────────────────
export const STATUS_QUEUED = 'queued';
export const STATUS_UPLOADING = 'uploading';
export const STATUS_PAUSED = 'paused';
export const STATUS_COMPLETED = 'completed';
export const STATUS_ERROR = 'error';
export const STATUS_CANCELLED = 'cancelled';

// 256 KB chunk size for unencrypted uploads; encrypted uploads use 64 KB
const CHUNK_SIZE_UNENCRYPTED = 256 * 1024;
const CHUNK_SIZE_ENCRYPTED = 64 * 1024;

// ── Transfer interface ────────────────────────────────────────────────
export interface Transfer {
  id: string;
  fileName: string;
  fileSize: number;
  status: string;
  progress: number;
  bytesUploaded: number;
  speed: number;
  uploadId: string | null;
  fileRef: File;
  folder: string;
  _startTime: number | null;
  _lastBytes: number;
  _lastTime: number | null;
}

type Listener = (transfers: Transfer[]) => void;

// ── Singleton ─────────────────────────────────────────────────────────
let _managerInstance: TransferManager | null = null;

export function getTransferManager(): TransferManager {
  if (!_managerInstance) {
    _managerInstance = new TransferManager();
  }
  return _managerInstance;
}

// ── TransferManager class ─────────────────────────────────────────────
class TransferManager {
  private _transfers: Map<string, Transfer> = new Map();
  private _queue: string[] = [];
  private _processing = false;
  private _activeId: string | null = null;
  private _encryptedFiles: Set<string> = new Set();
  private _listeners: Listener[] = [];
  private _encryptionKey: CryptoKey | null = null;
  private _abortController: AbortController | null = null;

  constructor() {
    // Restore encrypted-files set from sessionStorage
    try {
      const saved = sessionStorage.getItem('lan-drop-encrypted-files');
      if (saved) {
        JSON.parse(saved).forEach((f: string) => this._encryptedFiles.add(f));
      }
    } catch { /* ignore */ }
  }

  // ── Public API ──────────────────────────────────────────────────────

  /** Subscribe to state changes. Returns an unsubscribe function. */
  onUpdate(listener: Listener): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  /** Add one or more File objects to the upload queue. */
  addFiles(files: FileList): void {
    this._addFilesToQueue(files, '');
  }

  /** Add files with a shared folder prefix (for folder uploads). */
  addFilesWithFolder(files: FileList, folder: string): void {
    this._addFilesToQueue(files, folder);
  }

  private _addFilesToQueue(files: FileList, folder: string): void {
    const fileArr = Array.from(files);
    fileArr.forEach((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // For folder uploads, extract relative path from webkitRelativePath
      const relPath = (file as any).webkitRelativePath || '';
      const fileFolder = folder || (relPath ? relPath.substring(0, relPath.lastIndexOf('/')) : '');
      this._transfers.set(id, {
        id,
        fileName: file.name,
        fileSize: file.size,
        status: STATUS_QUEUED,
        progress: 0,
        bytesUploaded: 0,
        speed: 0,
        uploadId: null,
        fileRef: file,
        folder: fileFolder,
        _startTime: null,
        _lastBytes: 0,
        _lastTime: null,
      });
      this._queue.push(id);
    });
    this._emit();
    this._processQueue();
  }

  /** Pause an active or queued transfer. */
  pause(id: string): void {
    const t = this._transfers.get(id);
    if (!t) return;

    if (t.status === STATUS_QUEUED) {
      t.status = STATUS_PAUSED;
      this._queue = this._queue.filter((qid) => qid !== id);
      this._emit();
      return;
    }

    if (t.status === STATUS_UPLOADING) {
      // Abort the in-flight XHR
      if (this._abortController) {
        this._abortController.abort();
      }
      t.status = STATUS_PAUSED;
      if (this._activeId === id) this._activeId = null;
      this._emit();
      return;
    }
  }

  /** Resume a paused transfer — re-queues it at the front. */
  resume(id: string): void {
    const t = this._transfers.get(id);
    if (!t || t.status !== STATUS_PAUSED) return;

    t.status = STATUS_QUEUED;
    this._queue.unshift(id);
    this._emit();
    this._processQueue();
  }

  /** Cancel a transfer. If uploading, abort + clean up server chunks. */
  cancel(id: string): void {
    const t = this._transfers.get(id);
    if (!t) return;

    if (t.status === STATUS_UPLOADING && this._abortController) {
      this._abortController.abort();
    }

    if (t.uploadId) {
      fetch(`/api/upload/cancel/${encodeURIComponent(t.uploadId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }

    this._queue = this._queue.filter((qid) => qid !== id);
    this._transfers.delete(id);
    if (this._activeId === id) this._activeId = null;
    this._emit();
    this._processQueue();
  }

  /** Return true if any transfer is actively uploading or queued. */
  isUploading(): boolean {
    return Array.from(this._transfers.values()).some(
      (t) => t.status === STATUS_UPLOADING || t.status === STATUS_QUEUED
    );
  }

  /** Check whether a filename is known to be encrypted. */
  isEncrypted(filename: string): boolean {
    return this._encryptedFiles.has(filename);
  }

  /** Return current transfers as an array. */
  getTransfers(): Transfer[] {
    return Array.from(this._transfers.values());
  }

  /** Return the set of filenames known to be encrypted. */
  getEncryptedFiles(): Set<string> {
    return this._encryptedFiles;
  }

  // ── Encryption key management ───────────────────────────────────────

  /** Generate a fresh encryption key and store in sessionStorage. */
  async enableEncryption(): Promise<void> {
    const key = await generateKey();
    const exported = await exportKey(key);
    sessionStorage.setItem('lan-drop-encryption-key', exported);
    this._encryptionKey = key;
  }

  /** Load encryption key from sessionStorage (called on mount). */
  async loadEncryptionKey(): Promise<void> {
    const exported = sessionStorage.getItem('lan-drop-encryption-key');
    if (exported) {
      this._encryptionKey = await importKey(exported);
    }
  }

  /** Disable encryption and clear stored key. */
  disableEncryption(): void {
    this._encryptionKey = null;
    sessionStorage.removeItem('lan-drop-encryption-key');
  }

  /** Returns true if encryption is enabled. */
  hasEncryption(): boolean {
    return this._encryptionKey !== null;
  }

  /** Get the current encryption key (or null). */
  getEncryptionKey(): CryptoKey | null {
    return this._encryptionKey;
  }

  // ── Internal ────────────────────────────────────────────────────────

  private _emit(): void {
    const snapshot = this.getTransfers();
    this._listeners.forEach((fn) => fn(snapshot));
  }

  private async _processQueue(): Promise<void> {
    if (this._processing) return;
    this._processing = true;

    while (this._queue.length > 0) {
      const id = this._queue.shift()!;
      const t = this._transfers.get(id);
      if (!t || t.status !== STATUS_QUEUED) continue;

      this._activeId = id;
      t.status = STATUS_UPLOADING;
      this._emit();

      try {
        await this._uploadFile(t);
        // Completed or paused — don't move to next until re-queued
        if (t.status !== STATUS_PAUSED) {
          t.status = STATUS_COMPLETED;
          this._emit();
        }
      } catch (err) {
        if (t.status === STATUS_PAUSED) {
          // Paused — stop the queue, wait for resume
          break;
        }
        console.error('Upload error:', err);
        t.status = STATUS_ERROR;
        this._emit();
      }

      this._activeId = null;
    }

    this._processing = false;
  }

  private async _uploadFile(transfer: Transfer): Promise<void> {
    const { id, fileName, fileSize, fileRef } = transfer;

    const encrypted = this.hasEncryption();
    const chunkSize = encrypted ? CHUNK_SIZE_ENCRYPTED : CHUNK_SIZE_UNENCRYPTED;
    const totalChunks = Math.ceil(fileSize / chunkSize);
    const uploadId = `${id}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    transfer.uploadId = uploadId;

    // Check for existing upload status (resume)
    let startChunk = 0;
    try {
      const statusRes = await fetch(
        `/api/upload/status/${encodeURIComponent(uploadId)}`
      );
      if (statusRes.ok) {
        const status = await statusRes.json();
        startChunk = status.receivedChunks;
        if (startChunk >= totalChunks) {
          transfer.bytesUploaded = fileSize;
          transfer.progress = 100;
          this._emit();
          return; // Already complete
        }
      }
    } catch {
      /* no prior upload */
    }

    // Init upload
    const initRes = await fetch('/api/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        filename: fileName,
        totalChunks,
        fileSize,
        encrypted,
        folder: transfer.folder || undefined,
      }),
    });

    if (!initRes.ok) {
      const data = await initRes.json();
      if (data.completed) {
        // File already exists on server
        transfer.bytesUploaded = fileSize;
        transfer.progress = 100;
        this._emit();
        return;
      }
      throw new Error(data.error || 'Failed to init upload');
    }

    // Upload chunks
    for (let i = startChunk; i < totalChunks; i++) {
      // Check if paused/cancelled
      if (transfer.status !== STATUS_UPLOADING) return;

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);
      let slice: Uint8Array = new Uint8Array(
        await fileRef.slice(start, end).arrayBuffer()
      );

      // Encrypt chunk if needed
      if (encrypted && this._encryptionKey) {
        const encryptedChunks = await encryptFile(
          this._encryptionKey,
          fileRef.slice(start, end)
        );
        slice = encryptedChunks[0];
      }

      const controller = new AbortController();
      this._abortController = controller;

      const res = await fetch(
        `/api/upload/chunk?uploadId=${encodeURIComponent(uploadId)}&index=${i}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: slice as unknown as BodyInit,
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        throw new Error('Chunk upload failed');
      }

      const result = await res.json();

      // Update progress
      transfer.bytesUploaded = end;
      transfer.progress = (end / fileSize) * 100;

      // Calculate speed
      const now = Date.now();
      if (transfer._lastTime) {
        const elapsed = (now - transfer._lastTime) / 1000;
        const bytesDiff = end - transfer._lastBytes;
        if (elapsed > 0) {
          transfer.speed = bytesDiff / elapsed;
        }
      }
      transfer._lastBytes = end;
      transfer._lastTime = now;

      this._emit();

      if (result.status === 'completed') {
        // Server assembled the file
        this._encryptedFiles.add(fileName);
        this._persistEncryptedFiles();
        return;
      }
    }
  }

  private _persistEncryptedFiles(): void {
    try {
      sessionStorage.setItem(
        'lan-drop-encrypted-files',
        JSON.stringify(Array.from(this._encryptedFiles))
      );
    } catch {
      /* ignore */
    }
  }
}

export default TransferManager;
