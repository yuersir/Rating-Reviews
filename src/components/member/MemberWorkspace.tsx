import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  FolderOpen,
  Lock,
  PenTool,
  Plus,
  Sparkles,
  Trash2,
  Vote,
  XCircle,
} from 'lucide-react';
import {
  CommitteeMember,
  ConflictDeclarationRecord,
  ExpertiseRank,
  HALF_DAY_SLOTS,
  HalfDay,
  HistoricalReview,
  MeetingSeat,
  MemberCalculationSnapshot,
  RatingGrade,
  RatingOutlook,
  REVIEW_TYPE_MAP,
  ReviewMeeting,
  RuleConfig,
  SavedMemberSignature,
  SlotIndex,
  SUB_CATEGORIES,
  SubCategory,
  VoteResult,
  makeSlotKey,
} from '../../types/domain';
import { SCHEDULE_DATES } from '../../data/seedData';
import { getVotingWindowInfo } from '../../data/projectMaterials';
import { CountdownText } from '../common/CountdownText';
import { MemberAnalytics } from './MemberAnalytics';
import { MemberSignatureSettings } from './MemberSignatureSettings';
import { ConflictDeclarationModal } from './ConflictDeclarationModal';
import { ProjectReviewDesk } from './ProjectReviewDesk';

export type MemberWorkspaceTab =
  | 'schedule'
  | 'availability'
  | 'expertise'
  | 'signature'
  | 'analytics';

interface MemberWorkspaceProps {
  activeSubTab: MemberWorkspaceTab;
  member: CommitteeMember;
  meetings: ReviewMeeting[];
  history: HistoricalReview[];
  referenceDate: string;
  simulatedClockIso: string;
  config: RuleConfig;
  onNavigateTab: (tab: MemberWorkspaceTab) => void;
  onSetSimulatedClock: (iso: string) => void;
  onUpdateExpertise: (memberId: string, expertise: ExpertiseRank[]) => void;
  onToggleSlot: (memberId: string, slotKey: string) => void;
  onSetDayAvailability: (
    memberId: string,
    date: string,
    halfDay: HalfDay,
    available: boolean
  ) => void;
  onBatchSetAvailability: (
    memberId: string,
    preset: 'all_open' | 'am_only' | 'pm_only' | 'clear_unscheduled'
  ) => void;
  onSaveSignature: (memberId: string, signature: SavedMemberSignature) => void;
  onClearSignature: (memberId: string) => void;
  onConfirmAttendance: (
    meetingId: string,
    seatId: string,
    signaturePayload: {
      signingMethod: 'handwritten' | 'typed_seal';
      signatureDataUrl?: string;
      typedSealText?: string;
      clausesAccepted: string[];
    }
  ) => void;
  onDeclineAttendance: (meetingId: string, seatId: string, reason: string) => void;
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

export function MemberWorkspace({
  activeSubTab,
  member,
  meetings,
  history,
  referenceDate,
  simulatedClockIso,
  config,
  onNavigateTab,
  onSetSimulatedClock,
  onUpdateExpertise,
  onToggleSlot,
  onSetDayAvailability,
  onBatchSetAvailability,
  onSaveSignature,
  onClearSignature,
  onConfirmAttendance,
  onDeclineAttendance,
  onSaveCalculation,
  onSubmitVote,
}: MemberWorkspaceProps) {
  // Local editable draft for 3-5 expertise ranks
  const [draftExpertise, setDraftExpertise] = useState<ExpertiseRank[]>(
    member.expertise
  );
  const [addSubChoice, setAddSubChoice] = useState<SubCategory>('省级及高信用城投');

  // Active signed project dossier & voting desk target
  const [activeReviewTarget, setActiveReviewTarget] = useState<{
    meetingId: string;
    seatId: string;
  } | null>(null);

  // Inline decline modal state
  const [declineTarget, setDeclineTarget] = useState<{
    meetingId: string;
    seatId: string;
    projectName: string;
  } | null>(null);
  const [declineReason, setDeclineReason] = useState('存在潜在利益关联/申请回避');

  // Electronic conflict declaration signing / viewing state
  const [signingTarget, setSigningTarget] = useState<{
    meeting: ReviewMeeting;
    seat: MeetingSeat;
  } | null>(null);
  const [viewingDeclaration, setViewingDeclaration] =
    useState<ConflictDeclarationRecord | null>(null);

  useEffect(() => {
    setDraftExpertise(member.expertise);
    setActiveReviewTarget(null);
  }, [member.id, member.expertise]);

  // Close project review desk when navigating away from schedule tab
  useEffect(() => {
    if (activeSubTab !== 'schedule') {
      setActiveReviewTarget(null);
    }
  }, [activeSubTab]);

  // Strictly personal assigned meetings for this authenticated member only
  const myAssignments = useMemo(() => {
    const list: Array<{
      meeting: ReviewMeeting;
      seat: ReviewMeeting['seats'][number];
    }> = [];
    for (const mt of meetings) {
      const seat = mt.seats.find((s) => s.memberId === member.id);
      if (seat) list.push({ meeting: mt, seat });
    }
    return list.sort((a, b) => {
      const dateCmp = a.meeting.date.localeCompare(b.meeting.date);
      if (dateCmp !== 0) return dateCmp;
      if (a.meeting.halfDay !== b.meeting.halfDay) {
        return a.meeting.halfDay === 'AM' ? -1 : 1;
      }
      return a.meeting.slotIndex - b.meeting.slotIndex;
    });
  }, [meetings, member.id]);

  // Map occupied slot keys for this member to display on availability grid
  const occupiedSlotMap = useMemo(() => {
    const map = new Map<string, string>();
    myAssignments.forEach(({ meeting, seat }) => {
      if (seat.status === 'confirmed' || seat.status === 'pending') {
        const key = makeSlotKey(meeting.date, meeting.halfDay, meeting.slotIndex);
        map.set(
          key,
          `${meeting.code} (${seat.status === 'confirmed' ? '已确认' : '待确认'})`
        );
      }
    });
    return map;
  }, [myAssignments]);

  const undeclaredSubCategories = useMemo(
    () =>
      SUB_CATEGORIES.filter(
        (s) => !draftExpertise.some((e) => e.subCategory === s.id)
      ),
    [draftExpertise]
  );

  const moveRank = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draftExpertise.length) return;
    const next = [...draftExpertise];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    setDraftExpertise(
      next.map((item, idx) => ({
        rank: (idx + 1) as 1 | 2 | 3 | 4 | 5,
        subCategory: item.subCategory,
      }))
    );
  };

  const removeRank = (index: number) => {
    if (draftExpertise.length <= 3) return;
    const next = draftExpertise
      .filter((_, i) => i !== index)
      .map((item, idx) => ({
        rank: (idx + 1) as 1 | 2 | 3 | 4 | 5,
        subCategory: item.subCategory,
      }));
    setDraftExpertise(next);
  };

  const addRank = () => {
    if (draftExpertise.length >= 5) return;
    const candidate =
      undeclaredSubCategories.find((s) => s.id === addSubChoice)?.id ??
      undeclaredSubCategories[0]?.id;
    if (!candidate) return;
    const next: ExpertiseRank[] = [
      ...draftExpertise,
      {
        rank: (draftExpertise.length + 1) as 1 | 2 | 3 | 4 | 5,
        subCategory: candidate,
      },
    ];
    setDraftExpertise(next);
  };

  const expertiseDirty =
    JSON.stringify(draftExpertise) !== JSON.stringify(member.expertise);

  const pendingCount = myAssignments.filter(
    (x) => x.seat.status === 'pending'
  ).length;

  const activeReviewPair = useMemo(() => {
    if (!activeReviewTarget) return null;
    return (
      myAssignments.find(
        (item) =>
          item.meeting.id === activeReviewTarget.meetingId &&
          item.seat.seatId === activeReviewTarget.seatId
      ) ?? null
    );
  }, [activeReviewTarget, myAssignments]);

  return (
    <div className="space-y-6">
      {/* Verified Personal Identity Strip (Strictly isolated — no cross-member switcher) */}
      <div className="bg-white border border-slate-200 rounded-md px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#103D6B]">
            <Lock className="w-3.5 h-3.5" />
            已鉴权专属页面
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-semibold text-slate-900 text-sm">
            {member.name}
          </span>
          <span className="font-mono text-slate-500">{member.employeeCode}</span>
          <span className="text-slate-500">
            {member.title} · {member.department}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <span className="text-slate-500">
            仅可查阅与操作本人数据（切换身份须退出后重新核验凭证）
          </span>
          <button
            type="button"
            onClick={() => onNavigateTab('availability')}
            className="inline-flex items-center gap-1 font-medium text-[#103D6B] hover:underline whitespace-nowrap"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            可用时段 ({member.availableSlotKeys.length})
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('signature')}
            className={`inline-flex items-center gap-1 font-medium hover:underline whitespace-nowrap ${
              member.savedSignature?.autoApply
                ? 'text-[#15803D]'
                : 'text-slate-600'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            {member.savedSignature
              ? member.savedSignature.autoApply
                ? '默认签名已开启自动调用'
                : '已存默认签名'
              : '去配置默认电子签名'}
          </button>
        </div>
      </div>

      {/* View 1: Schedule, Attendance Signing & Unlocked Project Dossier / Voting Desk */}
      {activeSubTab === 'schedule' && activeReviewPair ? (
        <ProjectReviewDesk
          meeting={activeReviewPair.meeting}
          seat={activeReviewPair.seat}
          simulatedClockIso={simulatedClockIso}
          onSetSimulatedClock={onSetSimulatedClock}
          onBack={() => setActiveReviewTarget(null)}
          onOpenDeclarationCertificate={() => {
            if (activeReviewPair.seat.conflictDeclaration) {
              setViewingDeclaration(activeReviewPair.seat.conflictDeclaration);
            }
          }}
          onSaveCalculation={onSaveCalculation}
          onSubmitVote={onSubmitVote}
        />
      ) : activeSubTab === 'schedule' && (
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                本人评审日程确认、项目资料查阅与表决
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                请在 {config.responseTimeoutMinutes} 分钟窗口内签署《利益冲突回避承诺函》；签署后立即解锁评级报告、工作底稿、模型测算与表决功能（意见发表与投票仅限开会时段及会后次日 17:30 下班前操作）。
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono tabular-nums text-slate-600">
                共 {myAssignments.length} 场 · 待签 {pendingCount} 场
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab('availability')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#103D6B] bg-[#EFF6FF] border border-[#103D6B]/20 rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                调整近期可用时间
              </button>
            </div>
          </div>

          {myAssignments.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="text-sm font-medium text-slate-700">
                本人当前暂无已匹配待确认的评审会日程
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                当「秘书工作台」对近期评审项目运行智能匹配且您入选时，评审日程会实时推送至此。您可先核对「可用时间维护」或预存「默认电子签名」。
              </p>
              <div className="flex items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigateTab('availability')}
                  className="px-3.5 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E]"
                >
                  前往维护可用时间
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('signature')}
                  className="px-3.5 py-2 text-xs font-medium text-[#103D6B] bg-[#EFF6FF] border border-[#103D6B]/20 rounded hover:bg-[#DBEAFE]"
                >
                  设置默认电子签名
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {myAssignments.map(({ meeting, seat }) => {
                const slotDef = HALF_DAY_SLOTS[meeting.halfDay].find(
                  (s) => s.slotIndex === meeting.slotIndex
                );
                return (
                  <div
                    key={seat.seatId}
                    className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-[#103D6B] tabular-nums">
                          {meeting.date} {meeting.halfDay === 'AM' ? '上午' : '下午'}第
                          {meeting.slotIndex}场（{slotDef?.timeRange}）
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-slate-900">
                          担任：{seat.seatLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{meeting.code}</span>
                      </div>

                      <div className="text-base font-semibold text-slate-900">
                        {meeting.projectName}
                      </div>

                      <div className="text-xs text-slate-600">
                        发行人：{meeting.issuer} · 评审类别：
                        <span
                          className={
                            config.chiefPriorityReviewTypes.includes(meeting.reviewType)
                              ? 'font-semibold text-[#103D6B]'
                              : 'font-medium text-slate-800'
                          }
                        >
                          {REVIEW_TYPE_MAP[meeting.reviewType].fullLabel}
                        </span>{' '}
                        · 领域：{meeting.majorCategory} / {meeting.subCategory}
                      </div>

                      {meeting.reviewTriggerNote && (
                        <div className="text-xs text-slate-500">
                          立项说明：{meeting.reviewTriggerNote}
                        </div>
                      )}

                      <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <CountdownText
                          deadlineAt={seat.deadlineAt}
                          status={seat.status}
                          respondedAt={seat.respondedAt}
                        />
                        <span className="text-slate-300">|</span>
                        <span className="font-mono tabular-nums text-slate-600">
                          匹配得分：{seat.totalScore}（
                          {seat.breakdown
                            .map(
                              (b) =>
                                `${b.label} ${b.points > 0 ? `+${b.points}` : b.points}`
                            )
                            .join('，')}
                          ）
                        </span>
                      </div>

                      {seat.status === 'pending' && (
                        <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Lock className="w-3 h-3 shrink-0" />
                          <span>
                            项目评级报告、工作底稿、模型测算及评审表决处于加密锁定状态，签署《利益冲突回避承诺函》后自动解锁。
                          </span>
                        </div>
                      )}

                      {seat.status === 'confirmed' && (() => {
                        const win = getVotingWindowInfo(meeting, simulatedClockIso);
                        return (
                          <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span
                              className={`font-medium ${
                                win.status === 'open'
                                  ? 'text-[#15803D]'
                                  : win.status === 'before'
                                  ? 'text-[#B45309]'
                                  : 'text-slate-500'
                              }`}
                            >
                              {win.statusLabel}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                              表决截止：{win.windowEndLabel}
                            </span>
                            {seat.memberCalcSnapshot && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="font-mono text-[11px] text-[#103D6B] tabular-nums">
                                  已存测算：{seat.memberCalcSnapshot.finalRating}（
                                  {seat.memberCalcSnapshot.computedScore.toFixed(1)}分）
                                </span>
                              </>
                            )}
                            {seat.reviewSubmission && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="font-semibold text-[#15803D]">
                                  已表决：{seat.reviewSubmission.voteResult}（
                                  {seat.reviewSubmission.proposedRating}）
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      {seat.status === 'pending' &&
                        (seat.reminderCount ?? 0) > 0 && (
                          <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded flex items-center gap-2 text-xs text-[#B45309]">
                            <BellRing className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              <strong>系统催办提醒（第 {seat.reminderCount} 次）：</strong>
                              信评委秘书处已通过系统匿名催办本席位
                              {seat.lastRemindedAt
                                ? `（${new Date(
                                    seat.lastRemindedAt
                                  ).toLocaleTimeString('zh-CN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}）`
                                : ''}
                              ，请尽快电子签署《利益冲突回避承诺函》确认出席，或及时申请回避以便自动递补。
                            </span>
                          </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      {seat.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setSigningTarget({ meeting, seat })
                            }
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors whitespace-nowrap"
                          >
                            {member.savedSignature?.autoApply ? (
                              <Sparkles className="w-3.5 h-3.5" />
                            ) : (
                              <PenTool className="w-3.5 h-3.5" />
                            )}
                            {member.savedSignature?.autoApply
                              ? '一键调用签名并确认出席'
                              : '电子签署回避承诺函并确认'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeclineTarget({
                                meetingId: meeting.id,
                                seatId: seat.seatId,
                                projectName: meeting.projectName,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#B91C1C] bg-white border border-red-200 rounded hover:bg-red-50 transition-colors whitespace-nowrap"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            申请回避/退回
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#15803D] whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            已签承诺函
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveReviewTarget({
                                meetingId: meeting.id,
                                seatId: seat.seatId,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors whitespace-nowrap"
                          >
                            {seat.reviewSubmission ? (
                              <Vote className="w-3.5 h-3.5" />
                            ) : (
                              <FolderOpen className="w-3.5 h-3.5" />
                            )}
                            {seat.reviewSubmission
                              ? '查看资料与已提交表决'
                              : '查阅项目资料与评审表决'}
                          </button>
                          {seat.conflictDeclaration && (
                            <button
                              type="button"
                              onClick={() =>
                                setViewingDeclaration(seat.conflictDeclaration!)
                              }
                              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#103D6B] bg-[#EFF6FF] border border-[#103D6B]/20 rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              查验承诺函
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* View 2: Dedicated High-Frequency Availability Maintenance Page */}
      {activeSubTab === 'availability' && (
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                近期可用评审时间段维护（高频快捷操作）
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                仅在标为「可参会」且无重叠排期的时段内参与智能匹配；单击任意时段单元格或使用下方快捷模板即可即时生效。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onBatchSetAvailability(member.id, 'all_open')}
                className="px-3 py-1.5 text-xs font-medium text-[#103D6B] bg-[#EFF6FF] border border-[#103D6B]/20 rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap"
              >
                本周全部开放
              </button>
              <button
                type="button"
                onClick={() => onBatchSetAvailability(member.id, 'am_only')}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                仅开放上午
              </button>
              <button
                type="button"
                onClick={() => onBatchSetAvailability(member.id, 'pm_only')}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                仅开放下午
              </button>
              <button
                type="button"
                onClick={() =>
                  onBatchSetAvailability(member.id, 'clear_unscheduled')
                }
                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                关闭未排会时段
              </button>
            </div>
          </div>

          <div className="px-6 py-3 bg-[#F8FAFC] border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-5">
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <span className="w-3 h-3 rounded-xs bg-white border border-slate-400 inline-block" />
                可参会（点击关闭）
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="w-3 h-3 rounded-xs bg-slate-200 border border-slate-300 inline-block" />
                已关闭不可用（点击开放）
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#103D6B] font-medium">
                <span className="w-3 h-3 rounded-xs bg-[#103D6B] inline-block" />
                已排会锁定
              </span>
            </div>
            <span className="font-mono tabular-nums text-slate-600">
              当前已开放 {member.availableSlotKeys.length} /{' '}
              {SCHEDULE_DATES.length * 8} 个时段 · 已排会 {occupiedSlotMap.size} 场
            </span>
          </div>

          <div className="p-6 space-y-5">
            {SCHEDULE_DATES.map((date) => {
              const dayOpenCount = (['AM', 'PM'] as HalfDay[]).reduce(
                (acc, hd) =>
                  acc +
                  [1, 2, 3, 4].filter((s) =>
                    member.availableSlotKeys.includes(
                      makeSlotKey(date, hd, s as SlotIndex)
                    )
                  ).length,
                0
              );
              return (
                <div
                  key={date}
                  className="border border-slate-200 rounded-md overflow-hidden"
                >
                  <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 text-xs">
                      <span className="font-mono font-semibold text-slate-900">
                        {date}
                        {date === referenceDate ? '（今日）' : ''}
                      </span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        开放 {dayOpenCount}/8 时段
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          onSetDayAvailability(member.id, date, 'AM', true)
                        }
                        className="text-[#103D6B] hover:underline"
                      >
                        全开上午
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSetDayAvailability(member.id, date, 'AM', false)
                        }
                        className="text-slate-500 hover:underline"
                      >
                        关闭上午
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() =>
                          onSetDayAvailability(member.id, date, 'PM', true)
                        }
                        className="text-[#103D6B] hover:underline"
                      >
                        全开下午
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onSetDayAvailability(member.id, date, 'PM', false)
                        }
                        className="text-slate-500 hover:underline"
                      >
                        关闭下午
                      </button>
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {(['AM', 'PM'] as HalfDay[]).map((hd) => (
                      <div key={hd} className="space-y-2">
                        <div className="text-[11px] font-medium text-slate-500">
                          {hd === 'AM' ? '上午场（09:00 - 12:35）' : '下午场（13:30 - 17:20）'}
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {HALF_DAY_SLOTS[hd].map((slot) => {
                            const key = makeSlotKey(
                              date,
                              hd,
                              slot.slotIndex as SlotIndex
                            );
                            const isAvailable =
                              member.availableSlotKeys.includes(key);
                            const occupiedNote = occupiedSlotMap.get(key);

                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => onToggleSlot(member.id, key)}
                                title={
                                  occupiedNote
                                    ? `已有安排：${occupiedNote}`
                                    : `${date} ${slot.label} ${slot.timeRange}`
                                }
                                className={`px-2.5 py-2.5 text-center rounded border transition-colors ${
                                  occupiedNote
                                    ? 'bg-[#103D6B] text-white border-[#103D6B]'
                                    : isAvailable
                                    ? 'bg-white text-slate-900 border-slate-300 hover:border-[#103D6B] hover:bg-[#EFF6FF]/40'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 line-through hover:bg-slate-200/60'
                                }`}
                              >
                                <div className="text-xs font-medium">
                                  第{slot.slotIndex}场
                                </div>
                                <div className="text-[11px] font-mono tabular-nums opacity-85 mt-0.5">
                                  {slot.timeRange.split('-')[0]}
                                </div>
                                <div className="text-[11px] mt-1 truncate">
                                  {occupiedNote
                                    ? '已排会'
                                    : isAvailable
                                    ? '可参会'
                                    : '不可用'}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View 3: Dedicated Expertise Ranking Settings (Separated from Availability) */}
      {activeSubTab === 'expertise' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-7 bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  本人专业领域顺位申报（3 至 5 项）
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  请按自身主攻与熟悉程度排序，保存后将实时生效于智能匹配引擎评分
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                已申报 {draftExpertise.length} / 5 项
              </span>
            </div>

            <div className="p-6 space-y-4">
              <div className="divide-y divide-slate-200 border border-slate-200 rounded">
                {draftExpertise.map((item, idx) => (
                  <div
                    key={item.subCategory}
                    className="px-4 py-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-semibold text-[#103D6B] tabular-nums">
                          第 {idx + 1} 顺位
                        </span>
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {item.subCategory}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
                        匹配基础专业分：+{config.rankScores[idx] ?? 0} 分
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveRank(idx, -1)}
                        aria-label="上移顺位"
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === draftExpertise.length - 1}
                        onClick={() => moveRank(idx, 1)}
                        aria-label="下移顺位"
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={draftExpertise.length <= 3}
                        onClick={() => removeRank(idx)}
                        aria-label="移除领域"
                        className="p-1.5 text-slate-400 hover:text-[#B91C1C] hover:bg-red-50 rounded disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {draftExpertise.length < 5 && undeclaredSubCategories.length > 0 && (
                <div className="flex items-center gap-2.5">
                  <select
                    value={
                      undeclaredSubCategories.some((s) => s.id === addSubChoice)
                        ? addSubChoice
                        : undeclaredSubCategories[0].id
                    }
                    onChange={(e) => setAddSubChoice(e.target.value as SubCategory)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                  >
                    {undeclaredSubCategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.major} · {sub.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addRank}
                    className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-medium text-[#103D6B] bg-[#EFF6FF] border border-[#103D6B]/20 rounded hover:bg-[#DBEAFE] whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加专业顺位
                  </button>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  {expertiseDirty
                    ? '检测到未保存的顺位调整，请点击右侧按钮保存'
                    : '当前专业顺位已同步至智能匹配引擎'}
                </span>
                <button
                  type="button"
                  disabled={!expertiseDirty}
                  onClick={() => onUpdateExpertise(member.id, draftExpertise)}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  保存专业顺位申报
                </button>
              </div>
            </div>
          </div>

          {/* Right: Scoring Policy Reference */}
          <div className="xl:col-span-5 bg-white border border-slate-200 rounded-md p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                专业顺位评分与轮换治理说明
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                低频结构性设置，独立于日常可用时间维护
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="font-medium text-slate-800">
                第 1 至第 5 顺位基础分权重
              </div>
              <div className="grid grid-cols-5 gap-2 text-center font-mono tabular-nums">
                {config.rankScores.map((score, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded"
                  >
                    <div className="text-[11px] text-slate-500">
                      第{idx + 1}顺位
                    </div>
                    <div className="text-sm font-semibold text-[#103D6B] mt-0.5">
                      +{score}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600 leading-relaxed">
              <div>
                <strong className="text-slate-900">半天连场保护：</strong>
                同半天同细分连续排会 +{config.sameHalfDaySameSubBonus} 分、紧邻时段 +
                {config.adjacentSlotBonus} 分，避免跨大类折返（跨大类{' '}
                {config.crossMajorPenalty} 分、折返空档 {config.backtrackGapPenalty}{' '}
                分）。
              </div>
              <div>
                <strong className="text-slate-900">固定利益冲突回避名单：</strong>
                {member.conflictIssuers.length > 0
                  ? member.conflictIssuers.join('、')
                  : '暂无备案关联回避发行人（由系统管理员统一维护）'}
                。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View 4: Dedicated Electronic Signature Setup & Auto-Recall */}
      {activeSubTab === 'signature' && (
        <MemberSignatureSettings
          member={member}
          onSaveSignature={onSaveSignature}
          onClearSignature={onClearSignature}
        />
      )}

      {/* View 5: Personal Historical Records & Analytics (Strictly Scoped to Self) */}
      {activeSubTab === 'analytics' && (
        <MemberAnalytics
          member={member}
          history={history}
          meetings={meetings}
          referenceDate={referenceDate}
          config={config}
        />
      )}

      {/* Decline / Avoidance Modal */}
      {declineTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-md shadow-lg p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                确认申请回避 / 退回本场评审席位
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                项目：{declineTarget.projectName}。提交后，系统将立即按确定性备用队列自动递补下一顺位委员并记入不可篡改审计日志。
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                回避或退回原因
              </label>
              <input
                type="text"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeclineTarget(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeclineAttendance(
                    declineTarget.meetingId,
                    declineTarget.seatId,
                    declineReason
                  );
                  setDeclineTarget(null);
                }}
                className="px-3.5 py-2 text-xs font-medium text-white bg-[#B91C1C] rounded hover:bg-red-800"
              >
                确认退回并自动递补
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Electronic Conflict Declaration Signing Modal (Auto-Recalls Saved Signature) */}
      <ConflictDeclarationModal
        mode="sign"
        open={Boolean(signingTarget)}
        meeting={signingTarget?.meeting ?? null}
        seat={signingTarget?.seat ?? null}
        savedSignature={member.savedSignature}
        onSaveDefaultSignature={(sig) => onSaveSignature(member.id, sig)}
        onClose={() => setSigningTarget(null)}
        onConfirmSigned={(payload) => {
          if (!signingTarget) return;
          onConfirmAttendance(
            signingTarget.meeting.id,
            signingTarget.seat.seatId,
            payload
          );
          setSigningTarget(null);
        }}
      />

      {/* Electronic Conflict Declaration Read-only Certificate Modal */}
      <ConflictDeclarationModal
        mode="view"
        open={Boolean(viewingDeclaration)}
        declaration={viewingDeclaration}
        onClose={() => setViewingDeclaration(null)}
      />
    </div>
  );
}
