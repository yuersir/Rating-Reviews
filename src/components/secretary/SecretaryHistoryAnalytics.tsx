import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Search } from 'lucide-react';
import {
  CommitteeMember,
  HistoricalReview,
  MAJOR_CATEGORIES,
  MajorCategory,
  REVIEW_TYPES,
  REVIEW_TYPE_MAP,
  ReviewTypeCode,
  RuleConfig,
  SeatRole,
  VoteResult,
} from '../../types/domain';
import { triggerFileDownload } from '../../engine/auditHash';

interface SecretaryHistoryAnalyticsProps {
  history: HistoricalReview[];
  members: CommitteeMember[];
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

export function SecretaryHistoryAnalytics({
  history,
  members,
  referenceDate,
  config,
}: SecretaryHistoryAnalyticsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [majorFilter, setMajorFilter] = useState<'ALL' | MajorCategory>('ALL');
  const [reviewTypeFilter, setReviewTypeFilter] = useState<
    'ALL' | ReviewTypeCode
  >('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | SeatRole>('ALL');
  const [voteFilter, setVoteFilter] = useState<'ALL' | VoteResult>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');

  const memberMap = useMemo(() => {
    const map = new Map<string, CommitteeMember>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => b.date.localeCompare(a.date)),
    [history]
  );

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    sortedHistory.forEach((h) => set.add(h.date.slice(0, 7)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [sortedHistory]);

  // Overall KPI metrics
  const kpis = useMemo(() => {
    const total = sortedHistory.length;
    const refMs = new Date(`${referenceDate}T23:59:59`).getTime();
    const windowMs = config.concentrationWindowDays * 24 * 60 * 60 * 1000;
    const last90dCount = sortedHistory.filter((h) => {
      const t = new Date(`${h.date}T12:00:00`).getTime();
      return t <= refMs && refMs - t <= windowMs;
    }).length;

    const approved = sortedHistory.filter(
      (h) => h.voteResult === '通过' || h.voteResult === '有条件通过'
    ).length;
    const rejectedOrDeferred = total - approved;
    const passRate = total > 0 ? ((approved / total) * 100).toFixed(1) : '0.0';

    const priorityCount = sortedHistory.filter((h) =>
      config.chiefPriorityReviewTypes.includes(h.reviewType)
    ).length;
    const priorityPct =
      total > 0 ? ((priorityCount / total) * 100).toFixed(1) : '0.0';

    const byMajor: Record<MajorCategory, number> = {
      城投: 0,
      工商金融: 0,
      结构: 0,
    };
    sortedHistory.forEach((h) => {
      byMajor[h.majorCategory] += 1;
    });

    return {
      total,
      last90dCount,
      passRate,
      rejectedOrDeferred,
      priorityCount,
      priorityPct,
      byMajor,
    };
  }, [sortedHistory, referenceDate, config]);

  // Chart 1: Monthly overall review volume stacked by major category
  const monthlyMajorTrend = useMemo(() => {
    const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
    return months.map((m) => {
      const items = sortedHistory.filter((h) => h.date.startsWith(m));
      return {
        month: m.slice(5) + '月',
        城投: items.filter((h) => h.majorCategory === '城投').length,
        工商金融: items.filter((h) => h.majorCategory === '工商金融').length,
        结构: items.filter((h) => h.majorCategory === '结构').length,
      };
    });
  }, [sortedHistory]);

  // Chart 2: Overall vote result distribution
  const voteDistribution = useMemo(() => {
    const counts: Record<VoteResult, number> = {
      通过: 0,
      有条件通过: 0,
      缓议: 0,
      否决: 0,
    };
    sortedHistory.forEach((h) => {
      counts[h.voteResult] += 1;
    });
    return (['通过', '有条件通过', '缓议', '否决'] as VoteResult[])
      .map((name) => ({ name, value: counts[name], color: VOTE_COLORS[name] }))
      .filter((d) => d.value > 0);
  }, [sortedHistory]);

  // Chart 3: Review Type (A / B1 / B2 / C1 / C2) distribution
  const reviewTypeDistribution = useMemo(() => {
    return REVIEW_TYPES.map((rt) => ({
      code: rt.code,
      label: rt.subLabel,
      count: sortedHistory.filter((h) => h.reviewType === rt.code).length,
      isPriority: config.chiefPriorityReviewTypes.includes(rt.code),
    }));
  }, [sortedHistory, config.chiefPriorityReviewTypes]);

  // Chart 4: Sub-category frequency ranking
  const subCategoryRanking = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; major: MajorCategory }
    >();
    sortedHistory.forEach((h) => {
      const existing = map.get(h.subCategory);
      if (existing) existing.count += 1;
      else
        map.set(h.subCategory, {
          name: h.subCategory,
          count: 1,
          major: h.majorCategory,
        });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [sortedHistory]);

  const filteredHistory = useMemo(() => {
    return sortedHistory.filter((h) => {
      if (majorFilter !== 'ALL' && h.majorCategory !== majorFilter) return false;
      if (reviewTypeFilter !== 'ALL' && h.reviewType !== reviewTypeFilter)
        return false;
      if (roleFilter !== 'ALL' && h.seatRole !== roleFilter) return false;
      if (voteFilter !== 'ALL' && h.voteResult !== voteFilter) return false;
      if (monthFilter !== 'ALL' && !h.date.startsWith(monthFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const mName = memberMap.get(h.memberId)?.name ?? '';
        return (
          h.projectName.toLowerCase().includes(q) ||
          h.issuer.toLowerCase().includes(q) ||
          h.subCategory.toLowerCase().includes(q) ||
          mName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    sortedHistory,
    majorFilter,
    reviewTypeFilter,
    roleFilter,
    voteFilter,
    monthFilter,
    searchQuery,
    memberMap,
  ]);

  const handleExportCSV = () => {
    const header = [
      '记录编号',
      '评审日期',
      '项目名称',
      '发行人',
      '评审类别',
      '专业大类',
      '细分领域',
      '参评委员',
      '担任角色',
      '表决结果',
    ];
    const escapeCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = filteredHistory.map((r) => {
      const m = memberMap.get(r.memberId);
      return [
        r.id,
        r.date,
        r.projectName,
        r.issuer,
        REVIEW_TYPE_MAP[r.reviewType].fullLabel,
        r.majorCategory,
        r.subCategory,
        m ? `${m.name}(${m.employeeCode})` : r.memberId,
        r.seatRole === 'convener' ? '召集人' : '评审委员',
        r.voteResult,
      ]
        .map(escapeCell)
        .join(',');
    });
    const csv = '\uFEFF' + [header.map(escapeCell).join(','), ...rows].join('\n');
    triggerFileDownload(
      `信评委全院历史评审统计台账_${referenceDate}.csv`,
      csv,
      'text/csv;charset=utf-8;'
    );
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs text-slate-500">全院累计历史评审记录</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {kpis.total}
            </span>
            <span className="text-xs text-slate-500">场次</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            其中近 {config.concentrationWindowDays} 天完成 {kpis.last90dCount} 场
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">全院总体评审通过率</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-[#15803D]">
              {kpis.passRate}%
            </span>
            <span className="text-xs text-slate-500">含附条件通过</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            缓议及否决合计 {kpis.rejectedOrDeferred} 场
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">
            重点评审类别（{config.chiefPriorityReviewTypes.join('/') || '未设定'}）
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-[#103D6B]">
              {kpis.priorityCount}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              场（占 {kpis.priorityPct}%）
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            均触发主任委员优先与 60% 红线校验
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">三大专业大类总体分布</div>
          <div className="mt-2 flex items-baseline gap-3 font-mono tabular-nums text-sm font-semibold text-slate-900">
            <span>城投 {kpis.byMajor['城投']}</span>
            <span className="text-slate-300">/</span>
            <span>工商 {kpis.byMajor['工商金融']}</span>
            <span className="text-slate-300">/</span>
            <span>结构 {kpis.byMajor['结构']}</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            覆盖全部 9 个细分行业评审领域
          </div>
        </div>
      </div>

      {/* 4 Overall Analytical Charts (2x2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Monthly Trend by Major Category */}
        <div className="bg-white border border-slate-200 rounded-md p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              全院月度评审场次与大类趋势（近 6 个月）
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              按城投、工商金融、结构三大板块统计月度总体评审工作量
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyMajorTrend}
                margin={{ top: 10, right: 16, left: -16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                  vertical={false}
                />
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
                  formatter={(val: unknown, name: unknown) => [
                    `${val} 场`,
                    String(name),
                  ]}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#CBD5E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="城投" stackId="a" fill="#103D6B" maxBarSize={30} />
                <Bar
                  dataKey="工商金融"
                  stackId="a"
                  fill="#2563EB"
                  maxBarSize={30}
                />
                <Bar
                  dataKey="结构"
                  stackId="a"
                  fill="#94A3B8"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Overall Vote Result Distribution */}
        <div className="bg-white border border-slate-200 rounded-md p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              全院评审表决结果总体分布
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              汇总通过、有条件通过、缓议与否决四类表决占比情况
            </p>
          </div>
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
                  formatter={(val: unknown, name: unknown) => [
                    `${val} 场`,
                    String(name),
                  ]}
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
        </div>

        {/* Chart 3: Objective Review Type (A / B1 / B2 / C1 / C2) Distribution */}
        <div className="bg-white border border-slate-200 rounded-md p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              评审业务类别分布（A / B1 / B2 / C1 / C2）
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              深海蓝高亮当前配置触发主任委员优先的重点评审类别
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={reviewTypeDistribution}
                margin={{ top: 10, right: 16, left: -16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#334155' }}
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
                  formatter={(val: unknown) => [`${val} 场`, '评审场次']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#CBD5E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={34}>
                  {reviewTypeDistribution.map((entry) => (
                    <Cell
                      key={entry.code}
                      fill={entry.isPriority ? '#103D6B' : '#94A3B8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Sub-Category Ranking */}
        <div className="bg-white border border-slate-200 rounded-md p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              全院细分行业领域评审频次排行
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              按 9 个细分专业领域汇总历史项目覆盖密度
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={subCategoryRanking}
                layout="vertical"
                margin={{ top: 2, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                  horizontal={false}
                />
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
                  width={118}
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
                <Bar dataKey="count" radius={[0, 2, 2, 0]} maxBarSize={16}>
                  {subCategoryRanking.map((entry) => (
                    <Cell key={entry.name} fill={MAJOR_COLORS[entry.major]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Full Overall Historical Review Ledger */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              全院历史评审记录总台账（总体视图）
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              共 {sortedHistory.length} 条全院历史评审记录，当前筛选命中{' '}
              {filteredHistory.length} 条
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索项目、发行人或委员..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded w-48 focus:outline-none focus:border-[#103D6B]"
              />
            </div>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
            >
              <option value="ALL">全部月份</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={majorFilter}
              onChange={(e) =>
                setMajorFilter(e.target.value as 'ALL' | MajorCategory)
              }
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
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as 'ALL' | SeatRole)
              }
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
            >
              <option value="ALL">全部席位</option>
              <option value="convener">召集人</option>
              <option value="member">评审委员</option>
            </select>

            <select
              value={voteFilter}
              onChange={(e) =>
                setVoteFilter(e.target.value as 'ALL' | VoteResult)
              }
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
            >
              <option value="ALL">全部表决结果</option>
              {(['通过', '有条件通过', '缓议', '否决'] as VoteResult[]).map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#103D6B] bg-[#EFF6FF] border border-[#103D6B]/20 rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              导出台账 CSV
            </button>
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
                <th className="py-3 px-4">参评委员 / 席位</th>
                <th className="py-3 px-4">表决结果</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    无符合筛选条件的总体历史评审记录。
                  </td>
                </tr>
              ) : (
                filteredHistory.map((rec) => {
                  const member = memberMap.get(rec.memberId);
                  return (
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
                            config.chiefPriorityReviewTypes.includes(
                              rec.reviewType
                            )
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
                        <span className="font-medium text-slate-900">
                          {member?.name ?? rec.memberId}
                        </span>
                        <span className="mx-1.5 text-slate-300">·</span>
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
