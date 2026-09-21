import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { marketApi } from '../../api/market';
import { getParsedApiError } from '../../api/error';
import type { UsProfitSignal, UsProfitSnapshot } from '../../types/market';

function formatSignalValue(signal: UsProfitSignal): string {
  if (signal.value == null) return '--';
  if (signal.id === 'fear_greed') return String(Math.round(signal.value));
  return signal.value.toFixed(1);
}

function toneClass(signal: UsProfitSignal): string {
  if (signal.profitTaking) return 'text-danger';
  if (signal.zone === 'buy' || signal.zone === 'opportunity') return 'text-success';
  if (signal.zone === 'expensive' || signal.zone === 'elevated' || signal.zone === 'greed') {
    return 'text-warning';
  }
  return 'text-cyan';
}

function resonanceTone(level: string): string {
  if (level === 'extreme') return 'text-danger';
  if (level === 'moderate') return 'text-warning';
  if (level === 'mild') return 'text-warning';
  return 'text-success';
}

export const UsProfitTicker: React.FC = () => {
  const [snapshot, setSnapshot] = useState<UsProfitSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await marketApi.getUsProfitSignals();
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(getParsedApiError(err).message);
    }
  }, []);

  useEffect(() => {
    const immediate = window.setTimeout(() => {
      void load();
    }, 0);
    const timer = window.setInterval(() => {
      void load();
    }, 60_000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, [load]);

  if (error && !snapshot) {
    return (
      <Link
        to="/us-profit"
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-elevated/80 border border-white/5 text-xs text-muted hover:text-white transition-colors"
      >
        美股止盈监控暂时不可用
      </Link>
    );
  }

  if (!snapshot) {
    return (
      <div className="px-3 py-2 rounded-xl bg-elevated/80 border border-white/5 text-xs text-muted">
        正在读取美股止盈三信号...
      </div>
    );
  }

  return (
    <Link
      to="/us-profit"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-xl bg-elevated/80 border border-white/5 hover:border-cyan/30 transition-colors"
      title="打开美股止盈实时看板"
    >
      <span className="text-xs font-semibold text-cyan whitespace-nowrap">美股止盈</span>
      {snapshot.signals.map((signal) => (
        <span key={signal.id} className="text-xs whitespace-nowrap">
          <span className="text-muted">{signal.name}</span>{' '}
          <span className={`font-mono font-semibold ${toneClass(signal)}`}>
            {formatSignalValue(signal)}
          </span>
        </span>
      ))}
      <span className={`text-xs font-medium ${resonanceTone(String(snapshot.resonance.level))}`}>
        {snapshot.resonance.emoji} {snapshot.resonance.levelLabel}
      </span>
    </Link>
  );
};
