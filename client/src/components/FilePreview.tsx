import { useEffect, useCallback, useState } from 'react';
import { X, Download } from 'lucide-react';

interface FilePreviewProps {
  filename: string;
  encrypted: boolean;
  onClose: () => void;
  onDownloadEncrypted?: (name: string) => void;
}

function isImage(filename: string): boolean {
  return /\.(jpe?g|png|gif|svg|webp|bmp|ico)$/i.test(filename);
}
function isVideo(filename: string): boolean {
  return /\.(mp4|webm|ogg|mov)$/i.test(filename);
}
function isAudio(filename: string): boolean {
  return /\.(mp3|wav|flac|aac|m4a|ogg)$/i.test(filename);
}
function isPdf(filename: string): boolean {
  return /\.pdf$/i.test(filename);
}
function isText(filename: string): boolean {
  return /\.(txt|md|json|js|ts|tsx|jsx|html|css|xml|csv|py|rb|go|rs|java|c|cpp|h|sh|yaml|yml|toml|ini|env|gitignore|dockerfile)$/i.test(filename);
}

export default function FilePreview({ filename, encrypted, onClose, onDownloadEncrypted }: FilePreviewProps) {
  const url = `/api/download/${encodeURIComponent(filename)}`;
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleDownload = () => {
    if (encrypted && onDownloadEncrypted) {
      onDownloadEncrypted(filename);
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-stone-900 rounded-2xl border border-stone-700 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700">
          <span className="text-sm font-medium truncate mr-4">{filename}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-stone-700 rounded-lg transition-colors text-stone-400 hover:text-amber-400"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-stone-700 rounded-lg transition-colors text-stone-400 hover:text-white"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[200px]">
          {isImage(filename) && (
            <img
              src={url}
              alt={filename}
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
          )}

          {isVideo(filename) && (
            <video
              src={url}
              controls
              className="max-w-full max-h-[75vh] rounded-lg"
            >
              Your browser does not support video playback.
            </video>
          )}

          {isAudio(filename) && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-stone-800 flex items-center justify-center">
                <span className="text-3xl">🎵</span>
              </div>
              <audio src={url} controls className="w-80" />
              <p className="text-sm text-stone-400">{filename}</p>
            </div>
          )}

          {isPdf(filename) && (
            <iframe
              src={url}
              className="w-full h-[75vh] rounded-lg border border-stone-700"
              title={filename}
            />
          )}

          {isText(filename) && !encrypted && (
            <TextPreview url={url} />
          )}

          {isText(filename) && encrypted && (
            <div className="text-center text-stone-400">
              <p className="mb-2">Text preview is not available for encrypted files.</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg text-sm transition-colors"
              >
                Download to view
              </button>
            </div>
          )}

          {!isImage(filename) && !isVideo(filename) && !isAudio(filename) && !isPdf(filename) && !isText(filename) && (
            <div className="text-center text-stone-400">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-stone-800 flex items-center justify-center">
                <span className="text-3xl">📄</span>
              </div>
              <p className="mb-2">Preview not available for this file type.</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg text-sm transition-colors"
              >
                Download file
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(url)
      .then((res) => res.text())
      .then((text) => {
        // Only show first 100KB of text
        if (text.length > 100 * 1024) {
          setContent(text.slice(0, 100 * 1024) + '\n\n... (truncated)');
        } else {
          setContent(text);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) {
    return <div className="text-stone-400">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-400">Failed to load text preview.</div>;
  }

  return (
    <pre className="w-full bg-stone-950 rounded-lg p-4 overflow-auto max-h-[75vh] text-sm font-mono text-stone-300 whitespace-pre-wrap break-all">
      {content}
    </pre>
  );
}


