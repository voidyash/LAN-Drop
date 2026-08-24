import { Pause, Play, XCircle } from 'lucide-react';

interface TransferProgressProps {
  fileName: string;
  progress: number;
  bytesUploaded: number;
  totalBytes: number;
  speed: number;
  status?: string;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatSize(bytesPerSecond)}/s`;
}

export default function TransferProgress({
  fileName,
  progress,
  bytesUploaded,
  totalBytes,
  speed,
  status,
  onPause,
  onResume,
  onCancel,
}: TransferProgressProps) {
  return (
    <div className="bg-stone-800 rounded-xl p-4 border border-stone-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium truncate mr-4">{fileName}</span>
        <span className="text-sm text-stone-400">{Math.round(progress)}%</span>
      </div>

      <div className="w-full bg-stone-700 rounded-full h-2 mb-2">
        <div
          className="bg-accent-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-stone-400">
        <span>
          {formatSize(bytesUploaded)} / {formatSize(totalBytes)}
        </span>
        <div className="flex items-center gap-2">
          <span>{formatSpeed(speed)}</span>
          {status === 'paused' && onResume && (
            <button
              onClick={onResume}
              className="p-1 rounded hover:bg-accent-600/20 text-accent-400 transition-colors"
              title="Resume"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          {status === 'uploading' && onPause && (
            <button
              onClick={onPause}
              className="p-1 rounded hover:bg-stone-600 text-stone-400 transition-colors"
              title="Pause"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1 rounded hover:bg-red-600/20 text-stone-400 hover:text-red-400 transition-colors"
              title="Cancel"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}