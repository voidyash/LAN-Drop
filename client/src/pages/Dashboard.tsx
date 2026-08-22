import { useEffect, useState, useCallback } from 'react';
import { HardDrive, LogOut } from 'lucide-react';
import DeviceInfo from '../components/DeviceInfo';
import QRCodeDisplay from '../components/QRCode';
import UploadZone from '../components/UploadZone';
import TransferProgress from '../components/TransferProgress';
import FileList from '../components/FileList';
import PinAuth from '../components/PinAuth';
import { useSocket, TransferEvent } from '../hooks/useSocket';

interface FileItem {
  name: string;
  size: number;
  uploadedAt: string;
}

interface ActiveTransfer {
  fileName: string;
  progress: number;
  bytesUploaded: number;
  totalBytes: number;
  speed: number;
}

export default function Dashboard() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [serverUrl, setServerUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeTransfers, setActiveTransfers] = useState<ActiveTransfer[]>([]);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinRequired, setPinRequired] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem('lan-drop-auth') === 'true'
  );

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
        setActiveTransfers((prev) => prev.filter((t) => t.fileName !== file.name));
      }
    };

    const handleFileDeleted = (file: TransferEvent) => {
      if (file.name) {
        setFiles((prev) => prev.filter((f) => f.name !== file.name));
      }
    };

    const handleUploadStarted = (_data: TransferEvent) => {
      // Other clients can see that an upload has started
    };

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

  const handleUpload = useCallback(
    async (fileList: FileList) => {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      const fileArray = Array.from(fileList);

      fileArray.forEach((file) => {
        formData.append('files', file);
      });

      const initialTransfers: ActiveTransfer[] = fileArray.map((file) => ({
        fileName: file.name,
        progress: 0,
        bytesUploaded: 0,
        totalBytes: file.size,
        speed: 0,
      }));
      setActiveTransfers((prev) => [...prev, ...initialTransfers]);

      try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            const speed = e.loaded / ((Date.now() - startTime) / 1000);
            setActiveTransfers((prev) =>
              prev.map((t) => {
                if (fileArray.some((f) => f.name === t.fileName)) {
                  return {
                    ...t,
                    progress,
                    bytesUploaded: e.loaded,
                    speed,
                  };
                }
                return t;
              })
            );
          }
        });

        const startTime = Date.now();

        xhr.onload = () => {
          setUploading(false);
          if (xhr.status === 200) {
            fetchFiles();
          } else {
            setError('Upload failed');
            setActiveTransfers((prev) =>
              prev.filter((t) => !fileArray.some((f) => f.name === t.fileName))
            );
          }
        };

        xhr.onerror = () => {
          setUploading(false);
          setError('Upload failed — check connection');
          setActiveTransfers((prev) =>
            prev.filter((t) => !fileArray.some((f) => f.name === t.fileName))
          );
        };

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      } catch (err) {
        setUploading(false);
        setError('Upload failed');
        setActiveTransfers((prev) =>
          prev.filter((t) => !fileArray.some((f) => f.name === t.fileName))
        );
      }
    },
    [fetchFiles]
  );

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

  // Show PIN screen if required and not yet authenticated
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

  return (
    <div className="min-h-screen bg-stone-950">
      <header className="border-b border-stone-800 bg-stone-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <HardDrive className="w-6 h-6 text-accent-500" />
          <h1 className="text-xl font-bold">LAN Drop</h1>
          <div className="ml-auto flex items-center gap-2">
            {/* <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            <span className="text-sm text-gray-400">
              {connected ? 'Connected' : 'Disconnected'}
            </span> */}
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

        <UploadZone onUpload={handleUpload} uploading={uploading} />

        {activeTransfers.length > 0 && (
          <div className="space-y-2">
            {activeTransfers.map((t) => (
              <TransferProgress
                key={t.fileName}
                fileName={t.fileName}
                progress={t.progress}
                bytesUploaded={t.bytesUploaded}
                totalBytes={t.totalBytes}
                speed={t.speed}
              />
            ))}
          </div>
        )}

        <FileList
          files={files}
          onDelete={handleDelete}
          deletingFile={deletingFile}
        />
      </main>
    </div>
  );
}