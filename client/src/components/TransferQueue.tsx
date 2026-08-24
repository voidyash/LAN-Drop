import { Pause, Play, XCircle, CheckCircle, AlertCircle, Clock, Loader } from 'lucide-react';
import {
  STATUS_QUEUED,
  STATUS_UPLOADING,
  STATUS_PAUSED,
  STATUS_COMPLETED,
  STATUS_ERROR,
  STATUS_CANCELLED,
} from '../utils/TransferManager';

interface TransferItem {
  id: string;
  fileName: string;
  fileSize: number;
  status: string;
  progress: number;
  bytesUploaded: number;
  speed: number;
}

interface TransferQueueProps {
  transfers: TransferItem[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '—';
  return `${formatSize(bytesPerSecond)}/s`;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case STATUS_QUEUED:
      return <Clock className="w-4 h-4 text-stone-400" />;
    case STATUS_UPLOADING:
      return <Loader className="w-4 h-4 text-accent-400 animate-spin" />;
    case STATUS_PAUSED:
      return <Pause className="w-4 h-4 text-amber-400" />;
    case STATUS_COMPLETED:
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case STATUS_ERROR:
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    case STATUS_CANCELLED:
      return <XCircle className="w-4 h-4 text-stone-500" />;
    default:
      return null;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case STATUS_QUEUED: return 'Queued';
    case STATUS_UPLOADING: return 'Uploading';
    case STATUS_PAUSED: return 'Paused';
    case STATUS_COMPLETED: return 'Done';
    case STATUS_ERROR: return 'Failed';
    case STATUS_CANCELLED: return 'Cancelled';
    default: return status;
  }
}

export default function TransferQueue({ transfers, onPause, onResume, onCancel }: TransferQueueProps) {
  if (transfers.length === 0) return null;

  // Separate active vs completed/failed for display ordering
  const active = transfers.filter(
    (t) => t.status === STATUS_UPLOADING || t.status === STATUS_QUEUED || t.status === STATUS_PAUSED
  );
  const finished = transfers.filter(
    (t) => t.status === STATUS_COMPLETED || t.status === STATUS_ERROR || t.status === STATUS_CANCELLED
  );
  const ordered = [...active, ...finished];

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">
        Transfer Queue ({transfers.length})
      </h2>
      <div className="space-y-2">
        {ordered.map((t) => (
          <div
            key={t.id}
            className="bg-stone-800 rounded-xl p-4 border border-stone-700"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <StatusIcon status={t.status} />
                <span className="text-sm font-medium truncate">{t.fileName}</span>
              </div>
              <span className="text-xs text-stone-400 ml-2 flex-shrink-0">
                {statusLabel(t.status)}
              </span>
            </div>

            {(t.status === STATUS_UPLOADING || t.status === STATUS_PAUSED) && (
              <>
                <div className="w-full bg-stone-700 rounded-full h-1.5 mb-2">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      t.status === STATUS_PAUSED ? 'bg-amber-500' : 'bg-accent-500'
                    }`}
                    style={{ width: `${Math.min(t.progress, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span>
                    {formatSize(t.bytesUploaded)} / {formatSize(t.fileSize)}
                  </span>
                  <span>{formatSpeed(t.speed)}</span>
                </div>
              </>
            )}

            <div className="flex items-center gap-1 mt-2">
              {t.status === STATUS_UPLOADING && (
                <button
                  onClick={() => onPause(t.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-300 transition-colors"
                  title="Pause"
                >
                  <Pause className="w-3 h-3" />
                  Pause
                </button>
              )}
              {t.status === STATUS_PAUSED && (
                <button
                  onClick={() => onResume(t.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-accent-600 hover:bg-accent-500 text-white transition-colors"
                  title="Resume"
                >
                  <Play className="w-3 h-3" />
                  Resume
                </button>
              )}
              {(t.status === STATUS_QUEUED || t.status === STATUS_UPLOADING || t.status === STATUS_PAUSED) && (
                <button
                  onClick={() => onCancel(t.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-stone-700 hover:bg-red-600/30 text-stone-400 hover:text-red-400 transition-colors"
                  title="Cancel"
                >
                  <XCircle className="w-3 h-3" />
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
