import {
  FlipHorizontal,
  Eye,
  Minus,
  Plus,
  RotateCcw,
  Camera,
  Maximize,
  Minimize,
  Sun,
  Sparkles,
  Activity,
  Gauge,
} from 'lucide-react';
import type { MirrorMode, BodyEffect } from '@/types/mirror';

interface ControlBarProps {
  mirrorMode: MirrorMode;
  bodyEffect: BodyEffect;
  brightness: number;
  zoom: number;
  hasMultipleCameras: boolean;
  isFullscreen: boolean;
  onMirrorMode: (m: MirrorMode) => void;
  onBodyEffect: (e: BodyEffect) => void;
  onBrightness: (v: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onSwitchCamera: () => void;
  onToggleFullscreen: () => void;
}

const BODY_EFFECTS: { id: BodyEffect; label: string; Icon: typeof Sparkles }[] = [
  { id: 'original', label: 'Original', Icon: Sparkles },
  { id: 'slim', label: 'Slim', Icon: Minus },
  { id: 'bulky', label: 'Bulky', Icon: Activity },
  { id: 'wide', label: 'Wide', Icon: Gauge },
];

export function ControlBar(props: ControlBarProps) {
  const {
    mirrorMode,
    bodyEffect,
    brightness,
    zoom,
    hasMultipleCameras,
    isFullscreen,
    onMirrorMode,
    onBodyEffect,
    onBrightness,
    onZoomIn,
    onZoomOut,
    onReset,
    onSwitchCamera,
    onToggleFullscreen,
  } = props;

  const zoomPct = Math.round((zoom - 1) * 100);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="pointer-events-auto w-full max-w-3xl animate-fade-up">
        <div className="glass-panel rounded-[28px] p-3 shadow-[0_8px_40px_rgba(0,0,0,0.6)] sm:p-4">
          {/* Mode row: True View / Real Mirror toggle */}
          <div className="mb-3 flex items-center gap-2">
            <div className="flex flex-1 rounded-2xl bg-white/[0.04] p-1">
              <ModeButton
                active={mirrorMode === 'true'}
                onClick={() => onMirrorMode('true')}
                Icon={Eye}
                label="True View"
              />
              <ModeButton
                active={mirrorMode === 'mirror'}
                onClick={() => onMirrorMode('mirror')}
                Icon={FlipHorizontal}
                label="Real Mirror"
              />
            </div>
          </div>

          {/* Body effects */}
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {BODY_EFFECTS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => onBodyEffect(id)}
                className={`flex flex-1 min-w-[64px] flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-medium transition-all duration-300 ${
                  bodyEffect === id
                    ? 'glass-active text-white'
                    : 'glass-control text-white/55 hover:text-white/80'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Bottom row: actions + sliders */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <CircleBtn
                onClick={onZoomOut}
                disabled={zoom <= 1}
                title="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </CircleBtn>
              <span className="min-w-[42px] text-center text-[11px] font-medium tabular-nums text-white/60">
                {zoomPct > 0 ? `+${zoomPct}%` : '100%'}
              </span>
              <CircleBtn
                onClick={onZoomIn}
                disabled={zoom >= 2.5}
                title="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </CircleBtn>

              <div className="mx-1 h-6 w-px bg-white/10" />

              {hasMultipleCameras && (
                <CircleBtn onClick={onSwitchCamera} title="Switch camera">
                  <Camera className="h-4 w-4" />
                </CircleBtn>
              )}
              <CircleBtn onClick={onToggleFullscreen} title="Fullscreen">
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </CircleBtn>
              <CircleBtn onClick={onReset} title="Reset all effects">
                <RotateCcw className="h-4 w-4" />
              </CircleBtn>
            </div>

            {/* Sliders */}
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:gap-4">
              <Slider
                Icon={Sun}
                value={brightness}
                min={0.4}
                max={1.6}
                step={0.01}
                onChange={onBrightness}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof FlipHorizontal;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-300 ${
        active
          ? 'glass-active text-white'
          : 'text-white/45 hover:text-white/70'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CircleBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-10 w-10 items-center justify-center rounded-full glass-control text-white/80 transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Slider({
  Icon,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  Icon: typeof Sun;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-white/45" />
      <input
        type="range"
        className="mirror-slider flex-1"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="min-w-[34px] text-right text-[11px] tabular-nums text-white/45">
        {format(value)}
      </span>
    </div>
  );
}
