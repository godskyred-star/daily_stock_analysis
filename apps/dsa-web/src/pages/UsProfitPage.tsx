import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ApiErrorAlert, Badge } from '../components/common';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import { marketApi } from '../api/market';
import type { UsProfitResonance, UsProfitSignal, UsProfitSnapshot } from '../types/market';

function formatSignalValue(signal: UsProfitSignal): string {
  if (signal.value == null) return '--';
  if (signal.id === 'fear_greed') return String(Math.round(signal.value));
  return signal.value.toFixed(1);
}

function zoneBadgeVariant(signal: UsProfitSignal): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  if (signal.profitTaking) return 'danger';
  if (signal.zone === 'buy' || signal.zone === 'opportunity' || signal.zone === 'reasonable') return 'success';
  if (signal.zone === 'expensive' || signal.zone === 'elevated' || signal.zone === 'greed' || signal.zone === 'watch') {
    return 'warning';
  }
  if (signal.zone === 'hold') return 'info';
  return 'default';
}

function resonanceVariant(level: string): 'success' | 'warning' | 'danger' | 'info' {
  if (level === 'extreme') return 'danger';
  if (level === 'moderate') return 'danger';
  if (level === 'mild') return 'warning';
  return 'success';
}

const PLAYBOOK_ROWS: Array<{ count: string; level: string; emoji: string; action: string; match: string }> = [
  {
    count: '仅 1 个指标触发止盈区',
    level: '轻度过热',
    emoji: '⚠️',
    action: '持股不动，或者仅对涨幅过夸的个股进行微调。',
    match: 'mild',
  },
  {
    count: '有 2 个指标同时触发',
    level: '中度危险',
    emoji: '🚨',
    action: '执行一档止盈。比如减掉 20% 仓位，锁定部分利润。',
    match: 'moderate',
  },
  {
    count: '3 个指标全满（VIX < 14 + QQQ PE > 35 + CNN ≥ 80）',
    level: '极度疯狂',
    emoji: '💣',
    action: '执行大额止盈。至少将仓位降至 50% 以下，或通过定投式分批卖出，保留大量现金等待暴跌后的抄底机会。',
    match: 'extreme',
  },
];

const SignalCard: React.FC<{ index: number; signal: UsProfitSignal }> = ({ index, signal }) => {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#0f1c1c] p-5 flex flex-col gap-3 min-h-[280px]">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-white/10 text-white text-sm font-bold flex items-center justify-center">
          {index}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-emerald-200 leading-tight">{signal.name}</h2>
          <p className="text-xs text-secondary">{signal.nameCn}</p>
        </div>
      </div>

      <ul className="space-y-2 text-sm text-secondary flex-1">
        {signal.rules.map((rule) => (
          <li key={rule.condition} className="leading-snug">
            <span className="text-white/80">{rule.condition}</span>
            <span className="text-muted">：</span>
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>

            <div className="pt-2 border-t border-white/10 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">当前</p>
          <p className="text-3xl font-mono font-bold text-white leading-none mt-1">
            {formatSignalValue(signal)}
          </p>
        </div>
        <Badge variant={zoneBadgeVariant(signal)} glow={signal.profitTaking}>
          {signal.profitTaking ? '止盈区' : signal.zoneLabel}
        </Badge>
      </div>
      {signal.error ? <p className="text-xs text-danger">{signal.error}</p> : null}
    </article>
  );
};

const ResonancePanel: React.FC<{ resonance: UsProfitResonance }> = ({ resonance }) => {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0f1c1c] p-5">
      <p className="text-sm text-secondary leading-relaxed mb-4">
        单一指标有时会出现“钝化”（比如 CNN 指数在贪婪区卡了一个月，股市还在涨）。
        为了提高准确率，建议使用三共振法则：
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-emerald-200/80">
              <th className="py-2 pr-3 font-medium">触发条件数量</th>
              <th className="py-2 pr-3 font-medium">风险等级</th>
              <th className="py-2 font-medium">对应操作策略</th>
            </tr>
          </thead>
          <tbody>
            {PLAYBOOK_ROWS.map((row) => {
              const active = resonance.level === row.match;
              return (
                <tr
                  key={row.match}
                  className={`border-t border-white/5 align-top ${active ? 'bg-white/5' : ''}`}
                >
                  <td className="py-3 pr-3 text-secondary">{row.count}</td>
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {row.emoji} {row.level}
                    {active ? (
                      <span className="ml-2">
                        <Badge variant={resonanceVariant(row.match)} size="sm">当前</Badge>
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-secondary">{row.action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-white">
        {resonance.emoji} 当前：{resonance.levelLabel}（{resonance.triggeredCount}/3）— {resonance.action}
      </p>
    </section>
  );
};

const UsProfitPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<UsProfitSnapshot | null>(null);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const data = await marketApi.getUsProfitSignals(refresh);
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto">
      <header className="text-center mb-8">
        <p className="text-xs tracking-[0.3em] text-emerald-300/80 uppercase mb-2">US PROFIT MONITOR</p>
        <h1 className="text-4xl md:text-5xl font-bold text-emerald-300">美股止盈</h1>
        <p className="text-2xl md:text-3xl font-semibold text-white mt-2">三个重要信号</p>
        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted">
          <span>北京时间 {snapshot?.updatedAtCn || '--'}</span>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={isRefreshing}
            className="px-2.5 py-1 rounded-lg border border-white/10 hover:border-cyan/40 text-cyan disabled:opacity-50"
          >
            {isRefreshing ? '刷新中' : '立即刷新'}
          </button>
        </div>
      </header>

      {error ? <ApiErrorAlert error={error} className="mb-4" /> : null}

      {isLoading && !snapshot ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-3 border-cyan/20 border-t-cyan rounded-full animate-spin" />
          <p className="mt-3 text-secondary text-sm">正在拉取 VIX / QQQ PE / Fear & Greed...</p>
        </div>
      ) : snapshot ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {snapshot.signals.map((signal, index) => (
              <SignalCard key={signal.id} index={index + 1} signal={signal} />
            ))}
          </div>
          <ResonancePanel resonance={snapshot.resonance} />
          <p className="text-center text-xs text-muted mt-6">{snapshot.disclaimer}</p>
        </>
      ) : null}
    </div>
  );
};

export default UsProfitPage;
