import { useCallback, useEffect, useState } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { MirrorCanvas } from '@/components/MirrorCanvas';
import { PermissionScreen } from '@/components/PermissionScreen';
import { ControlBar } from '@/components/ControlBar';
import { ShieldCheck } from 'lucide-react';
import type { MirrorMode, BodyEffect } from '@/types/mirror';

const DEFAULT_BRIGHTNESS = 1;
const DEFAULT_ZOOM = 1;

function App() {
  const {
    videoRef,
    status,
    error,
    start,
    switchCamera,
    stop,
    hasMultipleCameras,
  } = useCamera();

  const [mirrorMode, setMirrorMode] = useState<MirrorMode>('true');
  const [bodyEffect, setBodyEffect] = useState<BodyEffect>('original');
  const [brightness, setBrightness] = useState(DEFAULT_BRIGHTNESS);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHint, setShowHint] = useState(true);

  // Auto-request camera on first load
  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Hide the intro hint after a few seconds once mirror is live
  useEffect(() => {
    if (status !== 'ready') return;
    const t = setTimeout(() => setShowHint(false), 4500);
    return () => clearTimeout(t);
  }, [status]);

  const handleToggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    } else {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)));
  }, []);

  const handleReset = useCallback(() => {
    setMirrorMode('true');
    setBodyEffect('original');
    setBrightness(DEFAULT_BRIGHTNESS);
    setZoom(DEFAULT_ZOOM);
  }, []);

  const cameraReady = status === 'ready';
  const needsPermission =
    status === 'idle' || status === 'requesting' || status === 'denied' || status === 'unavailable' || status === 'error';

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050505]">
      {/* Hidden video element carrying the live camera stream */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="pointer-events-none absolute h-px w-px opacity-0"
      />

      {/* Live mirror (always mounted once ready so canvas stays stable) */}
      {cameraReady && (
        <MirrorCanvas
          videoRef={videoRef}
          mirrorMode={mirrorMode}
          bodyEffect={bodyEffect}
          brightness={brightness}
          zoom={zoom}
        />
      )}

      {/* Premium top navigation */}
      {cameraReady && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-6">
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-soft-pulse" />
            <h1 className="font-display shimmer-text text-base font-light tracking-[0.25em] sm:text-lg">
              MIRROR BY JAVED
            </h1>
          </div>
          {showHint && (
            <div className="pointer-events-none animate-fade-in rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-light text-white/55 backdrop-blur-md sm:text-xs">
              {bodyEffect !== 'original' ? (
                <span>Visual effect — not a real measurement</span>
              ) : (
                <span>Adjust effects from the panel below</span>
              )}
            </div>
          )}
        </header>
      )}

      {/* Privacy indicator */}
      {cameraReady && (
        <div className="pointer-events-none absolute bottom-[7.5rem] left-1/2 z-30 -translate-x-1/2 sm:bottom-28">
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-light text-white/35 backdrop-blur-md animate-fade-in">
            <ShieldCheck className="h-3 w-3" />
            Your camera stays on your device
          </div>
        </div>
      )}

      {/* Controls */}
      {cameraReady && (
        <ControlBar
          mirrorMode={mirrorMode}
          bodyEffect={bodyEffect}
          brightness={brightness}
          zoom={zoom}
          hasMultipleCameras={hasMultipleCameras}
          isFullscreen={isFullscreen}
          onMirrorMode={setMirrorMode}
          onBodyEffect={setBodyEffect}
          onBrightness={setBrightness}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleReset}
          onSwitchCamera={switchCamera}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {/* Permission / error overlay */}
      {needsPermission && (
        <PermissionScreen status={status} error={error} onRetry={start} />
      )}
    </div>
  );
}

export default App;
