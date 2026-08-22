import { useCallback, useRef, useState } from 'react';
import { Upload, UploadCloud } from 'lucide-react';

interface UploadZoneProps {
  onUpload: (files: FileList) => void;
  uploading: boolean;
}

export default function UploadZone({ onUpload, uploading }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        onUpload(e.dataTransfer.files);
      }
    },
    [onUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onUpload(e.target.files);
        e.target.value = '';
      }
    },
    [onUpload]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        bg-stone-800 rounded-xl p-8 border-2 border-dashed cursor-pointer
        transition-all duration-200
        ${dragOver
          ? 'border-accent-400 bg-accent-500/10 scale-[1.02]'
          : 'border-stone-600 hover:border-stone-500'
        }
        ${uploading ? 'pointer-events-none opacity-60' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex flex-col items-center text-center">
        {uploading ? (
          <Upload className="w-12 h-12 text-amber-500 animate-bounce mb-4" />
        ) : (
          <UploadCloud className="w-12 h-12 text-stone-400 mb-4" />
        )}

        <p className="text-lg font-medium mb-1">
          {uploading ? 'Uploading...' : 'Drop files here to upload'}
        </p>
        <p className="text-sm text-stone-400">
          or click to browse • supports any file type
        </p>
      </div>
    </div>
  );
}