import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  ChevronDown,
  ChevronUp,
  Clock,
  FileCheck2,
  Lock,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  CommitteeMember,
  ConflictDeclarationRecord,
  HALF_DAY_SLOTS,
  HalfDay,
  HistoricalReview,
  REVIEW_TYPE_MAP,
  ReviewMeeting,
  RuleConfig,
  SlotIndex,
} from '../../types/domain';
import { computeHalfDayOptimization } from '../../engine/matchingEngine';
import { SCHEDULE_DATES } from '../../data/seedData';
import { CountdownText } from '../common/CountdownText';
import { NewMeetingModal } from './NewMeetingModal';
import { ConcentrationMonitor } from './ConcentrationMonitor';
import { SecretaryHistoryAnalytics } from './SecretaryHistoryAnalytics';
import { ConflictDeclarationModal } from '../member/ConflictDeclarationModal';

interface SecretaryWorkspaceProps {
  activeSubTab: 'scheduling' | 'concentration' | 'analytics';
  members: CommitteeMember[];
  meetings: ReviewMeeting[];
  history: HistoricalReview[];
  referenceDate: string;
  config: RuleConfig;
  newModalOpen: boolean;
  onCloseNewModal: () => void;
  onOpenNewModal: () => void;
  onAddMeeting: Parameters<typeof NewMeetingModal>[0]['onSubmit'];
  onOptimizeHalfDay: (date: string, halfDay: HalfDay) => void;
  onRunMatch: (meetingId: string) => void;
  onManualRotateSeat: (meetingId: string, seatId: string, reason: string) => void;
  onManualRotateFull: (meetingId: string, reason: string) => void;
  onSimulateTimeout: (meetingId: string, seatId: string) => void;
  onSendReminder: (meetingId: string, seatId?: string) => void;
}

export function SecretaryWorkspace({
  activeSubTab,
  members,
  meetings,
  history,
  referenceDate,
  config,
  newModalOpen,
  onCloseNewModal,
  onOpenNewModal,
  onAddMeeting,
  onOptimizeHalfDay,
  onRunMatch,
  onManualRotateSeat,
  onManualRotateFull,
  onSimulateTimeout,
  onSendReminder,
}: SecretaryWorkspaceProps) {
  const [selectedDate, setSelectedDate] = useState<string>(SCHEDULE_DATES[0]);
  const [selectedHalfDay, setSelectedHalfDay] = useState<HalfDay>('AM');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(
    meetings[0]?.id ?? ''
  );
  const [showOptimizerPreview, setShowOptimizerPreview] = useState(false);
  const [expandedSeatId, setExpandedSeatId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'panel' | 'backups' | 'filtered'>(
    'panel'
  );

  // Inline rotation confirmation modal state (replaces window.prompt)
  const [rotationPrompt, setRotationPrompt] = useState<{
    mode: 'seat' | 'full';
    meetingId: string;
    seatId?: string;
    targetLabel: string;
  } | null>(null);
  const [rotationReason, setRotationReason] = useState('委员临时出差/紧急冲突需轮换');
  const [viewingDeclaration, setViewingDeclaration] =
    useState<ConflictDeclarationRecord | null>(null);

  const halfDayMeetings = useMemo(
    () =>
      meetings
        .filter((m) => m.date === selectedDate && m.halfDay === selectedHalfDay)
        .sort((a, b) => a.slotIndex - b.slotIndex),
    [meetings, selectedDate, selectedHalfDay]
  );

  const selectedMeeting = useMemo(() => {
    const exact = meetings.find((m) => m.id === selectedMeetingId);
    if (
      exact &&
      exact.date === selectedDate &&
      exact.halfDay === selectedHalfDay
    ) {
      return exact;
    }
    return halfDayMeetings[0] ?? null;
  }, [meetings, selectedMeetingId, selectedDate, selectedHalfDay, halfDayMeetings]);

  const optimizationPreview = useMemo(
    () => computeHalfDayOptimization(meetings, selectedDate, selectedHalfDay),
    [meetings, selectedDate, selectedHalfDay]
  );

  const getSlotTime = (hd: HalfDay, slotIndex: SlotIndex) =>
    HALF_DAY_SLOTS[hd].find((s) => s.slotIndex === slotIndex)?.timeRange ?? '';

  const getMemberName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? id;

  const handleConfirmManualRotation = () => {
    if (!rotationPrompt) return;
    if (rotationPrompt.mode === 'seat' && rotationPrompt.seatId) {
      onManualRotateSeat(
        rotationPrompt.meetingId,
        rotationPrompt.seatId,
        rotationReason
      );
    } else {
      onManualRotateFull(rotationPrompt.meetingId, rotationReason);
    }
    setRotationPrompt(null);
  };

  if (activeSubTab === 'concentration') {
    return (
      <>
        <ConcentrationMonitor
          members={members}
          history={history}
          meetings={meetings}
          referenceDate={referenceDate}
          config={config}
        />
        <NewMeetingModal
          open={newModalOpen}
          members={members}
          config={config}
          onClose={onCloseNewModal}
          onSubmit={onAddMeeting}
        />
      </>
    );
  }

  if (activeSubTab === 'analytics') {
    return (
      <>
        <SecretaryHistoryAnalytics
          history={history}
          members={members}
          referenceDate={referenceDate}
          config={config}
        />
        <NewMeetingModal
          open={newModalOpen}
          members={members}
          config={config}
          onClose={onCloseNewModal}
          onSubmit={onAddMeeting}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Half-Day Control Strip */}
      <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">排期日期</span>
            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setShowOptimizerPreview(false);
              }}
              className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
            >
              {SCHEDULE_DATES.map((d) => {
                const count = meetings.filter((m) => m.date === d).length;
                return (
                  <option key={d} value={d}>
                    {d}（{count} 场）
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded">
            {(['AM', 'PM'] as HalfDay[]).map((hd) => {
              const count = meetings.filter(
                (m) => m.date === selectedDate && m.halfDay === hd
              ).length;
              return (
                <button
                  key={hd}
                  type="button"
                  onClick={() => {
                    setSelectedHalfDay(hd);
                    setShowOptimizerPreview(false);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    selectedHalfDay === hd
                      ? 'bg-white text-[#103D6B] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {hd === 'AM' ? '上午场' : '下午场'} · {count}场
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowOptimizerPreview((v) => !v)}
            disabled={halfDayMeetings.length <= 1}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#103D6B] bg-[#EFF6FF] border border-[#103D6B]/20 rounded hover:bg-[#DBEAFE] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {showOptimizerPreview ? '收起排期优化方案' : '一键优化半天防折返排期'}
          </button>

          <button
            type="button"
            onClick={onOpenNewModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            新增评审需求
          </button>
        </div>
      </div>

      {/* Anti-Backtracking Schedule Optimizer Diff Panel */}
      {showOptimizerPreview && (
        <div className="bg-white border border-[#103D6B]/30 rounded-md overflow-hidden">
          <div className="px-5 py-4 bg-[#F8FAFC] border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                半天防折返排期优化方案预览 · {selectedDate}{' '}
                {selectedHalfDay === 'AM' ? '上午' : '下午'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {optimizationPreview.clusterSummary} · 冲突/回避项目边缘化调整{' '}
                <span className="font-mono font-semibold text-[#103D6B]">
                  {optimizationPreview.edgeMovedCount}
                </span>{' '}
                项
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowOptimizerPreview(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50"
              >
                暂不调整
              </button>
              <button
                type="button"
                disabled={!optimizationPreview.changed}
                onClick={() => {
                  onOptimizeHalfDay(selectedDate, selectedHalfDay);
                  setShowOptimizerPreview(false);
                }}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {optimizationPreview.changed
                  ? '确认应用优化排期'
                  : '当前已是最优聚类顺序'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            <div className="p-4">
              <div className="text-xs font-semibold text-slate-500 mb-3">
                优化前原排期顺序
              </div>
              <div className="divide-y divide-slate-100">
                {optimizationPreview.originalOrder.map((mt) => (
                  <div
                    key={mt.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-500">
                          槽位{mt.slotIndex} ({getSlotTime(mt.halfDay, mt.slotIndex)})
                        </span>
                        <span className="font-medium text-slate-900 truncate">
                          {mt.projectName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {mt.majorCategory} · {mt.subCategory}
                        {mt.conflictMemberIds.length > 0 && (
                          <span className="text-[#B91C1C]">
                            {' '}
                            · 含利益冲突回避（{mt.conflictMemberIds.length}人）
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[#F8FAFC]/60">
              <div className="text-xs font-semibold text-[#103D6B] mb-3">
                优化后建议排期（同类聚类 + 冲突边缘化）
              </div>
              <div className="divide-y divide-slate-100">
                {optimizationPreview.optimizedOrder.map((mt) => {
                  const assign = optimizationPreview.slotAssignments.find(
                    (a) => a.meetingId === mt.id
                  );
                  const moved = assign && assign.oldSlot !== assign.newSlot;
                  return (
                    <div
                      key={mt.id}
                      className="py-2.5 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-[#103D6B]">
                            槽位{mt.slotIndex} ({getSlotTime(mt.halfDay, mt.slotIndex)})
                          </span>
                          <span className="font-medium text-slate-900 truncate">
                            {mt.projectName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {mt.majorCategory} · {mt.subCategory}
                          {assign && (
                            <span className="text-slate-500"> · {assign.reason}</span>
                          )}
                        </div>
                      </div>
                      {moved && assign && (
                        <span className="text-[11px] font-mono text-[#103D6B] whitespace-nowrap shrink-0 flex items-center gap-1">
                          槽位{assign.oldSlot}
                          <ArrowRight className="w-3 h-3" />
                          槽位{assign.newSlot}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Split: Left Schedule List + Right Selected Meeting Engine Detail */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Half-Day Meeting Schedule List */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              {selectedDate} {selectedHalfDay === 'AM' ? '上午' : '下午'}排期清单
            </h3>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              共 {halfDayMeetings.length} 场
            </span>
          </div>

          {halfDayMeetings.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="text-sm text-slate-600">当前半天尚未安排评审会项目</div>
              <button
                type="button"
                onClick={onOpenNewModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E]"
              >
                <Plus className="w-3.5 h-3.5" />
                新增本时段评审需求
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {halfDayMeetings.map((mt) => {
                const isSelected = selectedMeeting?.id === mt.id;
                const confirmedCount = mt.seats.filter(
                  (s) => s.status === 'confirmed'
                ).length;
                const totalSeats = mt.seats.length;

                return (
                  <button
                    key={mt.id}
                    type="button"
                    onClick={() => {
                      setSelectedMeetingId(mt.id);
                      setExpandedSeatId(null);
                    }}
                    className={`w-full text-left px-5 py-4 transition-colors block ${
                      isSelected
                        ? 'bg-[#EFF6FF]/70'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-medium text-[#103D6B] tabular-nums">
                        第{mt.slotIndex}场 · {getSlotTime(mt.halfDay, mt.slotIndex)}
                      </span>
                      <span
                        className={`font-medium tabular-nums ${
                          mt.status === 'confirmed'
                            ? 'text-[#15803D]'
                            : mt.status === 'matched'
                            ? 'text-[#B45309]'
                            : 'text-slate-500'
                        }`}
                      >
                        {mt.status === 'confirmed'
                          ? `全部确认 (${confirmedCount}/${totalSeats})`
                          : mt.status === 'matched'
                          ? `已匹配 · 确认 ${confirmedCount}/${totalSeats}`
                          : '待匹配'}
                      </span>
                    </div>

                    <div className="mt-1.5 text-sm font-semibold text-slate-900 leading-snug">
                      {mt.projectName}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="font-mono">{mt.code}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-medium ${
                          config.chiefPriorityReviewTypes.includes(mt.reviewType)
                            ? 'text-[#103D6B]'
                            : 'text-slate-700'
                        }`}
                      >
                        {REVIEW_TYPE_MAP[mt.reviewType].fullLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-700">
                        {mt.majorCategory} / {mt.subCategory}
                      </span>
                    </div>

                    {(config.chiefPriorityReviewTypes.includes(mt.reviewType) ||
                      mt.conflictMemberIds.length > 0 ||
                      mt.manualRotationCount > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        {config.chiefPriorityReviewTypes.includes(mt.reviewType) && (
                          <span className="text-[#103D6B] font-medium">
                            重点类别 · 主任委员优先 (+{config.chiefPriorityBonus})
                          </span>
                        )}
                        {mt.conflictMemberIds.length > 0 && (
                          <span className="text-[#B91C1C]">
                            冲突回避：{mt.conflictMemberIds.map(getMemberName).join('、')}
                          </span>
                        )}
                        {mt.manualRotationCount > 0 && (
                          <span className="font-mono text-slate-600 tabular-nums">
                            手动轮换 {mt.manualRotationCount}/{config.maxManualRotations}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Meeting Matching & Rotation Console */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-md overflow-hidden">
          {!selectedMeeting ? (
            <div className="p-12 text-center text-sm text-slate-500">
              请从左侧排期清单中选择一个评审项目查看匹配详情或运行智能匹配。
            </div>
          ) : (
            <div>
              {/* Header Info */}
              <div className="p-6 border-b border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-medium text-slate-700">
                        {selectedMeeting.code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {selectedMeeting.date}{' '}
                        {selectedMeeting.halfDay === 'AM' ? '上午' : '下午'}第
                        {selectedMeeting.slotIndex}场（
                        {getSlotTime(
                          selectedMeeting.halfDay,
                          selectedMeeting.slotIndex
                        )}
                        ）
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {config.convenerCount} 召集人 + {config.memberCount} 委员
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selectedMeeting.projectName}
                    </h2>
                    <div className="text-xs text-slate-600">
                      发行人：{selectedMeeting.issuer} · 评审类别：
                      <span className="font-semibold text-[#103D6B]">
                        {REVIEW_TYPE_MAP[selectedMeeting.reviewType].fullLabel}
                      </span>{' '}
                      · 领域：
                      <span className="font-medium text-slate-900">
                        {selectedMeeting.majorCategory} / {selectedMeeting.subCategory}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {selectedMeeting.seats.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => onRunMatch(selectedMeeting.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors whitespace-nowrap"
                      >
                        <Play className="w-3.5 h-3.5" />
                        运行智能盲配
                      </button>
                    ) : (
                      <>
                        {selectedMeeting.seats.some(
                          (s) => s.status === 'pending'
                        ) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onSendReminder(selectedMeeting.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors whitespace-nowrap"
                            >
                              <BellRing className="w-3.5 h-3.5" />
                              系统一键催办待确认席位
                            </button>
                            <button
                              type="button"
                              disabled={
                                selectedMeeting.manualRotationCount >=
                                config.maxManualRotations
                              }
                              onClick={() => {
                                const pendingCnt = selectedMeeting.seats.filter(
                                  (s) => s.status === 'pending'
                                ).length;
                                setRotationPrompt({
                                  mode: 'full',
                                  meetingId: selectedMeeting.id,
                                  targetLabel: `本场 ${pendingCnt} 个待确认加密席位盲态轮换（已确认参会席位锁定不动；当前已用 ${selectedMeeting.manualRotationCount}/${config.maxManualRotations} 次）`,
                                });
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#103D6B] bg-white border border-[#103D6B]/30 rounded hover:bg-[#EFF6FF] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              待确认席位盲态轮换 ({selectedMeeting.manualRotationCount}/
                              {config.maxManualRotations})
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803D] whitespace-nowrap">
                            <Lock className="w-3.5 h-3.5" />
                            全员已确认参会 · 席位已锁定不可手动轮换
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Contextual governance notices (review category trigger, chief priority, conflict, anti-cherry-picking cap) */}
                {(config.chiefPriorityReviewTypes.includes(selectedMeeting.reviewType) ||
                  Boolean(selectedMeeting.reviewTriggerNote) ||
                  selectedMeeting.conflictMemberIds.length > 0 ||
                  selectedMeeting.manualRotationCount >=
                    config.maxManualRotations) && (
                  <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    {config.chiefPriorityReviewTypes.includes(
                      selectedMeeting.reviewType
                    ) ? (
                      <div className="flex items-start gap-2 text-[#103D6B]">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          <strong>
                            {REVIEW_TYPE_MAP[selectedMeeting.reviewType].fullLabel} ·
                            主任委员优先规则生效：
                          </strong>
                          {selectedMeeting.reviewTriggerNote
                            ? `${selectedMeeting.reviewTriggerNote}；`
                            : ''}
                          召集人优先匹配至「{selectedMeeting.majorCategory}」主任委员（+
                          {config.chiefPriorityBonus} 分），若其近{' '}
                          {config.concentrationWindowDays} 天集中度超过{' '}
                          {(config.convenerConcentrationCap * 100).toFixed(0)}% 则仍强制轮换。
                        </span>
                      </div>
                    ) : (
                      selectedMeeting.reviewTriggerNote && (
                        <div className="flex items-start gap-2 text-slate-600">
                          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                          <span>
                            <strong>
                              {REVIEW_TYPE_MAP[selectedMeeting.reviewType].fullLabel}
                              立项说明：
                            </strong>
                            {selectedMeeting.reviewTriggerNote}
                          </span>
                        </div>
                      )
                    )}
                    {selectedMeeting.conflictMemberIds.length > 0 && (
                      <div className="flex items-start gap-2 text-[#B91C1C]">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          <strong>利益冲突前置过滤：</strong>
                          已硬性排除{' '}
                          {selectedMeeting.conflictMemberIds
                            .map(getMemberName)
                            .join('、')}
                          {selectedMeeting.conflictNote
                            ? `（${selectedMeeting.conflictNote}）`
                            : ''}
                          。
                        </span>
                      </div>
                    )}
                    {selectedMeeting.manualRotationCount >=
                      config.maxManualRotations && (
                      <div className="flex items-start gap-2 text-[#B45309]">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          <strong>防挑人保护已锁定：</strong>
                          本场手动轮换次数已达上限（{config.maxManualRotations}/
                          {config.maxManualRotations} 次），不可再次手动启动轮换；仅支持委员自主确认或 30 分钟超时自动递补。
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Detail Sub-tabs */}
              <div className="px-6 pt-3 border-b border-slate-200 flex items-center gap-6 text-xs">
                <button
                  type="button"
                  onClick={() => setDetailTab('panel')}
                  className={`pb-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                    detailTab === 'panel'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  评审阵容与评分明细 ({selectedMeeting.seats.length}/
                  {config.convenerCount + config.memberCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('backups')}
                  className={`pb-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                    detailTab === 'backups'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  确定性备用递补队列 (召集人{' '}
                  {selectedMeeting.convenerBackupQueue.length} / 委员{' '}
                  {selectedMeeting.memberBackupQueue.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('filtered')}
                  className={`pb-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                    detailTab === 'filtered'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  前置硬过滤剔除记录 ({selectedMeeting.filteredOutCandidates.length})
                </button>
              </div>

              {/* Tab 1: Active 6-seat Panel */}
              {detailTab === 'panel' && (
                <div>
                  {selectedMeeting.seats.length === 0 ? (
                    <div className="p-10 text-center space-y-3">
                      <Users className="w-8 h-8 text-slate-300 mx-auto" />
                      <div className="text-sm font-medium text-slate-700">
                        尚未执行智能匹配
                      </div>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        建议先完成本半天「防折返排期优化」，再点击上方「运行智能匹配」按顺位权重、90天集中度红线与同半天连续性自动生成 1 召集人 + 5 委员阵容。
                      </p>
                      <button
                        type="button"
                        onClick={() => onRunMatch(selectedMeeting.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E]"
                      >
                        <Play className="w-3.5 h-3.5" />
                        立即运行智能匹配
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {/* Blind-match compliance banner */}
                      <div className="px-6 py-3 bg-[#F8FAFC] flex items-center gap-2 text-xs text-slate-600">
                        <Lock className="w-3.5 h-3.5 text-[#103D6B] shrink-0" />
                        <span>
                          <strong>双盲防挑人保护生效：</strong>
                          委员未电子签署《利益冲突回避承诺函》前，秘书工作台仅可见加密席位代号，可发起系统催办或盲态轮换；委员签署承诺函并确认参会后自动解盲并<strong>永久锁定该席位</strong>，秘书不再享有手动轮换权限。
                        </span>
                      </div>

                      {selectedMeeting.seats.map((seat) => {
                        const isExpanded = expandedSeatId === seat.seatId;
                        const capReached =
                          selectedMeeting.manualRotationCount >=
                          config.maxManualRotations;
                        const isUnmasked =
                          seat.status === 'confirmed' &&
                          Boolean(seat.conflictDeclaration);

                        return (
                          <div key={seat.seatId} className="px-6 py-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="w-20 shrink-0 pt-0.5">
                                  <span
                                    className={`text-xs font-semibold ${
                                      seat.seatRole === 'convener'
                                        ? 'text-[#103D6B]'
                                        : 'text-slate-600'
                                    }`}
                                  >
                                    {seat.seatLabel}
                                  </span>
                                </div>

                                <div className="min-w-0">
                                  {isUnmasked ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-semibold text-slate-900">
                                        {seat.memberName}
                                      </span>
                                      <span className="text-xs font-mono text-slate-500">
                                        {seat.employeeCode}
                                      </span>
                                      {seat.isChiefForMajor && (
                                        <span className="text-xs font-medium text-[#103D6B]">
                                          · {selectedMeeting.majorCategory}主任委员
                                        </span>
                                      )}
                                      <span className="text-xs text-[#15803D]">
                                        · 已签署解盲
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                                        加密候选人（{seat.blindCode || 'ENC'}）
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        · 待签署利益冲突回避承诺函后解盲实名
                                      </span>
                                    </div>
                                  )}

                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                    <CountdownText
                                      deadlineAt={seat.deadlineAt}
                                      status={seat.status}
                                      respondedAt={seat.respondedAt}
                                    />
                                    <span className="text-slate-300">|</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedSeatId(
                                          isExpanded ? null : seat.seatId
                                        )
                                      }
                                      className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-slate-800 hover:text-[#103D6B]"
                                    >
                                      算法得分{' '}
                                      {seat.totalScore >= 0
                                        ? `+${seat.totalScore}`
                                        : seat.totalScore}
                                      {isExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                    {seat.status === 'pending' &&
                                      (seat.reminderCount ?? 0) > 0 && (
                                        <>
                                          <span className="text-slate-300">|</span>
                                          <span className="text-[#103D6B] font-mono tabular-nums">
                                            已系统催办 {seat.reminderCount} 次
                                            {seat.lastRemindedAt
                                              ? ` · ${new Date(
                                                  seat.lastRemindedAt
                                                ).toLocaleTimeString('zh-CN', {
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                })}`
                                              : ''}
                                          </span>
                                        </>
                                      )}
                                  </div>

                                  {seat.substitutedFrom && (
                                    <div className="mt-1 text-[11px] text-[#B45309]">
                                      递补溯源：替补自 {seat.substitutedFrom}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {seat.status === 'confirmed' ? (
                                  <>
                                    {isUnmasked && seat.conflictDeclaration && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setViewingDeclaration(
                                            seat.conflictDeclaration!
                                          )
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#15803D] bg-emerald-50/70 border border-emerald-200 rounded hover:bg-emerald-100/70 transition-colors whitespace-nowrap"
                                      >
                                        <FileCheck2 className="w-3 h-3" />
                                        查验承诺函
                                      </button>
                                    )}
                                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                                      <Lock className="w-3 h-3 text-slate-400" />
                                      已确认锁定（不可轮换）
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    {seat.status === 'pending' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onSendReminder(
                                              selectedMeeting.id,
                                              seat.seatId
                                            )
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#103D6B] bg-[#EFF6FF] border border-[#103D6B]/20 rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap"
                                        >
                                          <BellRing className="w-3 h-3" />
                                          系统催办
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onSimulateTimeout(
                                              selectedMeeting.id,
                                              seat.seatId
                                            )
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#B45309] bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors whitespace-nowrap"
                                          title="立即模拟30分钟响应超时，按封存备用队列首位自动递补"
                                        >
                                          <Clock className="w-3 h-3" />
                                          模拟30分超时
                                        </button>
                                        <button
                                          type="button"
                                          disabled={capReached}
                                          onClick={() =>
                                            setRotationPrompt({
                                              mode: 'seat',
                                              meetingId: selectedMeeting.id,
                                              seatId: seat.seatId,
                                              targetLabel: `${seat.seatLabel} · 加密候选人 (${seat.blindCode || 'ENC'})`,
                                            })
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                                        >
                                          <RefreshCw className="w-3 h-3" />
                                          盲态轮换
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="mt-3 ml-0 md:ml-23 p-3.5 bg-slate-50 border border-slate-200 rounded text-xs">
                                <div className="font-medium text-slate-700 mb-2">
                                  算法评分拆解明细（确定性计算）
                                </div>
                                <div className="space-y-1.5">
                                  {seat.breakdown.map((b, i) => (
                                    <div
                                      key={`${b.code}-${i}`}
                                      className="flex items-center justify-between gap-4"
                                    >
                                      <span className="text-slate-600">
                                        {b.label}
                                        {b.note ? `（${b.note}）` : ''}
                                      </span>
                                      <span
                                        className={`font-mono font-semibold tabular-nums ${
                                          b.points > 0
                                            ? 'text-[#15803D]'
                                            : b.points < 0
                                            ? 'text-[#B91C1C]'
                                            : 'text-slate-500'
                                        }`}
                                      >
                                        {b.points > 0 ? `+${b.points}` : b.points}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Sealed Blind Deterministic Backup Queue */}
              {detailTab === 'backups' && (
                <div className="p-6 space-y-6">
                  <div className="px-4 py-3 bg-[#F8FAFC] border border-slate-200 rounded flex items-start gap-2.5 text-xs text-slate-600">
                    <Lock className="w-4 h-4 text-[#103D6B] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900">
                        防挑人盲池封存机制：
                      </strong>
                      备用递补队列已由算法按综合得分确定性排序并全程加密隐名，秘书工作台不可提前查看备选人真实姓名；当发生超时、回避或手动轮换时，系统自动按封存顺位递补，仅在该委员正式电子签署《利益冲突回避承诺函》后解盲公布姓名。
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 mb-2">
                      召集人封存备用递补队列（隐名加密 · 按确定性评分降序）
                    </h4>
                    {selectedMeeting.convenerBackupQueue.length === 0 ? (
                      <div className="text-xs text-slate-500 py-3">
                        暂无额外符合资格的召集人备用候选。
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                              <th className="py-2 px-3">递补顺位</th>
                              <th className="py-2 px-3">加密盲码（已隐名）</th>
                              <th className="py-2 px-3 text-right">90天集中度校验</th>
                              <th className="py-2 px-3">算法评分构成</th>
                              <th className="py-2 px-3 text-right">综合得分</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedMeeting.convenerBackupQueue.map((c, idx) => (
                              <tr key={c.memberId}>
                                <td className="py-2.5 px-3 font-mono text-slate-500">
                                  #{idx + 1}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Lock className="w-3 h-3 text-slate-400" />
                                    BK-C{String(idx + 1).padStart(2, '0')} · 实名已加密封存
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#15803D] whitespace-nowrap">
                                  合规 ({(c.concentrationRate * 100).toFixed(1)}%)
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {c.breakdown
                                    .map(
                                      (b) =>
                                        `${b.label}(${b.points > 0 ? `+${b.points}` : b.points})`
                                    )
                                    .join(' · ')}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                                  {c.totalScore}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 mb-2">
                      评审委员封存备用递补队列（隐名加密 · 按确定性评分降序）
                    </h4>
                    {selectedMeeting.memberBackupQueue.length === 0 ? (
                      <div className="text-xs text-slate-500 py-3">
                        暂无额外符合资格的委员备用候选。
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                              <th className="py-2 px-3">递补顺位</th>
                              <th className="py-2 px-3">加密盲码（已隐名）</th>
                              <th className="py-2 px-3">专业顺位</th>
                              <th className="py-2 px-3">算法评分构成</th>
                              <th className="py-2 px-3 text-right">综合得分</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedMeeting.memberBackupQueue.map((c, idx) => (
                              <tr key={c.memberId}>
                                <td className="py-2.5 px-3 font-mono text-slate-500">
                                  #{idx + 1}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Lock className="w-3 h-3 text-slate-400" />
                                    BK-M{String(idx + 1).padStart(2, '0')} · 实名已加密封存
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                                  {c.expertiseRank
                                    ? `第 ${c.expertiseRank} 顺位`
                                    : '未申报'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {c.breakdown
                                    .map(
                                      (b) =>
                                        `${b.label}(${b.points > 0 ? `+${b.points}` : b.points})`
                                    )
                                    .join(' · ')}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                                  {c.totalScore}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Hard Pre-Filter Exclusions (Anonymized to prevent reverse elimination) */}
              {detailTab === 'filtered' && (
                <div className="p-6 space-y-4">
                  <div className="text-xs text-slate-500">
                    为防止通过排除法反推加密池内待确认人选，除项目立项明确申报的利益冲突回避人员外，其余前置硬过滤记录均以脱敏代号公示（系统管理员审计日志保留完整实名）。
                  </div>
                  {selectedMeeting.filteredOutCandidates.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center">
                      {selectedMeeting.seats.length === 0
                        ? '运行智能盲配后将自动公示前置硬性过滤明细。'
                        : '本场无委员被前置硬过滤剔除。'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded">
                      {selectedMeeting.filteredOutCandidates.map((item, idx) => {
                        const isExplicitConflict =
                          selectedMeeting.conflictMemberIds.includes(item.memberId);
                        return (
                          <div
                            key={item.memberId}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="font-medium text-slate-900 whitespace-nowrap">
                              {isExplicitConflict ? (
                                <>
                                  {item.memberName}{' '}
                                  <span className="font-mono text-slate-400 font-normal">
                                    {item.employeeCode}（立项申报回避）
                                  </span>
                                </>
                              ) : (
                                <span className="font-mono text-slate-700 inline-flex items-center gap-1.5">
                                  <Lock className="w-3 h-3 text-slate-400" />
                                  脱敏过滤人员 #FLT-{String(idx + 1).padStart(2, '0')}
                                </span>
                              )}
                            </div>
                            <div className="text-[#B91C1C]">
                              {item.exclusionReasons.join('；')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Manual Rotation Confirmation Modal */}
      {rotationPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-md shadow-lg p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                确认对待确认加密席位发起盲态轮换
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                操作对象：{rotationPrompt.targetLabel}。系统仅替换未确认席位并写入本场排除集，严格从确定性备用队列递补且永久留痕审计；已确认参会的席位均保持锁定不可变动。
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                手动轮换合规事由
              </label>
              <input
                type="text"
                value={rotationReason}
                onChange={(e) => setRotationReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRotationPrompt(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmManualRotation}
                className="px-3.5 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E]"
              >
                确认执行轮换
              </button>
            </div>
          </div>
        </div>
      )}

      <NewMeetingModal
        open={newModalOpen}
        members={members}
        config={config}
        onClose={onCloseNewModal}
        onSubmit={onAddMeeting}
      />

      <ConflictDeclarationModal
        mode="view"
        open={Boolean(viewingDeclaration)}
        declaration={viewingDeclaration}
        onClose={() => setViewingDeclaration(null)}
      />
    </div>
  );
}
