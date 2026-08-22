import { Download, Trash2, FileIcon, Image, Film, Music } from 'lucide-react';

interface FileCardProps {
  name: string;
  size: number;
  uploadedAt: string;
  onDelete: (name: string) => void;
  deleting: boolean;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
    return <Image className="w-5 h-5 text-green-400" />;
  }
  if (['mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv'].includes(ext)) {
    return <Film className="w-5 h-5 text-purple-400" />;
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
    return <Music className="w-5 h-5 text-accent-400" />;
  }
  return <FileIcon className="w-5 h-5 text-amber-400" />;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FileCard({ name, size, uploadedAt, onDelete, deleting }: FileCardProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/api/download/${encodeURIComponent(name)}`;
    link.download = name;
    link.click();
  };

  return (
    <div className="bg-stone-800 rounded-xl p-4 border border-stone-700 hover:border-stone-600 transition-colors">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-stone-700 rounded-lg flex-shrink-0">
          {getFileIcon(name)}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate" title={name}>
            {name}
          </h3>
          <p className="text-sm text-stone-400">
            {formatSize(size)} • {formatTime(uploadedAt)}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-stone-700 rounded-lg transition-colors text-stone-400 hover:text-amber-400"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(name)}
            disabled={deleting}
            className="p-2 hover:bg-stone-700 rounded-lg transition-colors text-stone-400 hover:text-red-400 disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}