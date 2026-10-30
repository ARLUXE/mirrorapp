import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  devices: CameraDevice[];
  activeDeviceId: string | null;
  error: string | null;
  start: () => Promise<void>;
  switchCamera: () => Promise<void>;
  stop: () => void;
  hasMultipleCameras: boolean;
}

const FACING_MODE_PRIORITY: { ideal?: string }[] = [{ ideal: 'user' }, {}];

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const attachStream = useCallback((stream: MediaStream) => {
    // Stop any existing stream to prevent duplicate tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      // iOS Safari needs a play() call after srcObject is set
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const enumerateDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }));
      setDevices(cams);
    } catch {
      // enumeration can fail quietly
    }
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      setError('Camera API is not supported in this browser.');
      return;
    }

    setStatus('requesting');
    setError(null);

    // Try facingMode first (works well for mobile front/back), fall back to first device.
    const constraintsQueue: MediaStreamConstraints[] = [
      { video: { facingMode: 'user' }, audio: false },
      { video: { facingMode: 'environment' }, audio: false },
      { video: true, audio: false },
    ];

    let stream: MediaStream | null = null;
    let lastErr: unknown = null;

    for (const constraints of constraintsQueue) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!stream) {
      const name = (lastErr as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
        setError('Camera permission was denied. Please allow camera access to use the mirror.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setStatus('unavailable');
        setError('No camera device was found on this device.');
      } else {
        setStatus('error');
        setError('The camera could not be started. Please try again.');
      }
      return;
    }

    attachStream(stream);
    await enumerateDevices();
    const track = stream.getVideoTracks()[0];
    if (track) {
      const settings = track.getSettings();
      setActiveDeviceId(settings.deviceId ?? null);
    }
    setStatus('ready');
  }, [attachStream, enumerateDevices]);

  const switchCamera = useCallback(async () => {
    if (devices.length < 2 || !activeDeviceId) return;
    const idx = devices.findIndex((d) => d.deviceId === activeDeviceId);
    const next = devices[(idx + 1) % devices.length];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: next.deviceId } },
        audio: false,
      });
      attachStream(stream);
      setActiveDeviceId(next.deviceId);
    } catch {
      // ignore switch failure
    }
  }, [devices, activeDeviceId, attachStream]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus('idle');
  }, []);

  // Listen for device change and enumerate once we have permission
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const handler = () => enumerateDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', handler);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', handler);
  }, [enumerateDevices]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    videoRef,
    status,
    devices,
    activeDeviceId,
    error,
    start,
    switchCamera,
    stop,
    hasMultipleCameras: devices.length > 1,
  };
}
