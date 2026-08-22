import { useState, useRef, useCallback } from 'react';
import { Lock, AlertCircle } from 'lucide-react';

interface PinAuthProps {
  onAuthenticated: () => void;
}

export default function PinAuth({ onAuthenticated }: PinAuthProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;

      const newPin = [...pin];
      newPin[index] = value.slice(-1);
      setPin(newPin);
      setError(false);

      if (value && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }

      if (newPin.every((d) => d !== '')) {
        handleSubmit(newPin.join(''));
      }
    },
    [pin]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !pin[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [pin]
  );

  const handleSubmit = async (pinValue?: string) => {
    const pinString = pinValue || pin.join('');
    if (pinString.length !== 4) return;

    setLoading(true);
    setError(false);

    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinString }),
      });

      if (res.ok) {
        // Store auth state so user doesn't need to re-enter PIN on refresh
        sessionStorage.setItem('lan-drop-auth', 'true');
        onAuthenticated();
      } else {
        setError(true);
        setPin(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError(true);
      setPin(['', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-stone-800 rounded-2xl border border-stone-700 mb-4">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">LAN Drop</h1>
          <p className="text-stone-400 text-sm">Enter the PIN to access this device</p>
        </div>

        <div className="bg-stone-800 rounded-xl p-6 border border-stone-700">
          <div className="flex justify-center gap-3 mb-6">
            {pin.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                className={`w-14 h-14 text-center text-2xl font-bold bg-stone-900 rounded-xl border-2 transition-colors outline-none ${
                  error
                    ? 'border-red-500 text-red-400'
                    : digit
                    ? 'border-accent-500 text-white'
                    : 'border-stone-600 text-white focus:border-amber-400'
                } disabled:opacity-50`}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 justify-center text-red-400 text-sm mb-4">
              <AlertCircle className="w-4 h-4" />
              <span>Invalid PIN. Please try again.</span>
            </div>
          )}

          <button
            onClick={() => handleSubmit()}
            disabled={loading || pin.some((d) => !d)}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-white font-medium rounded-xl transition-colors"
          >
            {loading ? 'Verifying...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}