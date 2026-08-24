import { useState, useEffect, useCallback } from 'react';
import { Settings, Save, RotateCcw } from 'lucide-react';

interface SettingsPanelProps {
  onStorageDirChange?: (dir: string) => void;
}

function formatBps(bps: number): string {
  if (bps <= 0) return 'Unlimited';
  if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

function bpsToInput(bps: number): string {
  if (bps <= 0) return '';
  if (bps >= 1024 * 1024) return (bps / (1024 * 1024)).toFixed(1);
  if (bps >= 1024) return (bps / 1024).toFixed(0);
  return String(bps);
}

function inputToBps(val: string, unit: string): number {
  const num = parseFloat(val);
  if (isNaN(num) || num <= 0) return 0;
  if (unit === 'MB/s') return num * 1024 * 1024;
  if (unit === 'KB/s') return num * 1024;
  return num;
}

export default function SettingsPanel({ onStorageDirChange }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [uploadBps, setUploadBps] = useState(0);
  const [downloadBps, setDownloadBps] = useState(0);
  const [uploadUnit, setUploadUnit] = useState('MB/s');
  const [downloadUnit, setDownloadUnit] = useState('MB/s');
  const [storageDir, setStorageDir] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg.uploadBandwidth > 0) {
          setUploadBps(cfg.uploadBandwidth);
          if (cfg.uploadBandwidth >= 1024 * 1024) setUploadUnit('MB/s');
          else if (cfg.uploadBandwidth >= 1024) setUploadUnit('KB/s');
        }
        if (cfg.downloadBandwidth > 0) {
          setDownloadBps(cfg.downloadBandwidth);
          if (cfg.downloadBandwidth >= 1024 * 1024) setDownloadUnit('MB/s');
          else if (cfg.downloadBandwidth >= 1024) setDownloadUnit('KB/s');
        }
        setStorageDir(cfg.storageDir || '');
      })
      .catch(() => {});
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const ulBps = inputToBps(bpsToInput(uploadBps), uploadUnit);
      const dlBps = inputToBps(bpsToInput(downloadBps), downloadUnit);
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadBandwidth: ulBps,
          downloadBandwidth: dlBps,
          storageDir,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        if (onStorageDirChange) onStorageDirChange(storageDir);
      }
    } finally {
      setSaving(false);
    }
  }, [uploadBps, uploadUnit, downloadBps, downloadUnit, storageDir, onStorageDirChange]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="p-2 hover:bg-stone-700 rounded-lg transition-colors text-stone-400 hover:text-white"
        title="Settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="bg-stone-800 rounded-xl border border-stone-700 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-stone-400" />
          <span className="text-sm font-medium">Settings</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
        >
          Collapse
        </button>
      </div>

      {/* Bandwidth Limiting */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
          Bandwidth Limiting
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-500 block mb-1">Upload limit</label>
            <div className="flex gap-1">
              <input
                type="number"
                min="0"
                step="0.1"
                value={uploadBps > 0 ? bpsToInput(uploadBps) : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) { setUploadBps(0); return; }
                  setUploadBps(inputToBps(val, uploadUnit));
                }}
                placeholder="0 = unlimited"
                className="flex-1 bg-stone-900 border border-stone-600 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-accent-500 transition-colors"
              />
              <select
                value={uploadUnit}
                onChange={(e) => setUploadUnit(e.target.value)}
                className="bg-stone-900 border border-stone-600 rounded-lg px-1 py-1.5 text-xs outline-none"
              >
                <option value="B/s">B/s</option>
                <option value="KB/s">KB/s</option>
                <option value="MB/s">MB/s</option>
              </select>
            </div>
            <p className="text-[10px] text-stone-600 mt-0.5">{formatBps(uploadBps)}</p>
          </div>

          <div>
            <label className="text-xs text-stone-500 block mb-1">Download limit</label>
            <div className="flex gap-1">
              <input
                type="number"
                min="0"
                step="0.1"
                value={downloadBps > 0 ? bpsToInput(downloadBps) : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) { setDownloadBps(0); return; }
                  setDownloadBps(inputToBps(val, downloadUnit));
                }}
                placeholder="0 = unlimited"
                className="flex-1 bg-stone-900 border border-stone-600 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-accent-500 transition-colors"
              />
              <select
                value={downloadUnit}
                onChange={(e) => setDownloadUnit(e.target.value)}
                className="bg-stone-900 border border-stone-600 rounded-lg px-1 py-1.5 text-xs outline-none"
              >
                <option value="B/s">B/s</option>
                <option value="KB/s">KB/s</option>
                <option value="MB/s">MB/s</option>
              </select>
            </div>
            <p className="text-[10px] text-stone-600 mt-0.5">{formatBps(downloadBps)}</p>
          </div>
        </div>
      </div>

      {/* Storage Directory */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
          Storage Directory
        </h3>
        <input
          type="text"
          value={storageDir}
          onChange={(e) => setStorageDir(e.target.value)}
          placeholder="Default: ./server/uploads"
          className="w-full bg-stone-900 border border-stone-600 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-accent-500 transition-colors"
        />
        <p className="text-[10px] text-stone-600">
          Absolute path to store uploaded files. Leave empty for default.
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2 bg-accent-600 hover:bg-accent-500 disabled:bg-stone-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {saving ? (
          <RotateCcw className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
