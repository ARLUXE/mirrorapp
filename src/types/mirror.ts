export type MirrorMode = 'mirror' | 'true';

export type BodyEffect = 'original' | 'slim' | 'bulky' | 'wide';

export interface BodyEffectOption {
  id: BodyEffect;
  label: string;
  description: string;
  icon: string; // lucide name
}
