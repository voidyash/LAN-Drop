import { FolderOpen } from 'lucide-react';
import FileCard from './FileCard';

interface FileItem {
  name: string;
  size: number;
  uploadedAt: string;
}

interface FileListProps {
  files: FileItem[];
  onDelete: (name: string) => void;
  deletingFile: string | null;
}

export default function FileList({ files, onDelete, deletingFile }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="bg-stone-800 rounded-xl p-8 border border-stone-700 text-center">
        <FolderOpen className="w-12 h-12 text-stone-500 mx-auto mb-3" />
        <p className="text-stone-400">No files uploaded yet</p>
        <p className="text-sm text-stone-500 mt-1">
          Upload a file to get started
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Files ({files.length})</h2>
      </div>
      <div className="space-y-2">
        {files.map((file) => (
          <FileCard
            key={file.name}
            name={file.name}
            size={file.size}
            uploadedAt={file.uploadedAt}
            onDelete={onDelete}
            deleting={deletingFile === file.name}
          />
        ))}
      </div>
    </div>
  );
}