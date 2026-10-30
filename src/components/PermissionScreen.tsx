import { CameraOff, RefreshCw, ShieldCheck } from 'lucide-react';

interface PermissionScreenProps {
  status: 'denied' | 'unavailable' | 'error' | 'idle' | 'requesting';
  error: string | null;
  onRetry: () => void;
}

const TITLES: Record<string, string> = {
  idle: 'Your Smart Digital Mirror',
  requesting: 'Connecting to your camera…',
  denied: 'Camera Access Required',
  unavailable: 'No Camera Found',
  error: 'Camera Error',
};

const HINTS: Record<string, string> = {
  idle: 'MIRROR BY JAVED uses your device camera to create a real-time mirror — directly in your browser. No photos are ever uploaded or stored.',
  requesting: 'Please allow camera access when your browser prompts you.',
  denied: 'To use the live mirror, please allow camera permission in your browser, then tap Retry Camera.',
  unavailable: 'We couldn’t detect a camera on this device. Connect a webcam and try again.',
  error: 'Something went wrong while starting the camera. Please try again.',
};

export function PermissionScreen({ status, error, onRetry }: PermissionScreenProps) {
  const showRetry = status !== 'requesting';
  const hint = (status === 'error' && error) || HINTS[status] || HINTS.idle;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505] px-6 animate-fade-in">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 30%, rgba(180,180,190,0.10), transparent 70%)',
        }}
      />
      <div className="relative flex max-w-md flex-col items-center text-center animate-scale-in">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          {status === 'requesting' ? (
            <RefreshCw className="h-8 w-8 animate-spin text-white/70" />
          ) : (
            <CameraOff className="h-8 w-8 text-white/70" />
          )}
        </div>

        <h1 className="font-display shimmer-text text-2xl font-light tracking-[0.2em] sm:text-3xl">
          MIRROR BY JAVED
        </h1>
        <p className="mt-3 text-xs font-light tracking-[0.25em] text-white/40 uppercase sm:text-sm">
          Your Smart Digital Mirror
        </p>

        <h2 className="mt-10 text-xl font-light text-white/90">
          {TITLES[status]}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/50">{hint}</p>

        {showRetry && (
          <button
            onClick={onRetry}
            className="mt-8 flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white/90 backdrop-blur-xl transition-all duration-300 hover:scale-[1.03] hover:bg-white/[0.12] active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            {status === 'idle' ? 'Enable Camera' : 'Retry Camera'}
          </button>
        )}

        <div className="mt-10 flex items-center gap-2 text-xs text-white/35">
          <ShieldCheck className="h-4 w-4" />
          <span>Your camera stays on your device.</span>
        </div>
      </div>
    </div>
  );
}
