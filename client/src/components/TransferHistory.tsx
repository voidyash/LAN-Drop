import { useEffect, useState, useCallback } from 'react';
import { History, Trash2, Upload, Download as DownloadIcon, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface HistoryEntry {
  id: string;
  timestamp: string;
  type: 'upload' | 'download' | 'delete';
  filename: string;
  folder?: string;
  size?: number;
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'upload':
      return <Upload className="w-3.5 h-3.5 text-green-400" />;
    case 'download':
      return <DownloadIcon className="w-3.5 h-3.5 text-amber-400" />;
    case 'delete':
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    default:
      return null;
  }
}

export default function TransferHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) setHistory(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleClear = async () => {
    if (!confirm('Clear all transfer history?')) return;
    await fetch('/api/history', { method: 'DELETE' });
    setHistory([]);
  };

  const handleDeleteEntry = async (id: string) => {
    await fetch(`/api/history/${id}`, { method: 'DELETE' });
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  if (loading) return null;
  if (history.length === 0) return null;

  const visibleItems = expanded ? history : history.slice(0, 5);

  return (
    <div className="bg-stone-800 rounded-xl border border-stone-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-stone-400" />
          <span className="text-sm font-medium">Transfer History</span>
          <span className="text-xs text-stone-500">({history.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {expanded && history.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="text-xs text-stone-500 hover:text-red-400 transition-colors px-2 py-1"
            >
              Clear all
            </button>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-stone-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-stone-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-stone-700 max-h-64 overflow-y-auto">
          {visibleItems.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-4 py-2 hover:bg-stone-750 transition-colors group"
            >
              <TypeIcon type={entry.type} />
              <div className="flex-1 min-w-0">
                <span className="text-sm truncate block">{entry.filename}</span>
                <span className="text-xs text-stone-500">
                  {entry.type}
                  {entry.folder ? ` in ${entry.folder}` : ''}
                  {entry.size ? ` • ${formatSize(entry.size)}` : ''}
                </span>
              </div>
              <span className="text-xs text-stone-500 flex-shrink-0">
                {formatTime(entry.timestamp)}
              </span>
              <button
                onClick={() => handleDeleteEntry(entry.id)}
                className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-400 text-stone-500 transition-all"
                title="Remove from history"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
