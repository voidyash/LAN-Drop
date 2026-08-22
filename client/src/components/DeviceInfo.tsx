import { Copy } from 'lucide-react';
import { useState } from 'react';

interface DeviceInfoProps {
  serverUrl: string;
}

export default function DeviceInfo({ serverUrl }: DeviceInfoProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(serverUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (      <div className="bg-stone-900 rounded-xl p-6 border border-stone-700">
      <div className="bg-stone-800 rounded-lg p-4 flex items-center justify-between">
        <code className="text-sm font-mono text-amber-400 break-all mr-4">
          {serverUrl}
        </code>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-2 hover:bg-stone-700 rounded-lg transition-colors"
          title="Copy URL"
        >
          {copied ? (
            <span className="text-accent-400 text-xs font-medium">Copied!</span>
          ) : (
            <Copy className="w-4 h-4 text-stone-400" />
          )}
        </button>
      </div>
    </div>
  );
}