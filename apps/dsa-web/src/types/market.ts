export type UsProfitZone =
  | 'buy'
  | 'hold'
  | 'watch'
  | 'elevated'
  | 'reasonable'
  | 'expensive'
  | 'opportunity'
  | 'fear'
  | 'greed'
  | 'profit_taking'
  | 'unknown';

export type ResonanceLevel = 'normal' | 'mild' | 'moderate' | 'extreme';

export interface UsProfitRule {
  condition: string;
  label: string;
}

export interface UsProfitSignal {
  id: 'vix' | 'qqq_pe' | 'fear_greed' | string;
  name: string;
  nameCn: string;
  value: number | null;
  zone: UsProfitZone | string;
  zoneLabel: string;
  profitTaking: boolean;
  source: string;
  rules: UsProfitRule[];
  error?: string | null;
  extra?: Record<string, unknown>;
}

export interface UsProfitResonance {
  triggeredCount: number;
  triggeredIds: string[];
  level: ResonanceLevel | string;
  levelLabel: string;
  emoji: string;
  action: string;
}

export interface UsProfitSnapshot {
  updatedAt: string;
  updatedAtCn: string;
  signals: UsProfitSignal[];
  resonance: UsProfitResonance;
  disclaimer: string;
  cached: boolean;
}
