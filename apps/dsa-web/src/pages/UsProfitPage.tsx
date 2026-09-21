import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiErrorAlert } from '../components/common';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import { marketApi } from '../api/market';
import type { UsProfitResonance, UsProfitSignal, UsProfitSnapshot } from '../types/market';

type CardDef = {
  id: 'vix' | 'qqq_pe' | 'fear_greed';
  name: string;
  nameCn: string;
  rules: Array<{ condition: string; label: string }>;
};

const CARD_DEFS: CardDef[] = [
  {
    id: 'vix',
    name: 'VIX',
    nameCn: '标普恐慌指数',
    rules: [
      { condition: 'VIX > 30', label: '重点考虑买入' },
      { condition: 'VIX 15-20', label: '正常持有' },
      { condition: 'VIX < 14', label: '开始关注止盈' },
    ],
  },
  {
    id: 'qqq_pe',
    name: 'QQQ PE',
    nameCn: '纳指100市盈率',
    rules: [
      { condition: 'PE < 30', label: '估值合理' },
      { condition: 'PE 30-35', label: '偏贵' },
      { condition: 'PE > 35', label: '进入止盈区' },
    ],
  },
  {
    id: 'fear_greed',
    name: 'Fear & Greed',
    nameCn: '恐惧与贪婪指数',
    rules: [
      { condition: '<25', label: '重点寻找机会' },
      { condition: '50-75', label: '正常持有' },
      { condition: '80', label: '考虑分批止盈' },
    ],
  },
];

const PLAYBOOK_ROWS = [
  {
    match: 'mild',
    count: '仅 1 个指标触发止盈区',
    level: '轻度过热',
    emoji: '⚠️',
    action: '持股不动，或者仅对涨幅过夸的个股进行微调。',
  },
  {
    match: 'moderate',
    count: '有 2 个指标同时触发',
    level: '中度危险',
    emoji: '🚨',
    action: '执行一档止盈。比如减掉 20% 仓位，锁定部分利润。',
  },
  {
    match: 'extreme',
    count: (
      <>
        3 个指标全满：
        <br />
        (VIX 小于 14 + QQQ PE
        <br />
        大于 35 + CNN 大于 80)
      </>
    ),
    level: '极度疯狂',
    emoji: '💣',
    action: '执行大额止盈。至少将仓位降至 50% 以下，或通过定投式分批卖出，保留大量现金等待暴跌后的抄底机会。',
  },
] as const;

function formatSignalValue(signal?: UsProfitSignal | null): string {
  if (!signal || signal.value == null) return '--';
  if (signal.id === 'fear_greed') return String(Math.round(signal.value));
  return Number.isInteger(signal.value) ? String(signal.value) : signal.value.toFixed(1);
}

function isRuleActive(signal: UsProfitSignal | undefined, ruleIndex: number): boolean {
  if (!signal || signal.value == null) return false;
  const value = signal.value;
  if (signal.id === 'vix') {
    if (ruleIndex === 0) return value > 30;
    if (ruleIndex === 1) return value >= 15 && value <= 20;
    return value < 14;
  }
  if (signal.id === 'qqq_pe') {
    if (ruleIndex === 0) return value < 30;
    if (ruleIndex === 1) return value >= 30 && value <= 35;
    return value > 35;
  }
  if (ruleIndex === 0) return value < 25;
  if (ruleIndex === 1) return value >= 50 && value <= 75;
  return value >= 80;
}

const PosterCard: React.FC<{
  index: number;
  def: CardDef;
  signal?: UsProfitSignal;
}> = ({ index, def, signal }) => {
  return (
    <article className="us-profit-card">
      <div className="flex flex-col items-center text-center px-2">
        <span className="us-profit-num">{index}</span>
        <h2 className="mt-4 text-[22px] md:text-[24px] font-semibold text-white tracking-wide">
          {def.name}
        </h2>
        <p className="mt-1 text-[13px] md:text-sm text-[#7eceb0]">{def.nameCn}</p>
      </div>

      <div className="us-profit-divider" />

      <ul className="space-y-2.5 text-[13px] md:text-[14px] leading-relaxed px-1">
        {def.rules.map((rule, ruleIndex) => {
          const active = isRuleActive(signal, ruleIndex);
          return (
            <li
              key={rule.condition}
              className={active ? 'text-white font-medium' : 'text-[#c5d6cf]'}
            >
              <span className={active ? 'text-[#7eceb0]' : 'text-[#9ec9b8]'}>
                {rule.condition}
              </span>
              <span>：{rule.label}</span>
            </li>
          );
        })}
      </ul>

      <p className="mt-auto pt-5 text-[15px] text-white">
        当前：
        <span className="font-semibold tracking-wide">{formatSignalValue(signal)}</span>
      </p>
      {signal?.error ? (
        <p className="mt-2 text-xs text-[#ff8b9a]">{signal.error}</p>
      ) : null}
    </article>
  );
};

const ResonanceBoard: React.FC<{ resonance?: UsProfitResonance }> = ({ resonance }) => {
  return (
    <section className="us-profit-board">
      <p className="text-[13px] md:text-[14px] text-[#d5e4de] leading-relaxed mb-5">
        单一指标有时会出现“钝化”（比如 CNN 指数在贪婪区卡了一个月，股市还在涨）。
        为了提高准确率，建议使用三共振法则：
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] md:text-[14px] border-separate border-spacing-0">
          <thead>
            <tr className="text-[#7eceb0] text-left">
              <th className="font-medium pb-3 pr-4 w-[32%]">触发条件数量</th>
              <th className="font-medium pb-3 pr-4 w-[22%]">风险等级</th>
              <th className="font-medium pb-3">对应操作策略</th>
            </tr>
          </thead>
          <tbody>
            {PLAYBOOK_ROWS.map((row) => {
              const active = resonance?.level === row.match;
              return (
                <tr key={row.match} className={active ? 'us-profit-row-active' : undefined}>
                  <td className="py-3.5 pr-4 align-top text-[#d8e6e0] border-t border-white/10">
                    {row.count}
                  </td>
                  <td className="py-3.5 pr-4 align-top text-white border-t border-white/10 whitespace-nowrap">
                    {row.emoji} {row.level}
                    {active ? <span className="ml-2 text-[#7eceb0]">当前</span> : null}
                  </td>
                  <td className="py-3.5 align-top text-[#d8e6e0] border-t border-white/10 leading-relaxed">
                    {row.action}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {resonance ? (
        <p className="mt-5 text-[14px] text-white leading-relaxed">
          {resonance.emoji} 当前：{resonance.levelLabel}（{resonance.triggeredCount}/3）
          {' — '}
          {resonance.action}
        </p>
      ) : null}
    </section>
  );
};

const UsProfitPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<UsProfitSnapshot | null>(null);
  const [error, setError] = useState<ParsedApiError | null>(null);
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

  const signalMap = useMemo(() => {
    const map: Record<string, UsProfitSignal> = {};
    snapshot?.signals.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [snapshot]);

  return (
    <div className="us-profit-page">
      <div className="us-profit-sheet">
        <header className="text-center mb-8 md:mb-10">
          <h1 className="us-profit-title">美股止盈</h1>
          <p className="us-profit-subtitle">三个重要信号</p>
          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-[#8aa39a]">
            <span>北京时间 {snapshot?.updatedAtCn || '实时更新中'}</span>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={isRefreshing}
              className="text-[#7eceb0] hover:text-white disabled:opacity-50"
            >
              {isRefreshing ? '刷新中…' : '立即刷新'}
            </button>
          </div>
        </header>

        {error ? <ApiErrorAlert error={error} className="mb-5" /> : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4">
          {CARD_DEFS.map((def, index) => (
            <PosterCard key={def.id} index={index + 1} def={def} signal={signalMap[def.id]} />
          ))}
        </div>

        <ResonanceBoard resonance={snapshot?.resonance} />

        <p className="text-center text-[11px] text-[#6d837b] mt-6">
          {snapshot?.disclaimer || '仅供参考，不构成投资建议。'} · 每 60 秒自动刷新
        </p>
      </div>
    </div>
  );
};

export default UsProfitPage;
