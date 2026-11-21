import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Search } from 'lucide-react';
import {
  CommitteeMember,
  HistoricalReview,
  MAJOR_CATEGORIES,
  MajorCategory,
  REVIEW_TYPES,
  REVIEW_TYPE_MAP,
  ReviewMeeting,
  ReviewTypeCode,
  RuleConfig,
  VoteResult,
} from '../../types/domain';
import { computeMemberConcentration } from '../../engine/matchingEngine';

interface MemberAnalyticsProps {
  member: CommitteeMember;
  history: HistoricalReview[];
  meetings: ReviewMeeting[];
  referenceDate: string;
  config: RuleConfig;
}

const VOTE_COLORS: Record<VoteResult, string> = {
  通过: '#15803D',
  有条件通过: '#103D6B',
  缓议: '#B45309',
  否决: '#B91C1C',
};

const MAJOR_COLORS: Record<MajorCategory, string> = {
  城投: '#103D6B',
  工商金融: '#2563EB',
  结构: '#64748B',
};

export function MemberAnalytics({
  member,
  history,
  meetings,
  referenceDate,
  config,
}: MemberAnalyticsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [majorFilter, setMajorFilter] = useState<'ALL' | MajorCategory>('ALL');
  const [reviewTypeFilter, setReviewTypeFilter] = useState<
    'ALL' | ReviewTypeCode
  >('ALL');
  const [voteFilter, setVoteFilter] = useState<'ALL' | VoteResult>('ALL');

  const memberHistory = useMemo(
    () =>
      history
        .filter((h) => h.memberId === member.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [history, member.id]
  );

  const conc = useMemo(
    () =>
      computeMemberConcentration(
        member,
        history,
        meetings,
        referenceDate,
        config
      ),
    [member, history, meetings, referenceDate, config]
  );

  // Chart 1: Vote result distribution
  const voteDistribution = useMemo(() => {
    const counts: Record<VoteResult, number> = {
      通过: 0,
      有条件通过: 0,
      缓议: 0,
      否决: 0,
    };
    memberHistory.forEach((h) => {
      counts[h.voteResult] += 1;
    });
    return (['通过', '有条件通过', '缓议', '否决'] as VoteResult[])
      .map((name) => ({ name, value: counts[name], color: VOTE_COLORS[name] }))
      .filter((d) => d.value > 0);
  }, [memberHistory]);

  // Chart 2: Industry / Sub-sector distribution
  const industryDistribution = useMemo(() => {
    const map = new Map<string, { name: string; count: number; major: MajorCategory }>();
    memberHistory.forEach((h) => {
      const existing = map.get(h.subCategory);
      if (existing) existing.count += 1;
      else map.set(h.subCategory, { name: h.subCategory, count: 1, major: h.majorCategory });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [memberHistory]);

  // Chart 3: Monthly time distribution (2026-06 .. 2026-11)
  const monthlyDistribution = useMemo(() => {
    const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
    return months.map((m) => {
      const items = memberHistory.filter((h) => h.date.startsWith(m));
      const convenerCount = items.filter((h) => h.seatRole === 'convener').length;
      const memberCount = items.filter((h) => h.seatRole === 'member').length;
      return {
        month: m.slice(5) + '月',
        召集人: convenerCount,
        评审委员: memberCount,
      };
    });
  }, [memberHistory]);

  // Chart 4: Near 90-day concentration (Convener vs Participant vs 60% cap)
  const concentrationChartData = useMemo(
    () =>
      MAJOR_CATEGORIES.map((cat) => ({
        category: cat,
        召集集中度: Number((conc.convenerRates[cat] * 100).toFixed(1)),
        参评集中度: Number((conc.participantRates[cat] * 100).toFixed(1)),
      })),
    [conc]
  );

  const filteredHistory = useMemo(() => {
    return memberHistory.filter((h) => {
      if (majorFilter !== 'ALL' && h.majorCategory !== majorFilter) return false;
      if (reviewTypeFilter !== 'ALL' && h.reviewType !== reviewTypeFilter) {
        return false;
      }
      if (voteFilter !== 'ALL' && h.voteResult !== voteFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          h.projectName.toLowerCase().includes(q) ||
          h.issuer.toLowerCase().includes(q) ||
          h.subCategory.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [memberHistory, majorFilter, reviewTypeFilter, voteFilter, searchQuery]);

  const capPct = Math.round(config.convenerConcentrationCap * 100);

  const personalKpis = useMemo(() => {
    const total = memberHistory.length;
    const convenerTotal = memberHistory.filter(
      (h) => h.seatRole === 'convener'
    ).length;
    const approved = memberHistory.filter(
      (h) => h.voteResult === '通过' || h.voteResult === '有条件通过'
    ).length;
    const passRate = total > 0 ? ((approved / total) * 100).toFixed(1) : '0.0';
    const topConvenerRate = Math.max(
      ...MAJOR_CATEGORIES.map((c) => conc.convenerRates[c])
    );
    const topParticipantRate = Math.max(
      ...MAJOR_CATEGORIES.map((c) => conc.participantRates[c])
    );
    return {
      total,
      convenerTotal,
      passRate,
      topConvenerPct: (topConvenerRate * 100).toFixed(1),
      topParticipantPct: (topParticipantRate * 100).toFixed(1),
    };
  }, [memberHistory, conc]);

  return (
    <div className="space-y-6">
      {/* Personal Scope Privacy & Summary KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs text-slate-500">本人累计评审场次</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {personalKpis.total}
            </span>
            <span className="text-xs text-slate-500">场（仅限本人可见）</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            近 {config.concentrationWindowDays} 天参评 {conc.participantTotal90d} 场
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">担任召集人累计场次</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-[#103D6B]">
              {personalKpis.convenerTotal}
            </span>
            <span className="text-xs text-slate-500">
              {member.canConvene ? '场（具备召集资格）' : '场（评审委员）'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            近 {config.concentrationWindowDays} 天召集 {conc.convenerTotal90d} 场
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">本人表决通过率</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-[#15803D]">
              {personalKpis.passRate}%
            </span>
            <span className="text-xs text-slate-500">含附条件通过</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            独立表决历史均已归档不可篡改
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">近 90 天最高大类集中度</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-semibold font-mono tabular-nums ${
                conc.convenerOverCapMajors.length > 0
                  ? 'text-[#B91C1C]'
                  : 'text-slate-900'
              }`}
            >
              {member.canConvene
                ? `${personalKpis.topConvenerPct}%`
                : `${personalKpis.topParticipantPct}%`}
            </span>
            <span className="text-xs text-slate-500">
              {member.canConvene ? `红线 ${capPct}%` : '参评维度'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {conc.convenerOverCapMajors.length > 0
              ? `触发轮换：${conc.convenerOverCapMajors.join('、')}`
              : '各领域集中度处于合规区间'}
          </div>
        </div>
      </div>

      {/* 4 Charts Grid (2x2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Vote Result Distribution */}
        <div className="bg-white border border-slate-200 rounded-md p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              历史投票结果分布
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              累计有效表决 {memberHistory.length} 场次（含通过、有条件通过、缓议与否决）
            </p>
          </div>
          {voteDistribution.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              暂无历史投票记录
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={voteDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {voteDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: unknown, name: unknown) => [`${val} 场`, String(name)]}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#CBD5E1',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 2. Near 90-day Concentration vs 60% Redline */}
        <div className="bg-white border border-slate-200 rounded-md p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                近 {config.concentrationWindowDays} 天大类集中度与 {capPct}% 红线
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {member.canConvene
                  ? conc.isConvenerColdStart
                    ? `近90天召集 ${conc.convenerTotal90d} 场（冷启动阈值 ${config.coldStartThreshold} 场内豁免）`
                    : `近90天召集 ${conc.convenerTotal90d} 场 · ${
                        conc.convenerOverCapMajors.length > 0
                          ? `超限强制轮换：${conc.convenerOverCapMajors.join('、')}`
                          : '全部领域合规'
                      }`
                  : `非召集人身份 · 近90天累计参评 ${conc.participantTotal90d} 场`}
              </p>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={concentrationChartData}
                margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="category"
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
                  formatter={(val: unknown, name: unknown) => [`${val}%`, String(name)]}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#CBD5E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <ReferenceLine
                  y={capPct}
                  stroke="#B91C1C"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `${capPct}%上限`,
                    position: 'insideTopRight',
                    fill: '#B91C1C',
                    fontSize: 11,
                  }}
                />
                {member.canConvene && (
                  <Bar dataKey="召集集中度" fill="#103D6B" radius={[2, 2, 0, 0]} maxBarSize={28} />
                )}
                <Bar dataKey="参评集中度" fill="#94A3B8" radius={[2, 2, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Industry / Sub-sector Distribution */}
        <div className="bg-white border border-slate-200 rounded-md p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              细分行业领域评审分布
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              按历史参评及召集项目归属细分领域统计场次
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={industryDistribution}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={116}
                  tick={{ fontSize: 11, fill: '#334155' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: unknown) => [`${val} 场`, '评审场次']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#CBD5E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" radius={[0, 2, 2, 0]} maxBarSize={18}>
                  {industryDistribution.map((entry) => (
                    <Cell key={entry.name} fill={MAJOR_COLORS[entry.major]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Monthly Time Distribution */}
        <div className="bg-white border border-slate-200 rounded-md p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              月度评审时间分布（近 6 个月）
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              区分担任召集人与普通评审委员的月度工作负荷变化
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyDistribution}
                margin={{ top: 10, right: 16, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#334155' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: unknown, name: unknown) => [`${val} 场`, String(name)]}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#CBD5E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="召集人" stackId="a" fill="#103D6B" maxBarSize={28} />
                <Bar dataKey="评审委员" stackId="a" fill="#93C5FD" radius={[2, 2, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Historical Review Records Table */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              历史评审记录明细（{member.name}）
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              共 {memberHistory.length} 条历史记录，筛选命中 {filteredHistory.length} 条
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索项目或发行人..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded w-48 focus:outline-none focus:border-[#103D6B]"
              />
            </div>

            <select
              value={majorFilter}
              onChange={(e) => setMajorFilter(e.target.value as 'ALL' | MajorCategory)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
            >
              <option value="ALL">全部大类</option>
              {MAJOR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={reviewTypeFilter}
              onChange={(e) =>
                setReviewTypeFilter(e.target.value as 'ALL' | ReviewTypeCode)
              }
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
            >
              <option value="ALL">全部评审类别</option>
              {REVIEW_TYPES.map((rt) => (
                <option key={rt.code} value={rt.code}>
                  {rt.fullLabel}
                </option>
              ))}
            </select>

            <select
              value={voteFilter}
              onChange={(e) => setVoteFilter(e.target.value as 'ALL' | VoteResult)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
            >
              <option value="ALL">全部表决结果</option>
              {(['通过', '有条件通过', '缓议', '否决'] as VoteResult[]).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500">
                <th className="py-3 px-4">评审日期</th>
                <th className="py-3 px-4">项目名称 / 发行人</th>
                <th className="py-3 px-4">评审类别</th>
                <th className="py-3 px-4">所属大类 · 细分领域</th>
                <th className="py-3 px-4">担任角色</th>
                <th className="py-3 px-4">个人表决结果</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    无符合筛选条件的历史评审记录。
                  </td>
                </tr>
              ) : (
                filteredHistory.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {rec.date}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {rec.projectName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {rec.issuer}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={
                          config.chiefPriorityReviewTypes.includes(rec.reviewType)
                            ? 'font-semibold text-[#103D6B]'
                            : 'text-slate-700'
                        }
                      >
                        {REVIEW_TYPE_MAP[rec.reviewType].fullLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {rec.majorCategory} · {rec.subCategory}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={
                          rec.seatRole === 'convener'
                            ? 'font-semibold text-[#103D6B]'
                            : 'text-slate-600'
                        }
                      >
                        {rec.seatRole === 'convener' ? '召集人' : '评审委员'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className="font-medium"
                        style={{ color: VOTE_COLORS[rec.voteResult] }}
                      >
                        {rec.voteResult}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
