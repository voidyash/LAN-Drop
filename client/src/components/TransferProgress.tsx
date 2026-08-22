interface TransferProgressProps {
  fileName: string;
  progress: number;
  bytesUploaded: number;
  totalBytes: number;
  speed: number;
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
        <span>{formatSpeed(speed)}</span>
      </div>
    </div>
  );
}