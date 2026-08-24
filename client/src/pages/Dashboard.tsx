import { useEffect, useState, useCallback } from 'react';
import { HardDrive, LogOut } from 'lucide-react';
import DeviceInfo from '../components/DeviceInfo';
import QRCodeDisplay from '../components/QRCode';
import UploadZone from '../components/UploadZone';
import TransferQueue from '../components/TransferQueue';
import FileList from '../components/FileList';
import FilePreview from '../components/FilePreview';
import TransferHistory from '../components/TransferHistory';
import SettingsPanel from '../components/SettingsPanel';
import PinAuth from '../components/PinAuth';
import { useSocket, TransferEvent } from '../hooks/useSocket';
import { getTransferManager } from '../utils/TransferManager';
import type { Transfer } from '../utils/TransferManager';
import { decryptPackedChunk } from '../utils/encryption';

interface FileItem {
  name: string;
  size: number;
  uploadedAt: string;
}

export default function Dashboard() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [serverUrl, setServerUrl] = useState('');
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinRequired, setPinRequired] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem('lan-drop-auth') === 'true'
  );
  const [queueTransfers, setQueueTransfers] = useState<Transfer[]>([]);
  const [previewFile, setPreviewFile] = useState<string | null>(null);

  // ── TransferManager singleton ─────────────────────────────────────
  const manager = getTransferManager();

  // Sync manager state → React
  useEffect(() => {        return manager.onUpdate((transfers: Transfer[]) => {
          setQueueTransfers(transfers);
        });
  }, [manager]);

  // Always enable encryption on mount
  useEffect(() => {
    manager.loadEncryptionKey().then(async () => {
      if (!manager.hasEncryption()) {
        await manager.enableEncryption();
      }
    });
  }, [manager]);

  // ── Auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => {
        setPinRequired(data.pinEnabled);
        if (!data.pinEnabled) {
          setAuthenticated(true);
        }
      })
      .catch(() => {
        setPinRequired(false);
        setAuthenticated(true);
      });
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('lan-drop-auth');
    setAuthenticated(false);
  }, []);

  // ── Socket events ─────────────────────────────────────────────────
  const {
    onUploadCompleted,
    onFileDeleted,
    onUploadStarted,
    onUploadFailed,
    offUploadCompleted,
    offFileDeleted,
    offUploadStarted,
    offUploadFailed,
  } = useSocket();

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        setFiles(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  }, []);

  useEffect(() => {
    fetch('/api/info')
      .then((res) => res.json())
      .then((info) => {
        setServerUrl(info.lanUrl);
      })
      .catch(() => setServerUrl(window.location.href));
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    const handleUploadCompleted = (file: TransferEvent) => {
      if (file.name && file.uploadedAt) {
        setFiles((prev) => [
          { name: file.name!, size: file.size || 0, uploadedAt: file.uploadedAt! },
          ...prev,
        ]);
      }
    };

    const handleFileDeleted = (file: TransferEvent) => {
      if (file.name) {
        setFiles((prev) => prev.filter((f) => f.name !== file.name));
      }
    };

    const handleUploadStarted = (_data: TransferEvent) => {};

    const handleUploadFailed = (data: TransferEvent) => {
      if (data.error) {
        setError(String(data.error));
      }
    };

    onUploadCompleted(handleUploadCompleted);
    onFileDeleted(handleFileDeleted);
    onUploadStarted(handleUploadStarted);
    onUploadFailed(handleUploadFailed);

    return () => {
      offUploadCompleted(handleUploadCompleted);
      offFileDeleted(handleFileDeleted);
      offUploadStarted(handleUploadStarted);
      offUploadFailed(handleUploadFailed);
    };
  }, [onUploadCompleted, onFileDeleted, onUploadStarted, onUploadFailed, offUploadCompleted, offFileDeleted, offUploadStarted, offUploadFailed]);

  // ── Upload handler (delegates to TransferManager) ─────────────────
  const handleUpload = useCallback(
    async (fileList: FileList) => {
      setError(null);
      manager.addFiles(fileList);
    },
    [manager]
  );

  // ── Folder upload handler ──────────────────────────────────────
  const handleFolderUpload = useCallback(
    async (fileList: FileList) => {
      setError(null);
      // Files from webkitdirectory have webkitRelativePath set
      // The TransferManager will queue them; we pass the folder info via addFilesWithFolder
      const files = Array.from(fileList);
      // Extract common prefix to determine folder name
      const firstPath = files[0]?.webkitRelativePath || '';
      const folderName = firstPath.split('/')[0] || '';
      manager.addFilesWithFolder(fileList, folderName);
    },
    [manager]
  );

  // ── Encrypted download handler ────────────────────────────────────
  const handleDownloadEncrypted = useCallback(
    async (filename: string) => {
      try {
        const res = await fetch(`/api/download/${encodeURIComponent(filename)}`);
        if (!res.ok) throw new Error('Download failed');
        const buffer = await res.arrayBuffer();
        const packed = new Uint8Array(buffer);

        // The encrypted file is a concatenation of packed chunks.
        // Each packed chunk: [12-byte IV][4-byte length (BE)][encrypted data]
        const key = manager.getEncryptionKey();
        if (!key) {
          throw new Error('Encryption key not available');
        }

        // Decrypt all packed chunks and concatenate
        const plaintextChunks: Uint8Array[] = [];
        let offset = 0;
        while (offset < packed.length) {
          if (offset + 16 > packed.length) break;
          const dataLen = new DataView(packed.buffer, packed.byteOffset + offset + 12, 4).getUint32(false as unknown as number);
          const decrypted = await decryptPackedChunk(key, packed.slice(offset, offset + 16 + dataLen));
          plaintextChunks.push(decrypted);
          offset += 16 + dataLen;
        }

        // Combine and trigger download
        const totalLen = plaintextChunks.reduce((sum, c) => sum + c.length, 0);
        const result = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of plaintextChunks) {
          result.set(chunk, pos);
          pos += chunk.length;
        }

        const blob = new Blob([result]);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(`Decrypted download failed: ${err instanceof Error ? err.message : err}`);
      }
    },
    [manager]
  );

  // ── Delete handler ────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (filename: string) => {
      if (!confirm(`Delete "${filename}"?`)) return;

      setDeletingFile(filename);
      try {
        const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setFiles((prev) => prev.filter((f) => f.name !== filename));
        }
      } catch (err) {
        setError('Failed to delete file');
      } finally {
        setDeletingFile(null);
      }
    },
    []
  );

  // ── Queue actions ─────────────────────────────────────────────────
  const handlePause = useCallback((id: string) => manager.pause(id), [manager]);
  const handleResume = useCallback((id: string) => manager.resume(id), [manager]);
  const handleCancel = useCallback((id: string) => manager.cancel(id), [manager]);

  // ── Pre-auth screens ──────────────────────────────────────────────
  if (pinRequired && !authenticated) {
    return <PinAuth onAuthenticated={() => setAuthenticated(true)} />;
  }

  if (pinRequired === null) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-stone-400">Loading...</div>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-950">
      <header className="border-b border-stone-800 bg-stone-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <HardDrive className="w-6 h-6 text-accent-500" />
          <h1 className="text-xl font-bold">LAN Drop</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-600/20 text-accent-400 border border-accent-600/30">
              E2E
            </span>
            <SettingsPanel />
            {pinRequired && (
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-stone-700 rounded-lg transition-colors text-stone-400 hover:text-white"
                title="Logout"
              >
                <LogOut className="w-4 h-4 text-stone-400" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DeviceInfo serverUrl={serverUrl} />
          <QRCodeDisplay url={serverUrl} />
        </div>

        <UploadZone
          onUpload={handleUpload}
          uploading={manager.isUploading()}
          onFolderUpload={handleFolderUpload}
        />

        <TransferQueue
          transfers={queueTransfers}
          onPause={handlePause}
          onResume={handleResume}
          onCancel={handleCancel}
        />

        <FileList
          files={files}
          onDelete={handleDelete}
          deletingFile={deletingFile}
          encryptedFiles={manager.getEncryptedFiles()}
          onDownloadEncrypted={handleDownloadEncrypted}
          onPreview={setPreviewFile}
        />

        <TransferHistory />
      </main>

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreview
          filename={previewFile}
          encrypted={manager.getEncryptedFiles().has(previewFile)}
          onClose={() => setPreviewFile(null)}
          onDownloadEncrypted={handleDownloadEncrypted}
        />
      )}
    </div>
  );
}
