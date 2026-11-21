import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import {
  CommitteeMember,
  HistoricalReview,
  MAJOR_CATEGORIES,
  ReviewMeeting,
  RuleConfig,
} from '../../types/domain';
import { computeAllConcentrations } from '../../engine/matchingEngine';

interface ConcentrationMonitorProps {
  members: CommitteeMember[];
  history: HistoricalReview[];
  meetings: ReviewMeeting[];
  referenceDate: string;
  config: RuleConfig;
}

export function ConcentrationMonitor({
  members,
  history,
  meetings,
  referenceDate,
  config,
}: ConcentrationMonitorProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'conveners' | 'overcap'>(
    'conveners'
  );

  const allStats = useMemo(
    () =>
      computeAllConcentrations(
        members,
        history,
        meetings,
        referenceDate,
        config
      ),
    [members, history, meetings, referenceDate, config]
  );

  const convenersOnly = useMemo(
    () => allStats.filter((s) => s.canConvene),
    [allStats]
  );

  const overCapCount = convenersOnly.filter(
    (s) => s.convenerOverCapMajors.length > 0
  ).length;
  const coldStartCount = convenersOnly.filter((s) => s.isConvenerColdStart).length;
  const totalParticipations = allStats.reduce(
    (sum, s) => sum + s.participantTotal90d,
    0
  );

  const filteredRows = useMemo(() => {
    if (filterMode === 'conveners') return convenersOnly;
    if (filterMode === 'overcap') {
      return convenersOnly.filter((s) => s.convenerOverCapMajors.length > 0);
    }
    return allStats;
  }, [allStats, convenersOnly, filterMode]);

  const chartData = useMemo(
    () =>
      convenersOnly.map((s) => ({
        name: s.memberName,
        城投: Number((s.convenerRates['城投'] * 100).toFixed(1)),
        工商金融: Number((s.convenerRates['工商金融'] * 100).toFixed(1)),
        结构: Number((s.convenerRates['结构'] * 100).toFixed(1)),
        total: s.convenerTotal90d,
        coldStart: s.isConvenerColdStart,
      })),
    [convenersOnly]
  );

  const capPct = Math.round(config.convenerConcentrationCap * 100);

  return (
    <div className="space-y-6">
      {/* Top KPI Strip - single-elevation, hairline vertical dividers */}
      <div className="bg-white border border-slate-200 rounded-md grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs text-slate-500">在任召集人规模</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {convenersOnly.length}
            </span>
            <span className="text-xs text-slate-500">
              / {members.length} 位在册委员
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            滚动统计窗口：近 {config.concentrationWindowDays} 天（基准日 {referenceDate}）
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">触发 {capPct}% 强制轮换预警</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-semibold font-mono tabular-nums ${
                overCapCount > 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'
              }`}
            >
              {overCapCount}
            </span>
            <span className="text-xs text-slate-500">名召集人受限</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            超限领域将前置排除召集资格（含 {config.chiefPriorityReviewTypes.join('/') || '重点类别'} 重点评审项目）
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">冷启动豁免保护中</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-[#103D6B]">
              {coldStartCount}
            </span>
            <span className="text-xs text-slate-500">
              人（近90天召集 &lt; {config.coldStartThreshold} 场）
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            未达冷启动阈值前不触发集中度强制轮换
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">近90天累计参评人次</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {totalParticipations}
            </span>
            <span className="text-xs text-slate-500">人次</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            包含历史已结项及当日已确认锁定场次
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white border border-slate-200 rounded-md p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              召集人近 {config.concentrationWindowDays} 天三大领域召集集中度分布
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              红色虚线为 {capPct}% 强制轮换红线；仅当近 {config.concentrationWindowDays} 天召集总场次 ≥ {config.coldStartThreshold} 场时生效。
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500">
            红线阈值：{capPct}% · 冷启动：{config.coldStartThreshold} 场
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 12, right: 20, left: 0, bottom: 4 }}
              barCategoryGap="24%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#334155' }}
                axisLine={{ stroke: '#CBD5E1' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [`${value}%`, String(name)]}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#CBD5E1',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <ReferenceLine
                y={capPct}
                stroke="#B91C1C"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{
                  value: `${capPct}% 强制轮换上限`,
                  position: 'insideTopRight',
                  fill: '#B91C1C',
                  fontSize: 11,
                }}
              />
              <Bar dataKey="城投" fill="#103D6B" radius={[2, 2, 0, 0]} maxBarSize={24} />
              <Bar dataKey="工商金融" fill="#3B82F6" radius={[2, 2, 0, 0]} maxBarSize={24} />
              <Bar dataKey="结构" fill="#64748B" radius={[2, 2, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Concentration Table */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              召集人与委员近 {config.concentrationWindowDays} 天集中度明细台账
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              同步展示召集人维度（触发强制轮换依据）与全员参评维度（委员均衡度参考）。
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded self-start sm:self-auto">
            {(
              [
                ['conveners', `仅召集人 (${convenersOnly.length})`],
                ['overcap', `超限预警 (${overCapCount})`],
                ['all', `全部委员 (${allStats.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterMode(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  filterMode === key
                    ? 'bg-white text-[#103D6B] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">委员 / 工号</th>
                <th className="py-3 px-4">职务资格</th>
                <th className="py-3 px-4 text-right">90天召集总场</th>
                {MAJOR_CATEGORIES.map((cat) => (
                  <th key={cat} className="py-3 px-4 text-right">
                    召集 · {cat}
                  </th>
                ))}
                <th className="py-3 px-4">召集人轮换状态</th>
                <th className="py-3 px-4 text-right">全员参评集中度（城投/工商/结构）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    当前筛选条件下暂无符合记录。
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const hasOverCap = row.convenerOverCapMajors.length > 0;
                  return (
                    <tr
                      key={row.memberId}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {row.memberName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {row.employeeCode}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {row.isChiefCommissioner
                          ? `主任委员 · ${row.chiefCategories.join('/')}`
                          : row.canConvene
                          ? '资深召集人'
                          : '专职评审委员'}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {row.canConvene ? `${row.convenerTotal90d} 场` : '—'}
                      </td>

                      {MAJOR_CATEGORIES.map((cat) => {
                        const rate = row.convenerRates[cat];
                        const count = row.convenerByMajor[cat];
                        const isOver =
                          row.canConvene &&
                          !row.isConvenerColdStart &&
                          rate > config.convenerConcentrationCap;
                        return (
                          <td
                            key={cat}
                            className={`py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap ${
                              isOver
                                ? 'text-[#B91C1C] font-semibold'
                                : 'text-slate-700'
                            }`}
                          >
                            {row.canConvene
                              ? `${(rate * 100).toFixed(1)}% (${count})`
                              : '—'}
                          </td>
                        );
                      })}

                      <td className="py-3 px-4 whitespace-nowrap">
                        {!row.canConvene ? (
                          <span className="text-slate-400">非召集人</span>
                        ) : row.isConvenerColdStart ? (
                          <span className="text-[#103D6B] font-medium">
                            冷启动豁免（&lt;{config.coldStartThreshold}场）
                          </span>
                        ) : hasOverCap ? (
                          <span className="text-[#B91C1C] font-semibold">
                            强制轮换 · {row.convenerOverCapMajors.join('、')}超限
                          </span>
                        ) : (
                          <span className="text-[#15803D] font-medium">
                            合规 · 按专业度匹配
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {row.participantTotal90d}场 ·{' '}
                        {(row.participantRates['城投'] * 100).toFixed(0)}% /{' '}
                        {(row.participantRates['工商金融'] * 100).toFixed(0)}% /{' '}
                        {(row.participantRates['结构'] * 100).toFixed(0)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
