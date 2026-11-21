import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Lock,
  RotateCcw,
  Save,
  Scale,
  ShieldCheck,
  Vote,
} from 'lucide-react';
import {
  HALF_DAY_SLOTS,
  MeetingSeat,
  MemberCalculationSnapshot,
  RatingGrade,
  RatingOutlook,
  REVIEW_TYPE_MAP,
  ReviewMeeting,
  VoteResult,
} from '../../types/domain';
import {
  RATING_GRADES,
  RATING_OUTLOOKS,
  SCORE_BANDS,
  applyNotchAdjustment,
  computeWeightedModelScore,
  getMeetingWindowPresetClocks,
  getProjectMaterials,
  getVotingWindowInfo,
  scoreToIndicativeRating,
} from '../../data/projectMaterials';

type DeskTab = 'report' | 'papers' | 'model' | 'calculator' | 'vote';

const VOTE_OPTIONS: Array<{
  value: VoteResult;
  label: string;
  desc: string;
}> = [
  { value: '通过', label: '通过', desc: '同意项目组或本人拟定信用等级及展望结论' },
  { value: '有条件通过', label: '有条件通过', desc: '附带明确补充核查、增信或披露落实前提条件' },
  { value: '缓议', label: '缓议', desc: '关键风险信息尚待补充，建议暂缓表决择期复议' },
  { value: '否决', label: '否决', desc: '不同意现行评级建议或认为信用风险未充分揭示' },
];

interface ProjectReviewDeskProps {
  meeting: ReviewMeeting;
  seat: MeetingSeat;
  simulatedClockIso: string;
  onSetSimulatedClock: (iso: string) => void;
  onBack: () => void;
  onOpenDeclarationCertificate: () => void;
  onSaveCalculation: (
    meetingId: string,
    seatId: string,
    snapshot: MemberCalculationSnapshot
  ) => void;
  onSubmitVote: (
    meetingId: string,
    seatId: string,
    payload: {
      voteResult: VoteResult;
      proposedRating: RatingGrade;
      proposedOutlook: RatingOutlook;
      opinionText: string;
      conditionsText?: string;
      referencedCalcScore?: number;
      referencedCalcRating?: RatingGrade;
    }
  ) => void;
}

export function ProjectReviewDesk({
  meeting,
  seat,
  simulatedClockIso,
  onSetSimulatedClock,
  onBack,
  onOpenDeclarationCertificate,
  onSaveCalculation,
  onSubmitVote,
}: ProjectReviewDeskProps) {
  const [activeTab, setActiveTab] = useState<DeskTab>('report');
  const [expandedPaperIds, setExpandedPaperIds] = useState<Record<string, boolean>>({
    'wp-1': true,
  });

  const materials = useMemo(() => getProjectMaterials(meeting), [meeting]);
  const windowInfo = useMemo(
    () => getVotingWindowInfo(meeting, simulatedClockIso),
    [meeting, simulatedClockIso]
  );
  const clockPresets = useMemo(
    () => getMeetingWindowPresetClocks(meeting),
    [meeting]
  );

  const analystTotalNotch = useMemo(
    () => materials.modelNotchItems.reduce((s, n) => s + n.delta, 0),
    [materials.modelNotchItems]
  );

  const initialFactorScores = useMemo(() => {
    const map: Record<string, number> = {};
    materials.modelFactors.forEach((f) => {
      map[f.id] = seat.memberCalcSnapshot?.factorScores[f.id] ?? f.analystScore;
    });
    return map;
  }, [materials.modelFactors, seat.memberCalcSnapshot]);

  // Self-calculation sandbox state
  const [scenarioLabel, setScenarioLabel] = useState<string>(
    seat.memberCalcSnapshot?.scenarioLabel ?? '项目组基准情景'
  );
  const [factorScores, setFactorScores] =
    useState<Record<string, number>>(initialFactorScores);
  const [notchDelta, setNotchDelta] = useState<number>(
    seat.memberCalcSnapshot?.notchDelta ?? analystTotalNotch
  );
  const [calcMemo, setCalcMemo] = useState<string>(
    seat.memberCalcSnapshot?.memo ?? ''
  );

  // Opinion & voting form state
  const [voteResult, setVoteResult] = useState<VoteResult>(
    seat.reviewSubmission?.voteResult ?? '通过'
  );
  const [proposedRating, setProposedRating] = useState<RatingGrade>(
    seat.reviewSubmission?.proposedRating ??
      seat.memberCalcSnapshot?.finalRating ??
      materials.proposedRating
  );
  const [proposedOutlook, setProposedOutlook] = useState<RatingOutlook>(
    seat.reviewSubmission?.proposedOutlook ?? materials.proposedOutlook
  );
  const [opinionText, setOpinionText] = useState<string>(
    seat.reviewSubmission?.opinionText ?? ''
  );
  const [conditionsText, setConditionsText] = useState<string>(
    seat.reviewSubmission?.conditionsText ?? ''
  );
  const [formError, setFormError] = useState<string>('');

  // Reset local states when switching meetings/seats
  useEffect(() => {
    const map: Record<string, number> = {};
    materials.modelFactors.forEach((f) => {
      map[f.id] = seat.memberCalcSnapshot?.factorScores[f.id] ?? f.analystScore;
    });
    setFactorScores(map);
    setScenarioLabel(seat.memberCalcSnapshot?.scenarioLabel ?? '项目组基准情景');
    setNotchDelta(seat.memberCalcSnapshot?.notchDelta ?? analystTotalNotch);
    setCalcMemo(seat.memberCalcSnapshot?.memo ?? '');

    setVoteResult(seat.reviewSubmission?.voteResult ?? '通过');
    setProposedRating(
      seat.reviewSubmission?.proposedRating ??
        seat.memberCalcSnapshot?.finalRating ??
        materials.proposedRating
    );
    setProposedOutlook(
      seat.reviewSubmission?.proposedOutlook ?? materials.proposedOutlook
    );
    setOpinionText(seat.reviewSubmission?.opinionText ?? '');
    setConditionsText(seat.reviewSubmission?.conditionsText ?? '');
    setFormError('');
  }, [meeting.id, seat.seatId, materials, analystTotalNotch, seat.memberCalcSnapshot, seat.reviewSubmission]);

  // Live computed results for self-calculation
  const customScore = useMemo(
    () => computeWeightedModelScore(materials.modelFactors, factorScores),
    [materials.modelFactors, factorScores]
  );
  const customBaseRating = useMemo(
    () => scoreToIndicativeRating(customScore),
    [customScore]
  );
  const customFinalRating = useMemo(
    () => applyNotchAdjustment(customBaseRating, notchDelta),
    [customBaseRating, notchDelta]
  );
  const scoreDiff = Number((customScore - materials.analystBaseScore).toFixed(1));
  const gradeDeltaSteps =
    RATING_GRADES.indexOf(materials.analystFinalRating) -
    RATING_GRADES.indexOf(customFinalRating);

  const slotDef = HALF_DAY_SLOTS[meeting.halfDay].find(
    (s) => s.slotIndex === meeting.slotIndex
  );

  // Hard guard: should never render unlocked content if conflict declaration is unsigned
  if (seat.status !== 'confirmed' || !seat.conflictDeclaration) {
    return (
      <div className="bg-white border border-slate-200 rounded-md p-10 text-center space-y-4">
        <div className="w-10 h-10 rounded bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5" />
        </div>
        <div className="text-sm font-semibold text-slate-900">
          项目资料与评审表决尚未解锁
        </div>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          依据合规保密要求，须先完成本项目《利益冲突回避承诺函》电子签署后，方可查阅评级报告、工作底稿、模型测算依据并进行自行测算与评审投票。
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回当日日程完成签署
        </button>
      </div>
    );
  }

  const applyScenarioPreset = (preset: 'baseline' | 'cautious' | 'severe') => {
    const next: Record<string, number> = {};
    if (preset === 'baseline') {
      materials.modelFactors.forEach((f) => {
        next[f.id] = f.analystScore;
      });
      setFactorScores(next);
      setNotchDelta(analystTotalNotch);
      setScenarioLabel('项目组基准情景');
    } else if (preset === 'cautious') {
      materials.modelFactors.forEach((f, idx) => {
        const shift = idx === 2 || idx === 3 ? -8 : -4;
        next[f.id] = Math.max(0, Math.min(100, f.analystScore + shift));
      });
      setFactorScores(next);
      setNotchDelta(Math.max(-3, analystTotalNotch - 1));
      setScenarioLabel('审慎压力情景（债务与流动性承压）');
    } else {
      materials.modelFactors.forEach((f, idx) => {
        const shift = idx === 2 || idx === 3 ? -15 : -8;
        next[f.id] = Math.max(0, Math.min(100, f.analystScore + shift));
      });
      setFactorScores(next);
      setNotchDelta(Math.max(-3, analystTotalNotch - 2));
      setScenarioLabel('极端压力情景（再融资显著收紧）');
    }
  };

  const handleSaveCalcSnapshot = () => {
    const snapshot: MemberCalculationSnapshot = {
      scenarioLabel,
      factorScores: { ...factorScores },
      notchDelta,
      computedScore: customScore,
      baseRating: customBaseRating,
      finalRating: customFinalRating,
      memo: calcMemo.trim(),
      savedAt: new Date().toISOString(),
    };
    onSaveCalculation(meeting.id, seat.seatId, snapshot);
  };

  const buildCalcSummaryProse = () => {
    const diffText =
      scoreDiff === 0
        ? '与项目组基准分一致'
        : `较项目组基准分 ${scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff} 分`;
    const memoSuffix = calcMemo.trim() ? ` 关键分析依据：${calcMemo.trim()}。` : '';
    return `经查阅评级报告、工作底稿及模型测算依据，本人基于「${scenarioLabel}」完成独立测算，模型加权得分 ${customScore.toFixed(
      1
    )} 分（${diffText}），综合子级调整（${
      notchDelta >= 0 ? `+${notchDelta}` : notchDelta
    } 级）后测算级别为 ${customFinalRating}。${memoSuffix}`;
  };

  const handleCarryCalcToVote = () => {
    const summaryText = buildCalcSummaryProse();
    setProposedRating(customFinalRating);
    setOpinionText((prev) =>
      prev.trim() ? `${prev.trim()}\n${summaryText}` : summaryText
    );
    setActiveTab('vote');
  };

  const handleSubmitVoteForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (windowInfo.status !== 'open') {
      setFormError(windowInfo.detailText);
      return;
    }
    if (!opinionText.trim()) {
      setFormError('请填写本人独立评审意见后再提交表决。');
      return;
    }
    if (voteResult === '有条件通过' && !conditionsText.trim()) {
      setFormError('选择「有条件通过」时，必须明确填写须落实的前提条件。');
      return;
    }
    setFormError('');
    onSubmitVote(meeting.id, seat.seatId, {
      voteResult,
      proposedRating,
      proposedOutlook,
      opinionText: opinionText.trim(),
      conditionsText:
        voteResult === '有条件通过' ? conditionsText.trim() : undefined,
      referencedCalcScore: customScore,
      referencedCalcRating: customFinalRating,
    });
  };

  const togglePaper = (id: string) => {
    setExpandedPaperIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isVotingOpen = windowInfo.status === 'open';

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb & Dossier Header */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-6 py-3.5 bg-[#F8FAFC] border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 font-medium text-[#103D6B] hover:underline whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回当日日程与签署
            </button>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <span className="font-mono text-slate-600">{meeting.code}</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-slate-600">
              {meeting.date} {meeting.halfDay === 'AM' ? '上午' : '下午'}第
              {meeting.slotIndex}场（{slotDef?.timeRange}）
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-[#15803D] font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              已签署回避承诺函（资料已解封）
            </span>
            <button
              type="button"
              onClick={onOpenDeclarationCertificate}
              className="inline-flex items-center gap-1 text-[#103D6B] hover:underline whitespace-nowrap"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              查验承诺函
            </button>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-[#103D6B]">
                {REVIEW_TYPE_MAP[meeting.reviewType].fullLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {meeting.majorCategory} / {meeting.subCategory}
              </span>
              <span aria-hidden="true">·</span>
              <span>担任席位：{seat.seatLabel}</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              {meeting.projectName}
            </h2>
            <div className="text-xs text-slate-600">
              发行人：{meeting.issuer} · 评级报告编号{' '}
              <span className="font-mono text-slate-700">{materials.reportCode}</span>
              （{materials.reportVersion}）
            </div>
          </div>

          {/* Right: Voting Window Summary & Quick Jump */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
            <div className="text-xs sm:text-right">
              <div
                className={`font-semibold ${
                  windowInfo.status === 'open'
                    ? 'text-[#15803D]'
                    : windowInfo.status === 'before'
                    ? 'text-[#B45309]'
                    : 'text-[#B91C1C]'
                }`}
              >
                {windowInfo.statusLabel}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                表决窗口：{windowInfo.windowStartLabel} 至 {windowInfo.windowEndLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('vote')}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors whitespace-nowrap"
            >
              <Vote className="w-3.5 h-3.5" />
              {seat.reviewSubmission
                ? `已表决：${seat.reviewSubmission.voteResult}`
                : '发表意见与投票'}
            </button>
          </div>
        </div>

        {/* Inner Horizontal Section Tabs */}
        <div className="px-6 border-t border-slate-200 bg-white flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'report', label: '评级报告', icon: FileText },
              {
                id: 'papers',
                label: `工作底稿 (${materials.workingPapers.length})`,
                icon: FolderOpen,
              },
              { id: 'model', label: '模型测算依据', icon: FileSpreadsheet },
              {
                id: 'calculator',
                label: seat.memberCalcSnapshot
                  ? `自行测算分析 (${seat.memberCalcSnapshot.finalRating})`
                  : '自行测算分析',
                icon: Calculator,
              },
              {
                id: 'vote',
                label: seat.reviewSubmission
                  ? `评审意见与表决 (已提交)`
                  : '评审意见与表决',
                icon: Vote,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-[#103D6B] text-[#103D6B]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: Rating Report (评级报告) */}
      {activeTab === 'report' && (
        <div className="space-y-5">
          {/* 4-Column Executive KPI Strip */}
          <div className="bg-white border border-slate-200 rounded-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            <div className="p-5">
              <div className="text-xs text-slate-500">项目组建议级别 / 展望</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-[#103D6B] tabular-nums">
                  {materials.proposedRating}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    materials.proposedOutlook === '负面'
                      ? 'text-[#B91C1C]'
                      : materials.proposedOutlook === '列入信用评级观察名单'
                      ? 'text-[#B45309]'
                      : 'text-[#15803D]'
                  }`}
                >
                  展望：{materials.proposedOutlook}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                基础级别 {materials.analystBaseRating} · 模型分{' '}
                {materials.analystBaseScore.toFixed(1)}
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs text-slate-500">拟发行规模与期限</div>
              <div className="mt-1.5 text-sm font-semibold text-slate-900 tabular-nums">
                {materials.issuanceScale}
              </div>
              <div className="mt-1 text-xs text-slate-500">{materials.tenor}</div>
            </div>

            <div className="p-5">
              <div className="text-xs text-slate-500">适用评级方法</div>
              <div className="mt-1.5 text-xs font-semibold text-slate-900 leading-snug">
                {materials.methodologyName}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-mono">
                生成时间：{materials.generatedAt}
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs text-slate-500">承做分析师团队</div>
              <div className="mt-1.5 text-sm font-semibold text-slate-900">
                {materials.analysts.join(' / ')}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                工作底稿 {materials.workingPapers.length} 份已质控归档
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="bg-white border border-slate-200 rounded-md p-6 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              评级结论与核心逻辑摘要
            </h3>
            <p className="text-xs text-slate-700 leading-6">
              {materials.executiveSummary}
            </p>
          </div>

          {/* 2-Column Balanced Strengths & Concerns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            <div className="bg-white border border-slate-200 rounded-md p-6 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">
                  主要信用优势
                </h3>
                <span className="text-xs font-medium text-[#15803D]">
                  正面支撑因素
                </span>
              </div>
              <ul className="mt-4 space-y-3 text-xs text-slate-700 leading-relaxed flex-1">
                {materials.creditStrengths.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="font-mono font-semibold text-[#103D6B] shrink-0">
                      0{idx + 1}.
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-md p-6 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">
                  核心信用风险与关注点
                </h3>
                <span className="text-xs font-medium text-[#B45309]">
                  重点审议事项
                </span>
              </div>
              <ul className="mt-4 space-y-3 text-xs text-slate-700 leading-relaxed flex-1">
                {materials.creditConcerns.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="font-mono font-semibold text-[#B45309] shrink-0">
                      0{idx + 1}.
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 3-Year Key Financial / Credit Metrics Table */}
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  近三年及一期核心财务与信用指标概览
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  数据源于审计报告与 2026Q3 未经审计财务报表核验口径
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('model')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#103D6B] hover:underline whitespace-nowrap"
              >
                查看模型打分依据
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500">
                    <th className="text-left font-medium px-6 py-3">核心指标</th>
                    <th className="text-left font-medium px-4 py-3">单位</th>
                    <th className="text-right font-medium px-4 py-3">2024 年</th>
                    <th className="text-right font-medium px-4 py-3">2025 年</th>
                    <th className="text-right font-medium px-4 py-3">2026 年 Q3</th>
                    <th className="text-left font-medium px-6 py-3">趋势与核查说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {materials.financialMetrics.map((row) => (
                    <tr key={row.indicator} className="hover:bg-slate-50/70">
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {row.indicator}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.unit}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {row.y2024}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {row.y2025}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {row.y2026Q3}
                      </td>
                      <td className="px-6 py-3 text-slate-600">{row.trendNote}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Working Papers (工作底稿) */}
      {activeTab === 'papers' && (
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                评级尽职调查与质控复核工作底稿目录
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                所有底稿均已完成质控双人复核归档，仅供已签署《利益冲突回避承诺函》的本场评审委员保密查阅
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              共 {materials.workingPapers.length} 份归档底稿
            </span>
          </div>

          <div className="divide-y divide-slate-200">
            {materials.workingPapers.map((wp) => {
              const expanded = Boolean(expandedPaperIds[wp.id]);
              return (
                <div key={wp.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-[#103D6B]">
                          {wp.code}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{wp.category}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            wp.status === '重点关注提示'
                              ? 'font-semibold text-[#B45309]'
                              : 'font-medium text-[#15803D]'
                          }
                        >
                          {wp.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {wp.title}
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {wp.summary}
                      </p>
                      <div className="text-[11px] text-slate-500 pt-0.5">
                        编制：{wp.preparedBy} · 复核：{wp.reviewedBy} · 归档日期：
                        <span className="font-mono tabular-nums">{wp.verifiedDate}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => togglePaper(wp.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#103D6B] bg-[#EFF6FF] border border-[#103D6B]/20 rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap shrink-0 self-start"
                    >
                      {expanded ? (
                        <>
                          收起底稿详情
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          展开核查发现与摘录
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-800 mb-2">
                          关键核查发现
                        </div>
                        <ul className="space-y-1.5 text-xs text-slate-700">
                          {wp.keyFindings.map((finding, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="font-mono text-slate-400">
                                {idx + 1}.
                              </span>
                              <span>{finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 bg-[#F8FAFC] border border-slate-200 rounded text-xs text-slate-700 leading-relaxed">
                        {wp.rawExcerpt}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Model Calculation Basis (模型测算依据) */}
      {activeTab === 'model' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {materials.modelName}（{materials.modelVersion}）
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  透明披露项目组定量/定性因子权重、原始核验值、打分依据及子级调整逻辑
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('calculator')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] whitespace-nowrap"
              >
                <Calculator className="w-3.5 h-3.5" />
                基于此模型进行自行测算
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500">
                    <th className="text-left font-medium px-6 py-3">评估维度与因子</th>
                    <th className="text-right font-medium px-4 py-3">权重</th>
                    <th className="text-left font-medium px-4 py-3">原始核验指标值</th>
                    <th className="text-right font-medium px-4 py-3">项目组得分</th>
                    <th className="text-right font-medium px-4 py-3">加权贡献</th>
                    <th className="text-left font-medium px-6 py-3">打分测算依据</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {materials.modelFactors.map((f) => {
                    const contrib = ((f.analystScore * f.weight) / 100).toFixed(2);
                    return (
                      <tr key={f.id} className="hover:bg-slate-50/70 align-top">
                        <td className="px-6 py-3.5">
                          <div className="font-semibold text-slate-900">
                            {f.dimension}
                          </div>
                          <div className="text-slate-500 mt-0.5">{f.factorName}</div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                          {f.weight}%
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">{f.rawMetric}</td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {f.analystScore}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#103D6B] font-semibold">
                          {contrib}
                        </td>
                        <td className="px-6 py-3.5 text-slate-600 leading-relaxed max-w-sm">
                          {f.basisNote}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F8FAFC] border-t border-slate-200 font-semibold text-slate-900">
                    <td className="px-6 py-3">模型加权合计（基础映射级别）</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">100%</td>
                    <td className="px-4 py-3 text-slate-500 font-normal">
                      基础级别：{materials.analystBaseRating}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">—</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#103D6B]">
                      {materials.analystBaseScore.toFixed(1)}
                    </td>
                    <td className="px-6 py-3 text-slate-600 font-normal">
                      叠加外部支持/专项调整（
                      {analystTotalNotch >= 0
                        ? `+${analystTotalNotch}`
                        : analystTotalNotch}{' '}
                      子级）→ 建议级别{' '}
                      <strong className="font-mono text-[#103D6B]">
                        {materials.analystFinalRating}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            <div className="bg-white border border-slate-200 rounded-md p-6 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">
                外部支持与专项子级调整（Notch Adjustment）
              </h4>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded">
                {materials.modelNotchItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex items-start justify-between gap-4 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {item.label}
                      </div>
                      <div className="text-slate-600 mt-1 leading-relaxed">
                        {item.rationale}
                      </div>
                    </div>
                    <span
                      className={`font-mono font-semibold tabular-nums shrink-0 ${
                        item.delta > 0
                          ? 'text-[#15803D]'
                          : item.delta < 0
                          ? 'text-[#B91C1C]'
                          : 'text-slate-500'
                      }`}
                    >
                      {item.delta > 0 ? `+${item.delta}` : item.delta} 子级
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-md p-6 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">
                模型得分与指示性信用等级映射标尺
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {SCORE_BANDS.map((band) => {
                  const isBase = band.grade === materials.analystBaseRating;
                  return (
                    <div
                      key={band.grade}
                      className={`p-3 rounded border text-center ${
                        isBase
                          ? 'bg-[#EFF6FF] border-[#103D6B] text-[#103D6B]'
                          : 'bg-[#F8FAFC] border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="text-sm font-bold font-mono">
                        {band.grade}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums mt-0.5 opacity-85">
                        {band.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Interactive Self-Calculation Sandbox (委员自行测算分析) */}
      {activeTab === 'calculator' && (
        <div className="space-y-5">
          {/* Live Side-by-Side Comparison Strip */}
          <div className="bg-white border border-slate-200 rounded-md grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            <div className="p-5">
              <div className="text-xs text-slate-500">项目组基准测算</div>
              <div className="mt-1.5 flex items-baseline gap-3">
                <span className="text-2xl font-bold font-mono text-slate-800 tabular-nums">
                  {materials.analystFinalRating}
                </span>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  模型分 {materials.analystBaseScore.toFixed(1)} · 调整{' '}
                  {analystTotalNotch >= 0
                    ? `+${analystTotalNotch}`
                    : analystTotalNotch}{' '}
                  级
                </span>
              </div>
            </div>

            <div className="p-5 bg-[#F8FAFC]">
              <div className="text-xs font-medium text-[#103D6B]">
                本人实时自行测算结果
              </div>
              <div className="mt-1.5 flex items-baseline gap-3">
                <span className="text-2xl font-bold font-mono text-[#103D6B] tabular-nums">
                  {customFinalRating}
                </span>
                <span className="text-xs font-mono text-slate-700 tabular-nums">
                  模型分 {customScore.toFixed(1)}（基础 {customBaseRating}）· 调整{' '}
                  {notchDelta >= 0 ? `+${notchDelta}` : notchDelta} 级
                </span>
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs text-slate-500">与项目组偏离度</div>
              <div className="mt-1.5 flex items-baseline gap-3">
                <span
                  className={`text-xl font-bold font-mono tabular-nums ${
                    scoreDiff > 0
                      ? 'text-[#15803D]'
                      : scoreDiff < 0
                      ? 'text-[#B91C1C]'
                      : 'text-slate-700'
                  }`}
                >
                  {scoreDiff > 0 ? `+${scoreDiff.toFixed(1)}` : scoreDiff.toFixed(1)} 分
                </span>
                <span className="text-xs font-medium text-slate-600">
                  {gradeDeltaSteps === 0
                    ? '最终级别与项目组一致'
                    : gradeDeltaSteps > 0
                    ? `较项目组高 ${gradeDeltaSteps} 个子级`
                    : `较项目组低 ${Math.abs(gradeDeltaSteps)} 个子级`}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Factor Slider Table */}
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  委员独立敏感性与压力情景测算台
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  拖动因子评分或套用压力情景，实时测算指示性信用等级（会前即可随时预演保存，不影响项目组原稿）
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => applyScenarioPreset('baseline')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  还原项目组基准
                </button>
                <button
                  type="button"
                  onClick={() => applyScenarioPreset('cautious')}
                  className="px-3 py-1.5 text-xs font-medium text-[#B45309] bg-amber-50 border border-amber-200 rounded hover:bg-amber-100/70 whitespace-nowrap"
                >
                  审慎压力情景
                </button>
                <button
                  type="button"
                  onClick={() => applyScenarioPreset('severe')}
                  className="px-3 py-1.5 text-xs font-medium text-[#B91C1C] bg-red-50 border border-red-200 rounded hover:bg-red-100/70 whitespace-nowrap"
                >
                  极端压力情景
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {materials.modelFactors.map((f) => {
                const val = factorScores[f.id] ?? f.analystScore;
                const diff = val - f.analystScore;
                return (
                  <div
                    key={f.id}
                    className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
                  >
                    <div className="lg:col-span-5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900">
                          {f.dimension}
                        </span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          权重 {f.weight}%
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {f.factorName}（{f.rawMetric}）
                      </div>
                    </div>

                    <div className="lg:col-span-5 flex items-center gap-3">
                      <input
                        type="range"
                        min={20}
                        max={100}
                        step={1}
                        value={val}
                        aria-label={`${f.dimension} 委员测算评分`}
                        onChange={(e) => {
                          const nextVal = Number(e.target.value);
                          setFactorScores((prev) => ({
                            ...prev,
                            [f.id]: nextVal,
                          }));
                          setScenarioLabel('委员自定义测算情景');
                        }}
                        className="flex-1 accent-[#103D6B] cursor-pointer"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={val}
                        onChange={(e) => {
                          const clamped = Math.max(
                            0,
                            Math.min(100, Number(e.target.value) || 0)
                          );
                          setFactorScores((prev) => ({
                            ...prev,
                            [f.id]: clamped,
                          }));
                          setScenarioLabel('委员自定义测算情景');
                        }}
                        className="w-16 px-2 py-1 text-xs font-mono text-right tabular-nums border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                      />
                    </div>

                    <div className="lg:col-span-2 flex items-center justify-between lg:justify-end gap-3 text-xs font-mono tabular-nums">
                      <span className="text-slate-500">
                        原 {f.analystScore}
                      </span>
                      <span
                        className={`font-semibold ${
                          diff > 0
                            ? 'text-[#15803D]'
                            : diff < 0
                            ? 'text-[#B91C1C]'
                            : 'text-slate-400'
                        }`}
                      >
                        {diff > 0 ? `+${diff}` : diff === 0 ? '±0' : diff}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notch Adjustment + Memo + Actions */}
            <div className="px-6 py-5 bg-[#F8FAFC] border-t border-slate-200 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      外部支持 / 流动性专项子级调整（Notch）
                    </span>
                    <span className="font-mono font-semibold text-[#103D6B] tabular-nums">
                      {notchDelta > 0 ? `+${notchDelta}` : notchDelta} 子级
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[-3, -2, -1, 0, 1, 2, 3].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => {
                          setNotchDelta(step);
                          setScenarioLabel('委员自定义测算情景');
                        }}
                        className={`flex-1 py-1.5 text-xs font-mono tabular-nums rounded border transition-colors ${
                          notchDelta === step
                            ? 'bg-[#103D6B] text-white border-[#103D6B]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {step > 0 ? `+${step}` : step}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    项目组原设子级调整：{analystTotalNotch >= 0 ? `+${analystTotalNotch}` : analystTotalNotch} 级；当前情景：{scenarioLabel}
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-1.5">
                  <label
                    htmlFor="member-calc-memo"
                    className="block text-xs font-semibold text-slate-800"
                  >
                    个人测算分析备注（可一键带入正式评审意见）
                  </label>
                  <textarea
                    id="member-calc-memo"
                    rows={2}
                    value={calcMemo}
                    onChange={(e) => setCalcMemo(e.target.value)}
                    placeholder="例如：考虑到 2027 年集中到期回售及应收款账期拉长，下调流动性因子至 66 分进行审慎压力测试…"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {seat.memberCalcSnapshot ? (
                    <span>
                      上次已存测算：
                      <strong className="font-mono text-slate-800">
                        {seat.memberCalcSnapshot.finalRating}（
                        {seat.memberCalcSnapshot.computedScore.toFixed(1)}分）
                      </strong>
                    </span>
                  ) : (
                    <span>尚未保存个人测算快照</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSaveCalcSnapshot}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#103D6B] bg-white border border-[#103D6B]/30 rounded hover:bg-[#EFF6FF] transition-colors whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5" />
                    保存本人测算快照
                  </button>
                  <button
                    type="button"
                    onClick={handleCarryCalcToVote}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors whitespace-nowrap"
                  >
                    <span>将测算结论带入评审意见并前往表决</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Review Opinion & Voting (发表评审意见并投票 — Strict Time Window Gated) */}
      {activeTab === 'vote' && (
        <div className="space-y-5">
          {/* Time Window Enforcement Banner + Sandbox Clock Calibrator */}
          <div className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Clock className="w-4 h-4 text-[#103D6B] shrink-0" />
                  <span
                    className={`font-semibold ${
                      windowInfo.status === 'open'
                        ? 'text-[#15803D]'
                        : windowInfo.status === 'before'
                        ? 'text-[#B45309]'
                        : 'text-[#B91C1C]'
                    }`}
                  >
                    {windowInfo.statusLabel}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-mono text-slate-600 tabular-nums">
                    当前评审时钟：{windowInfo.currentClockLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {windowInfo.detailText}
                </p>
              </div>

              <div className="text-xs font-mono tabular-nums text-slate-600 shrink-0 lg:text-right">
                <div>会议时段：{windowInfo.meetingSlotRangeLabel}</div>
                <div className="text-slate-500 mt-0.5">
                  表决截止：{windowInfo.windowEndLabel}（次日下班前）
                </div>
              </div>
            </div>

            {/* Sandbox Clock Calibration Strip for Testing Before / During / Next-Day / Expired */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">
                合规时间窗沙箱验证（模拟不同时点以检验锁控机制）：
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSetSimulatedClock(clockPresets.beforeMeeting)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap ${
                    windowInfo.status === 'before'
                      ? 'bg-amber-50 text-[#B45309] border-amber-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  会前 2 小时（锁定）
                </button>
                <button
                  type="button"
                  onClick={() => onSetSimulatedClock(clockPresets.duringMeeting)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap ${
                    windowInfo.status === 'open' && windowInfo.isDuringMeetingSlot
                      ? 'bg-[#EFF6FF] text-[#103D6B] border-[#103D6B]/40'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  开会时段内（开放）
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSetSimulatedClock(clockPresets.nextDayBeforeClose)
                  }
                  className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap ${
                    windowInfo.status === 'open' && !windowInfo.isDuringMeetingSlot
                      ? 'bg-[#EFF6FF] text-[#103D6B] border-[#103D6B]/40'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  会后次日 15:00（开放）
                </button>
                <button
                  type="button"
                  onClick={() => onSetSimulatedClock(clockPresets.afterDeadline)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap ${
                    windowInfo.status === 'closed'
                      ? 'bg-red-50 text-[#B91C1C] border-red-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  次日 18:00 下班后（截止）
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Left: Formal Review Opinion & Ballot Form */}
            <form
              onSubmit={handleSubmitVoteForm}
              className="xl:col-span-8 bg-white border border-slate-200 rounded-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    发表独立评审意见并投票表决
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    表决记录将自动生成防篡改哈希凭证，并同步计入本人与全院历史评审台账
                  </p>
                </div>
                {!isVotingOpen && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B91C1C] whitespace-nowrap">
                    <Lock className="w-3.5 h-3.5" />
                    当前时段不可操作
                  </span>
                )}
              </div>

              <div className="p-6 space-y-5">
                {/* Vote Result Selection */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-800">
                    1. 选择正式表决意见
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {VOTE_OPTIONS.map((opt) => {
                      const selected = voteResult === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={!isVotingOpen}
                          onClick={() => setVoteResult(opt.value)}
                          className={`p-3 text-left rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            selected
                              ? 'bg-[#EFF6FF] border-[#103D6B] text-[#103D6B]'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="text-xs font-semibold">{opt.label}</div>
                          <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                            {opt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Proposed Rating & Outlook */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="vote-rating-select"
                      className="block text-xs font-semibold text-slate-800 mb-1.5"
                    >
                      2. 委员评定信用等级
                    </label>
                    <select
                      id="vote-rating-select"
                      disabled={!isVotingOpen}
                      value={proposedRating}
                      onChange={(e) =>
                        setProposedRating(e.target.value as RatingGrade)
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B] disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {RATING_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                          {g === materials.proposedRating
                            ? '（项目组建议）'
                            : g === customFinalRating
                            ? '（本人测算）'
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="vote-outlook-select"
                      className="block text-xs font-semibold text-slate-800 mb-1.5"
                    >
                      3. 委员评定评级展望
                    </label>
                    <select
                      id="vote-outlook-select"
                      disabled={!isVotingOpen}
                      value={proposedOutlook}
                      onChange={(e) =>
                        setProposedOutlook(e.target.value as RatingOutlook)
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B] disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {RATING_OUTLOOKS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mandatory Conditions when 有条件通过 */}
                {voteResult === '有条件通过' && (
                  <div>
                    <label
                      htmlFor="vote-conditions"
                      className="block text-xs font-semibold text-slate-800 mb-1.5"
                    >
                      落实前提条件（选择「有条件通过」必填）
                    </label>
                    <input
                      id="vote-conditions"
                      type="text"
                      disabled={!isVotingOpen}
                      value={conditionsText}
                      onChange={(e) => setConditionsText(e.target.value)}
                      placeholder="例如：补充取得主要授信银行 2027 年到期债券续作意向函并在募集说明书中充分披露。"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B] disabled:bg-slate-100"
                    />
                  </div>
                )}

                {/* Detailed Review Opinion */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="vote-opinion"
                      className="text-xs font-semibold text-slate-800"
                    >
                      4. 独立评审意见陈述
                    </label>
                    <button
                      type="button"
                      disabled={!isVotingOpen}
                      onClick={() => {
                        const snippet = buildCalcSummaryProse();
                        setOpinionText((prev) =>
                          prev.trim() ? `${prev.trim()}\n${snippet}` : snippet
                        );
                      }}
                      className="text-[11px] font-medium text-[#103D6B] hover:underline disabled:opacity-40"
                    >
                      一键引用当前自行测算结论
                    </button>
                  </div>
                  <textarea
                    id="vote-opinion"
                    rows={5}
                    disabled={!isVotingOpen}
                    value={opinionText}
                    onChange={(e) => {
                      setOpinionText(e.target.value);
                      if (formError) setFormError('');
                    }}
                    placeholder="请结合评级报告、尽调工作底稿及本人模型压力测算情况，明确陈述支持或调整信用等级的核心理由与风险关注点…"
                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded leading-relaxed focus:outline-none focus:border-[#103D6B] disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                {formError && (
                  <div className="text-xs text-[#B91C1C] font-medium">
                    {formError}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500">
                    {isVotingOpen
                      ? '提交前请核对表决意见与建议级别；在次日 17:30 截止前支持修订并重新留痕存证。'
                      : windowInfo.status === 'before'
                      ? `未到开会时间（${windowInfo.windowStartLabel}），表单已自动锁定。`
                      : `已超过会后次日下班截止时间（${windowInfo.windowEndLabel}），表单已只读锁定。`}
                  </div>

                  <button
                    type="submit"
                    disabled={!isVotingOpen}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    {seat.reviewSubmission
                      ? '在窗口期内修订意见并重新投票'
                      : '正式提交评审意见并投票'}
                  </button>
                </div>
              </div>
            </form>

            {/* Right: Submitted Ballot Receipt & Calculation Reference */}
            <div className="xl:col-span-4 space-y-5">
              <div className="bg-white border border-slate-200 rounded-md p-6 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-900">
                    本人表决存证回执
                  </h4>
                  {seat.reviewSubmission ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#15803D]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      已存证
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">尚未表决</span>
                  )}
                </div>

                {seat.reviewSubmission ? (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">表决编号</span>
                      <span className="font-mono text-slate-800">
                        {seat.reviewSubmission.submissionId}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">表决结果</span>
                      <span className="font-semibold text-[#103D6B]">
                        {seat.reviewSubmission.voteResult}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">委员评定级别</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {seat.reviewSubmission.proposedRating} /{' '}
                        {seat.reviewSubmission.proposedOutlook}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">提交版本 / 时间</span>
                      <span className="font-mono text-slate-600 tabular-nums">
                        第 {seat.reviewSubmission.revisionCount} 版 ·{' '}
                        {new Date(
                          seat.reviewSubmission.updatedAt
                        ).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-500 mb-1">
                        防篡改表决哈希摘要
                      </div>
                      <div className="font-mono text-[11px] text-slate-600 break-all bg-[#F8FAFC] border border-slate-200 rounded px-2.5 py-1.5">
                        {seat.reviewSubmission.submissionHash}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    您尚未提交本场评审会的意见与表决票。请在开会时段起至会后次日 17:30 下班前完成投票提交。
                  </p>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-md p-6 space-y-2.5 text-xs">
                <div className="font-semibold text-slate-900 pb-2 border-b border-slate-100">
                  测算与项目组对比速览
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">项目组建议</span>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                    {materials.proposedRating}（{materials.analystBaseScore.toFixed(1)}分）
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">本人当前测算</span>
                  <span className="font-mono font-semibold text-[#103D6B] tabular-nums">
                    {customFinalRating}（{customScore.toFixed(1)}分）
                  </span>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('calculator')}
                    className="text-[#103D6B] font-medium hover:underline"
                  >
                    返回调整自行测算参数 →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
