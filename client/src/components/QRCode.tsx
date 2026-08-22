import { QRCodeSVG } from 'qrcode.react';
import { QrCode } from 'lucide-react';

interface QRCodeProps {
  url: string;
}

export default function QRCodeDisplay({ url }: QRCodeProps) {
  return (
    <div className="bg-stone-900 rounded-xl p-6 border border-stone-700">
      <div className="flex items-center gap-3 mb-4">
        <QrCode className="w-5 h-5 text-accent-500" />
        <h2 className="text-lg font-semibold">Scan to Connect</h2>
      </div>

      <div className="flex flex-col items-center">
        <div className="bg-white p-4 rounded-xl">
          <QRCodeSVG
            value={url}
            size={180}
            level="M"
            includeMargin={false}
          />
        </div>
        <p className="text-sm text-stone-400 mt-3">
          Scan from your phone to open LAN Drop
        </p>
      </div>
    </div>
  );
}