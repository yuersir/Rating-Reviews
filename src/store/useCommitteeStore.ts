import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  AuditActionType,
  ConflictDeclarationRecord,
  ExpertiseRank,
  HalfDay,
  MajorCategory,
  MemberCalculationSnapshot,
  MemberReviewSubmission,
  RatingGrade,
  RatingOutlook,
  REVIEW_TYPE_MAP,
  ReviewMeeting,
  ReviewTypeCode,
  RoleType,
  RuleConfig,
  SavedMemberSignature,
  SlotIndex,
  SubCategory,
  SUB_TO_MAJOR,
  VoteResult,
  makeSlotKey,
} from '../types/domain';
import { createInitialAppState, DEFAULT_RULE_CONFIG, SCHEDULE_DATES } from '../data/seedData';
import { getVotingWindowInfo } from '../data/projectMaterials';
import { computeDeterministicHash, createAuditLogEntry } from '../engine/auditHash';
import {
  computeHalfDayOptimization,
  rotatePendingSeatsOnly,
  runDeterministicMatch,
  substituteSeatFromBackup,
} from '../engine/matchingEngine';

const STORAGE_KEY = 'crc_matching_rotation_state_v5';

export interface ToastMessage {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  detail?: string;
}

function loadStateFromStorage(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialAppState();
    const parsed = JSON.parse(raw) as AppState;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.members) ||
      !Array.isArray(parsed.secretaries)
    ) {
      return createInitialAppState();
    }
    return {
      ...parsed,
      simulatedClockIso: parsed.simulatedClockIso || '2026-11-20T13:50:00',
    };
  } catch {
    return createInitialAppState();
  }
}

export function useCommitteeStore() {
  const [state, setState] = useState<AppState>(() => loadStateFromStorage());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota issues gracefully
    }
  }, [state]);

  const pushToast = useCallback(
    (tone: ToastMessage['tone'], title: string, detail?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, tone, title, detail }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const appendAudit = (
    prev: AppState,
    params: {
      actorRole: RoleType;
      actorName: string;
      actionType: AuditActionType;
      targetRef: string;
      summary: string;
      details: string;
    }
  ) => [...prev.auditLogs, createAuditLogEntry(prev.auditLogs, params)];

  // Automatic 30-minute timeout scanner every 5 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      const nowMs = Date.now();
      setState((prev) => {
        let changed = false;
        let nextMeetings = prev.meetings;
        let nextLogs = prev.auditLogs;

        for (let i = 0; i < nextMeetings.length; i++) {
          const mt = nextMeetings[i];
          const expiredSeat = mt.seats.find(
            (s) => s.status === 'pending' && new Date(s.deadlineAt).getTime() <= nowMs
          );
          if (expiredSeat) {
            const subRes = substituteSeatFromBackup({
              meeting: mt,
              seatId: expiredSeat.seatId,
              reasonType: 'timeout',
              members: prev.members,
              allMeetings: nextMeetings,
              history: prev.history,
              config: prev.config,
            });
            nextMeetings = nextMeetings.map((item) =>
              item.id === mt.id ? subRes.updatedMeeting : item
            );
            nextLogs = [
              ...nextLogs,
              createAuditLogEntry(nextLogs, {
                actorRole: 'secretary',
                actorName: '系统超时轮换守护',
                actionType: 'TIMEOUT_AUTO_ROTATION',
                targetRef: mt.code,
                summary: `${expiredSeat.seatLabel}（${subRes.replacedOutName}）超过 ${prev.config.responseTimeoutMinutes} 分钟未响应，自动递补为 ${
                  subRes.replacedInName ?? '空缺'
                }`,
                details: `原席位委员 ${subRes.replacedOutName} 已写入本场排除集；按确定性备用队列首位递补 ${
                  subRes.replacedInName ?? '无可用候选人'
                }。`,
              }),
            ];
            changed = true;
          }
        }

        if (!changed) return prev;
        return { ...prev, meetings: nextMeetings, auditLogs: nextLogs };
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  const getActiveSecretaryLabel = (prev: AppState) => {
    const sec = prev.secretaries.find((s) => s.id === prev.activeSecretaryId);
    return sec ? `${sec.name}（${sec.employeeCode}）` : '信评委秘书处';
  };

  const setActiveRole = useCallback((role: RoleType) => {
    setState((prev) => ({ ...prev, activeRole: role }));
  }, []);

  const setActiveSecretaryId = useCallback((secretaryId: string) => {
    setState((prev) => ({ ...prev, activeSecretaryId: secretaryId }));
  }, []);

  const setActiveMemberId = useCallback((memberId: string) => {
    setState((prev) => ({ ...prev, activeMemberId: memberId }));
  }, []);

  // --- SECRETARY ACTIONS ---

  const addMeeting = useCallback(
    (payload: {
      projectName: string;
      issuer: string;
      subCategory: SubCategory;
      date: string;
      halfDay: HalfDay;
      slotIndex: SlotIndex;
      reviewType: ReviewTypeCode;
      reviewTriggerNote?: string;
      conflictMemberIds: string[];
      conflictNote?: string;
    }) => {
      const majorCategory = SUB_TO_MAJOR[payload.subCategory];
      let createdCode = '';
      setState((prev) => {
        const nextNum = 1101 + prev.meetings.length;
        createdCode = `CRC-2026-${nextNum}`;
        const newMeeting: ReviewMeeting = {
          id: `MT-${payload.date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`,
          code: createdCode,
          projectName: payload.projectName.trim(),
          issuer: payload.issuer.trim(),
          majorCategory,
          subCategory: payload.subCategory,
          date: payload.date,
          halfDay: payload.halfDay,
          slotIndex: payload.slotIndex,
          reviewType: payload.reviewType,
          reviewTriggerNote: payload.reviewTriggerNote?.trim() || undefined,
          conflictMemberIds: payload.conflictMemberIds,
          conflictNote: payload.conflictNote?.trim() || undefined,
          status: 'draft',
          seats: [],
          convenerBackupQueue: [],
          memberBackupQueue: [],
          excludedMemberIds: [],
          filteredOutCandidates: [],
          manualRotationCount: 0,
        };

        return {
          ...prev,
          meetings: [...prev.meetings, newMeeting],
          auditLogs: appendAudit(prev, {
            actorRole: 'secretary',
            actorName: getActiveSecretaryLabel(prev),
            actionType: 'MEETING_CREATED',
            targetRef: createdCode,
            summary: `新增评审需求「${newMeeting.projectName}」`,
            details: `评审类别：${REVIEW_TYPE_MAP[payload.reviewType].fullLabel}；领域：${majorCategory}/${payload.subCategory}；排期：${payload.date} ${
              payload.halfDay === 'AM' ? '上午' : '下午'
            }第${payload.slotIndex}场；指定回避委员 ${payload.conflictMemberIds.length} 人。`,
          }),
        };
      });
      pushToast('success', '已新增评审需求', `${createdCode} 已加入排期列表，可直接排期优化或运行智能匹配。`);
    },
    [pushToast]
  );

  const applyHalfDayOptimization = useCallback(
    (date: string, halfDay: HalfDay) => {
      let appliedSummary = '';
      let didChange = false;
      setState((prev) => {
        const preview = computeHalfDayOptimization(prev.meetings, date, halfDay);
        if (!preview.changed) {
          return prev;
        }
        didChange = true;
        appliedSummary = preview.clusterSummary;
        const slotMap = new Map(
          preview.slotAssignments.map((a) => [a.meetingId, a.newSlot])
        );
        const updatedMeetings = prev.meetings.map((m) => {
          const nextSlot = slotMap.get(m.id);
          if (!nextSlot) return m;
          return { ...m, slotIndex: nextSlot };
        });

        const moveDetail = preview.slotAssignments
          .map((a) => {
            const mt = prev.meetings.find((x) => x.id === a.meetingId);
            return `${mt?.code ?? a.meetingId}: 槽位${a.oldSlot}→${a.newSlot}(${a.reason})`;
          })
          .join('；');

        return {
          ...prev,
          meetings: updatedMeetings,
          auditLogs: appendAudit(prev, {
            actorRole: 'secretary',
            actorName: getActiveSecretaryLabel(prev),
            actionType: 'SCHEDULE_OPTIMIZED',
            targetRef: `${date}_${halfDay}`,
            summary: `执行 ${date} ${halfDay === 'AM' ? '上午' : '下午'}半天防折返排期优化`,
            details: `${preview.clusterSummary}。调整明细：${moveDetail}`,
          }),
        };
      });

      if (didChange) {
        pushToast('success', '半天防折返排期已优化', appliedSummary);
      } else {
        pushToast('info', '当前半天排期已为最优聚类顺序', '同类项目已连续且冲突项目已在边缘位置。');
      }
    },
    [pushToast]
  );

  const executeMatchForMeeting = useCallback(
    (meetingId: string) => {
      let resultNote = '';
      let warningNote: string | undefined;

      setState((prev) => {
        const meeting = prev.meetings.find((m) => m.id === meetingId);
        if (!meeting) return prev;

        const matchRes = runDeterministicMatch({
          meeting,
          members: prev.members,
          allMeetings: prev.meetings,
          history: prev.history,
          config: prev.config,
        });
        warningNote = matchRes.shortageWarning;
        resultNote = `已完成 ${matchRes.seats.length} 个席位盲配（身份加密封存），待委员电子签署《利益冲突回避承诺函》后自动解盲`;

        const updatedMeeting: ReviewMeeting = {
          ...meeting,
          status: 'matched',
          seats: matchRes.seats,
          convenerBackupQueue: matchRes.convenerBackupQueue,
          memberBackupQueue: matchRes.memberBackupQueue,
          filteredOutCandidates: matchRes.filteredOutCandidates,
          lastMatchedAt: new Date().toISOString(),
        };

        return {
          ...prev,
          meetings: prev.meetings.map((m) =>
            m.id === meetingId ? updatedMeeting : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'secretary',
            actorName: getActiveSecretaryLabel(prev),
            actionType: 'AUTO_MATCHED',
            targetRef: meeting.code,
            summary: `运行智能匹配（盲抽加密封存）：${meeting.projectName}`,
            details: `匹配结果（仅审计实名归档）：${matchRes.seats
              .map((s) => `${s.seatLabel}[${s.blindCode}]:${s.memberName}(${s.totalScore}分)`)
              .join('、')}；前置硬过滤剔除 ${
              matchRes.filteredOutCandidates.length
            } 人；封存确定性备用队列：召集人 ${matchRes.convenerBackupQueue.length} 人 / 委员 ${
              matchRes.memberBackupQueue.length
            } 人。`,
          }),
        };
      });

      if (warningNote) {
        pushToast('warning', '智能匹配已完成（存在席位缺口）', warningNote);
      } else {
        pushToast('success', '智能盲配已完成', `${resultNote}。`);
      }
    },
    [pushToast]
  );

  const manualRotateSeat = useCallback(
    (meetingId: string, seatId: string, reason: string) => {
      let blocked = false;
      let confirmedLocked = false;
      let msgTitle = '';
      let msgDetail = '';

      setState((prev) => {
        const meeting = prev.meetings.find((m) => m.id === meetingId);
        if (!meeting) return prev;
        const targetSeat = meeting.seats.find((s) => s.seatId === seatId);
        if (!targetSeat) return prev;
        if (targetSeat.status === 'confirmed') {
          confirmedLocked = true;
          return prev;
        }
        if (meeting.manualRotationCount >= prev.config.maxManualRotations) {
          blocked = true;
          return prev;
        }
        const subRes = substituteSeatFromBackup({
          meeting,
          seatId,
          reasonType: 'manual',
          members: prev.members,
          allMeetings: prev.meetings,
          history: prev.history,
          config: prev.config,
        });

        const nextCount = subRes.updatedMeeting.manualRotationCount;
        const nextSeat = subRes.updatedMeeting.seats.find((s) => s.seatId === seatId);
        msgTitle = `已完成第 ${nextCount}/${prev.config.maxManualRotations} 次盲态手动轮换`;
        msgDetail = subRes.replacedInName
          ? `已从加密备用队列自动递补新候选人（盲码 ${nextSeat?.blindCode ?? 'ENC'}），待签署回避承诺函后解盲显示实名。`
          : '当前无可用加密备用人选。';

        return {
          ...prev,
          meetings: prev.meetings.map((m) =>
            m.id === meetingId ? subRes.updatedMeeting : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'secretary',
            actorName: getActiveSecretaryLabel(prev),
            actionType: 'MANUAL_ROTATION',
            targetRef: meeting.code,
            summary: `秘书盲态启动单席位轮换（${nextCount}/${prev.config.maxManualRotations}次）`,
            details: `审计实名归档：替换待确认席位 ${subRes.replacedOutName} → 加密备用队列递补 ${
              subRes.replacedInName ?? '无可用人选'
            }；操作事由：${reason || '工作档期临时冲突协调'}。`,
          }),
        };
      });

      if (confirmedLocked) {
        pushToast(
          'danger',
          '已确认参会席位已锁定，无权轮换',
          '委员签署《利益冲突回避承诺函》并确认参会后，秘书工作台不再享有对该席位的手动轮换权限。'
        );
      } else if (blocked) {
        pushToast(
          'danger',
          '已达单场手动轮换上限（防挑人限制）',
          '为防止人为挑人，单场评审会不可超出系统管理员设定的手动轮换次数上限。'
        );
      } else {
        pushToast('info', msgTitle, msgDetail);
      }
    },
    [pushToast]
  );

  const manualRotateFullPanel = useCallback(
    (meetingId: string, reason: string) => {
      let blocked = false;
      let noPendingBlocked = false;
      let detail = '';

      setState((prev) => {
        const meeting = prev.meetings.find((m) => m.id === meetingId);
        if (!meeting) return prev;
        const pendingSeats = meeting.seats.filter((s) => s.status === 'pending');
        if (pendingSeats.length === 0) {
          noPendingBlocked = true;
          return prev;
        }
        if (meeting.manualRotationCount >= prev.config.maxManualRotations) {
          blocked = true;
          return prev;
        }

        const rotRes = rotatePendingSeatsOnly({
          meeting,
          members: prev.members,
          allMeetings: prev.meetings,
          history: prev.history,
          config: prev.config,
        });

        const nextCount = rotRes.updatedMeeting.manualRotationCount;
        const confirmedKeptCount = rotRes.updatedMeeting.seats.filter(
          (s) => s.status === 'confirmed'
        ).length;

        detail = `已执行第 ${nextCount}/${prev.config.maxManualRotations} 次待确认席位盲态轮换，仅替换 ${pendingSeats.length} 个未确认加密席位（已确认参会的 ${confirmedKeptCount} 个席位保持锁定不变）。`;

        return {
          ...prev,
          meetings: prev.meetings.map((m) =>
            m.id === meetingId ? rotRes.updatedMeeting : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'secretary',
            actorName: getActiveSecretaryLabel(prev),
            actionType: 'MANUAL_ROTATION',
            targetRef: meeting.code,
            summary: `秘书盲态轮换全部待确认席位（${nextCount}/${prev.config.maxManualRotations}次，已确认席位保持锁定）`,
            details: `事由：${
              reason || '待确认委员档期临时变更'
            }；锁定保留已确认席位 ${confirmedKeptCount} 席；替换原待确认委员：${rotRes.rotatedOutNames.join(
              '、'
            )} → 加密递补：${rotRes.rotatedInNames.join('、') || '无可用备用'}。`,
          }),
        };
      });

      if (noPendingBlocked) {
        pushToast(
          'danger',
          '全部席位均已确认参会并锁定',
          '秘书工作台仅可对待确认的加密席位发起盲态轮换，已确认参会席位不可手动替换。'
        );
      } else if (blocked) {
        pushToast(
          'danger',
          '已触发防挑人上限拦截',
          '本场手动轮换次数已用尽，仅允许等待委员确认或由系统30分钟超时自动递补。'
        );
      } else {
        pushToast('info', '已完成待确认席位盲态轮换', detail);
      }
    },
    [pushToast]
  );

  const simulateTimeoutForSeat = useCallback(
    (meetingId: string, seatId: string) => {
      let info = '';
      setState((prev) => {
        const meeting = prev.meetings.find((m) => m.id === meetingId);
        if (!meeting) return prev;
        const subRes = substituteSeatFromBackup({
          meeting,
          seatId,
          reasonType: 'timeout',
          members: prev.members,
          allMeetings: prev.meetings,
          history: prev.history,
          config: prev.config,
        });
        const nextSeat = subRes.updatedMeeting.seats.find((s) => s.seatId === seatId);
        info = subRes.replacedInName
          ? `超时席位已自动切换至加密备用递补人选（盲码 ${nextSeat?.blindCode ?? 'ENC'}），签署回避承诺函后解盲。`
          : '超时席位暂无可用备用递补人选。';
        return {
          ...prev,
          meetings: prev.meetings.map((m) =>
            m.id === meetingId ? subRes.updatedMeeting : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'secretary',
            actorName: '超时自动轮换引擎（演练触发）',
            actionType: 'TIMEOUT_AUTO_ROTATION',
            targetRef: meeting.code,
            summary: `模拟 30 分钟响应超时自动轮换（审计归档：${subRes.replacedOutName} → ${
              subRes.replacedInName ?? '空缺'
            }）`,
            details: `不消耗秘书手动轮换次数；系统严格按封存确定性备用队列首位递补并重新开启 30 分钟响应倒计时，签署承诺函前对秘书工作台保持脱敏。`,
          }),
        };
      });
      pushToast('warning', '已触发 30 分钟超时自动递补', info);
    },
    [pushToast]
  );

  const sendSeatReminder = useCallback(
    (meetingId: string, seatId?: string) => {
      let nudgedCount = 0;
      let targetLabel = '';
      setState((prev) => {
        const meeting = prev.meetings.find((m) => m.id === meetingId);
        if (!meeting) return prev;
        const nowIso = new Date().toISOString();

        const targetedSeats = meeting.seats.filter(
          (s) => s.status === 'pending' && (!seatId || s.seatId === seatId)
        );
        if (targetedSeats.length === 0) return prev;

        nudgedCount = targetedSeats.length;
        targetLabel =
          targetedSeats.length === 1
            ? `${targetedSeats[0].seatLabel}（加密代号 ${targetedSeats[0].blindCode}）`
            : `全部 ${targetedSeats.length} 个待确认加密席位`;

        const nextSeats = meeting.seats.map((s) => {
          if (s.status !== 'pending') return s;
          if (seatId && s.seatId !== seatId) return s;
          return {
            ...s,
            reminderCount: (s.reminderCount ?? 0) + 1,
            lastRemindedAt: nowIso,
          };
        });

        return {
          ...prev,
          meetings: prev.meetings.map((m) =>
            m.id === meetingId ? { ...m, seats: nextSeats } : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'secretary',
            actorName: getActiveSecretaryLabel(prev),
            actionType: 'SECRETARY_REMINDER_SENT',
            targetRef: meeting.code,
            summary: `系统代发参会确认与承诺函签署催办通知（${targetLabel}）`,
            details: `在不向秘书工作台披露未签人员实名的前提下，由系统后台定向推送催办提醒至 ${targetedSeats
              .map((s) => `${s.seatLabel}[${s.blindCode}]`)
              .join('、')}（审计实名：${targetedSeats
              .map((s) => s.memberName)
              .join('、')}）。`,
          }),
        };
      });

      if (nudgedCount > 0) {
        pushToast(
          'info',
          '系统已发出匿名催办通知',
          `已向 ${targetLabel} 发送参会确认及电子签署催办提醒，委员工作台将即时收到提醒。`
        );
      }
    },
    [pushToast]
  );

  // --- MEMBER ACTIONS ---

  const updateMemberExpertise = useCallback(
    (memberId: string, expertise: ExpertiseRank[]) => {
      if (expertise.length < 3 || expertise.length > 5) {
        pushToast('danger', '专业顺位数量不符合规定', '每位委员须自主申报 3 至 5 个专业细分领域。');
        return;
      }
      setState((prev) => {
        const target = prev.members.find((m) => m.id === memberId);
        if (!target) return prev;
        const normalized: ExpertiseRank[] = expertise.map((item, idx) => ({
          rank: (idx + 1) as 1 | 2 | 3 | 4 | 5,
          subCategory: item.subCategory,
        }));
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === memberId ? { ...m, expertise: normalized } : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'member',
            actorName: target.name,
            actionType: 'EXPERTISE_UPDATED',
            targetRef: target.employeeCode,
            summary: `${target.name} 更新了 ${normalized.length} 项专业顺位申报`,
            details: normalized
              .map(
                (e) =>
                  `第${e.rank}顺位(${prev.config.rankScores[e.rank - 1]}分): ${
                    e.subCategory
                  }`
              )
              .join('；'),
          }),
        };
      });
      pushToast('success', '专业领域顺位已保存', '新顺位权重将立即生效于后续智能匹配。');
    },
    [pushToast]
  );

  const toggleMemberSlotAvailability = useCallback(
    (memberId: string, slotKey: string) => {
      setState((prev) => {
        const target = prev.members.find((m) => m.id === memberId);
        if (!target) return prev;
        const exists = target.availableSlotKeys.includes(slotKey);
        const nextSlots = exists
          ? target.availableSlotKeys.filter((k) => k !== slotKey)
          : [...target.availableSlotKeys, slotKey];

        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === memberId ? { ...m, availableSlotKeys: nextSlots } : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'member',
            actorName: target.name,
            actionType: 'AVAILABILITY_UPDATED',
            targetRef: `${target.employeeCode}/${slotKey}`,
            summary: `${target.name} ${exists ? '关闭' : '开放'}可用时段 ${slotKey}`,
            details: `当前已申报可用时段总数：${nextSlots.length} 个。`,
          }),
        };
      });
    },
    []
  );

  const setMemberDayAvailability = useCallback(
    (memberId: string, date: string, halfDay: HalfDay, available: boolean) => {
      setState((prev) => {
        const target = prev.members.find((m) => m.id === memberId);
        if (!target) return prev;
        const keys = [1, 2, 3, 4].map((s) =>
          makeSlotKey(date, halfDay, s as SlotIndex)
        );
        const currentSet = new Set(target.availableSlotKeys);
        keys.forEach((k) => {
          if (available) currentSet.add(k);
          else currentSet.delete(k);
        });
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === memberId
              ? { ...m, availableSlotKeys: Array.from(currentSet) }
              : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'member',
            actorName: target.name,
            actionType: 'AVAILABILITY_UPDATED',
            targetRef: `${target.employeeCode}/${date}_${halfDay}`,
            summary: `${target.name} 批量${available ? '开放' : '关闭'} ${date} ${
              halfDay === 'AM' ? '上午' : '下午'
            }全部时段`,
            details: `影响时段：${keys.join('、')}`,
          }),
        };
      });
      pushToast(
        'info',
        available ? '已批量开放半天可用时段' : '已批量关闭半天可用时段',
        `${date} ${halfDay === 'AM' ? '上午' : '下午'}`
      );
    },
    [pushToast]
  );

  const batchSetMemberAvailability = useCallback(
    (
      memberId: string,
      preset: 'all_open' | 'am_only' | 'pm_only' | 'clear_unscheduled'
    ) => {
      const presetLabels: Record<typeof preset, string> = {
        all_open: '本周全部时段开放',
        am_only: '仅开放上午时段',
        pm_only: '仅开放下午时段',
        clear_unscheduled: '关闭所有未排会时段',
      };
      setState((prev) => {
        const target = prev.members.find((m) => m.id === memberId);
        if (!target) return prev;

        // Preserve slots where this member already has an active assignment
        const lockedKeys = new Set<string>();
        prev.meetings.forEach((mt) => {
          const seat = mt.seats.find(
            (s) =>
              s.memberId === memberId &&
              (s.status === 'confirmed' || s.status === 'pending')
          );
          if (seat) {
            lockedKeys.add(makeSlotKey(mt.date, mt.halfDay, mt.slotIndex));
          }
        });

        const nextKeys = new Set<string>(lockedKeys);
        SCHEDULE_DATES.forEach((date) => {
          (['AM', 'PM'] as HalfDay[]).forEach((hd) => {
            const shouldOpen =
              preset === 'all_open' ||
              (preset === 'am_only' && hd === 'AM') ||
              (preset === 'pm_only' && hd === 'PM');
            if (shouldOpen) {
              ([1, 2, 3, 4] as SlotIndex[]).forEach((s) => {
                nextKeys.add(makeSlotKey(date, hd, s));
              });
            }
          });
        });

        const nextList = Array.from(nextKeys);
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === memberId ? { ...m, availableSlotKeys: nextList } : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'member',
            actorName: target.name,
            actionType: 'AVAILABILITY_UPDATED',
            targetRef: `${target.employeeCode}/BATCH_${preset.toUpperCase()}`,
            summary: `${target.name} 执行可用时间快捷批量设置：${presetLabels[preset]}`,
            details: `调整后已开放时段数：${nextList.length} 个（已自动保留 ${lockedKeys.size} 个已排会锁定槽位）。`,
          }),
        };
      });
      pushToast('success', '可用时间批量设置已生效', presetLabels[preset]);
    },
    [pushToast]
  );

  const saveMemberSignature = useCallback(
    (memberId: string, signature: SavedMemberSignature) => {
      setState((prev) => {
        const target = prev.members.find((m) => m.id === memberId);
        if (!target) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === memberId ? { ...m, savedSignature: signature } : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'member',
            actorName: target.name,
            actionType: 'SIGNATURE_UPDATED',
            targetRef: target.employeeCode,
            summary: `${target.name} 更新了默认电子签名设置`,
            details: `签名类型：${
              signature.method === 'handwritten' ? '手写电子签名' : '实名合规电子签章'
            }；签署承诺函自动调用：${signature.autoApply ? '已开启' : '未开启'}。`,
          }),
        };
      });
      pushToast(
        'success',
        '默认电子签名已保存',
        signature.autoApply
          ? '后续签署《利益冲突回避承诺函》时将自动调用此签名，减少重复操作。'
          : '已保存默认签名，签署时可一键调用。'
      );
    },
    [pushToast]
  );

  const clearMemberSignature = useCallback(
    (memberId: string) => {
      setState((prev) => {
        const target = prev.members.find((m) => m.id === memberId);
        if (!target) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === memberId ? { ...m, savedSignature: undefined } : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'member',
            actorName: target.name,
            actionType: 'SIGNATURE_UPDATED',
            targetRef: target.employeeCode,
            summary: `${target.name} 清除了预存的默认电子签名`,
            details: '后续签署《利益冲突回避承诺函》时需现场手写签名或输入实名签章。',
          }),
        };
      });
      pushToast('info', '已清除默认电子签名', '可随时重新绘制或启用实名签章。');
    },
    [pushToast]
  );

  const confirmSeatAttendance = useCallback(
    (
      meetingId: string,
      seatId: string,
      signaturePayload: {
        signingMethod: 'handwritten' | 'typed_seal';
        signatureDataUrl?: string;
        typedSealText?: string;
        clausesAccepted: string[];
      }
    ) => {
      let actor = '';
      let declId = '';
      setState((prev) => {
        const meeting = prev.meetings.find((m) => m.id === meetingId);
        if (!meeting) return prev;
        const seat = meeting.seats.find((s) => s.seatId === seatId);
        if (!seat) return prev;
        actor = seat.memberName;

        const signedAt = new Date().toISOString();
        declId = `COI-${meeting.code}-${seat.employeeCode}-${Date.now().toString().slice(-4)}`;
        const declarationHash = computeDeterministicHash(
          [
            declId,
            seat.memberId,
            seat.memberName,
            meeting.code,
            meeting.issuer,
            signaturePayload.signingMethod,
            signaturePayload.typedSealText ??
              (signaturePayload.signatureDataUrl
                ? signaturePayload.signatureDataUrl.slice(0, 128)
                : ''),
            signedAt,
            signaturePayload.clausesAccepted.join('|'),
          ].join('|')
        );

        const conflictDeclaration: ConflictDeclarationRecord = {
          declarationId: declId,
          signerMemberId: seat.memberId,
          signerName: seat.memberName,
          signerEmployeeCode: seat.employeeCode,
          meetingCode: meeting.code,
          projectName: meeting.projectName,
          issuer: meeting.issuer,
          seatLabel: seat.seatLabel,
          signingMethod: signaturePayload.signingMethod,
          signatureDataUrl: signaturePayload.signatureDataUrl,
          typedSealText: signaturePayload.typedSealText,
          clausesAccepted: signaturePayload.clausesAccepted,
          signedAt,
          declarationHash,
        };

        const nextSeats = meeting.seats.map((s) =>
          s.seatId === seatId
            ? {
                ...s,
                status: 'confirmed' as const,
                respondedAt: signedAt,
                conflictDeclaration,
              }
            : s
        );
        const allConfirmed =
          nextSeats.length > 0 && nextSeats.every((s) => s.status === 'confirmed');

        return {
          ...prev,
          meetings: prev.meetings.map((m) =>
            m.id === meetingId
              ? {
                  ...m,
                  seats: nextSeats,
                  status: allConfirmed ? 'confirmed' : m.status,
                }
              : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'member',
            actorName: seat.memberName,
            actionType: 'MEMBER_CONFIRMED',
            targetRef: meeting.code,
            summary: `${seat.memberName} 完成电子签署利益冲突回避承诺函并确认出席（${seat.seatLabel}）`,
            details: `承诺函编号：${declId}；签署方式：${
              signaturePayload.signingMethod === 'handwritten'
                ? '手写电子签名'
                : '实名电子签章'
            }；承诺函防篡改摘要：${declarationHash.slice(0, 16)}…；已锁定席位并同步同半天跨类/连场上下文。`,
          }),
        };
      });
      pushToast(
        'success',
        '已完成电子签署并确认出席',
        `${actor} 的《利益冲突回避承诺函》（${declId}）已存证上链，现已解锁本项目全部评审资料、自行测算及表决入口。`
      );
    },
    [pushToast]
  );

  const setSimulatedClock = useCallback((iso: string) => {
    setState((prev) => ({ ...prev, simulatedClockIso: iso }));
  }, []);

  const saveMemberCalculation = useCallback(
    (
      meetingId: string,
      seatId: string,
      snapshot: MemberCalculationSnapshot
    ) => {
      let savedActor = '';
      let blockedReason = '';

      setState((prev) => {
        const meeting = prev.meetings.find((m) => m.id === meetingId);
        if (!meeting) return prev;
        const seat = meeting.seats.find((s) => s.seatId === seatId);
        if (!seat) return prev;
        if (seat.status !== 'confirmed' || !seat.conflictDeclaration) {
          blockedReason = '请先完成《利益冲突回避承诺函》电子签署后再进行自行测算。';
          return prev;
        }
        savedActor = seat.memberName;

        const nextSeats = meeting.seats.map((s) =>
          s.seatId === seatId ? { ...s, memberCalcSnapshot: snapshot } : s
        );

        return {
          ...prev,
          meetings: prev.meetings.map((m) =>
            m.id === meetingId ? { ...m, seats: nextSeats } : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'member',
            actorName: seat.memberName,
            actionType: 'MEMBER_CALC_SAVED',
            targetRef: meeting.code,
            summary: `${seat.memberName} 保存了个人模型测算分析快照（${snapshot.finalRating} / ${snapshot.computedScore.toFixed(1)}分）`,
            details: `测算情景：${snapshot.scenarioLabel}；基础级别 ${snapshot.baseRating}，子级调整 ${
              snapshot.notchDelta >= 0 ? `+${snapshot.notchDelta}` : snapshot.notchDelta
            }，最终测算级别 ${snapshot.finalRating}。${
              snapshot.memo ? `备注：${snapshot.memo}` : ''
            }`,
          }),
        };
      });

      if (blockedReason) {
        pushToast('danger', '测算保存被拦截', blockedReason);
      } else if (savedActor) {
        pushToast(
          'success',
          '个人测算快照已保存',
          `已记录测算得分 ${snapshot.computedScore.toFixed(1)} 分（测算级别 ${snapshot.finalRating}），可一键带入评审意见。`
        );
      }
    },
    [pushToast]
  );

  const submitMemberReviewVote = useCallback(
    (
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
    ) => {
      let blockedReason = '';
      let successTitle = '';
      let successDetail = '';

      setState((prev) => {
        const meeting = prev.meetings.find((m) => m.id === meetingId);
        if (!meeting) return prev;
        const seat = meeting.seats.find((s) => s.seatId === seatId);
        if (!seat) return prev;

        if (seat.status !== 'confirmed' || !seat.conflictDeclaration) {
          blockedReason =
            '尚未完成《利益冲突回避承诺函》电子签署，无权发表评审意见或参与表决。';
          return prev;
        }

        const win = getVotingWindowInfo(meeting, prev.simulatedClockIso);
        if (win.status !== 'open') {
          blockedReason =
            win.status === 'before'
              ? `当前尚未到达开会时间（${win.windowStartLabel}），暂不可发表评审意见或投票。`
              : `本场评审会表决已于 ${win.windowEndLabel}（会后次日下班前）截止，不可再提交或修改。`;
          return prev;
        }

        const trimmedOpinion = payload.opinionText.trim();
        if (!trimmedOpinion) {
          blockedReason = '请填写实质性评审意见后再提交表决。';
          return prev;
        }

        if (
          payload.voteResult === '有条件通过' &&
          !(payload.conditionsText && payload.conditionsText.trim())
        ) {
          blockedReason = '选择「有条件通过」时须明确填写落实前提条件。';
          return prev;
        }

        const nowIso = new Date().toISOString();
        const prevSub = seat.reviewSubmission;
        const revisionCount = (prevSub?.revisionCount ?? 0) + 1;
        const submissionId =
          prevSub?.submissionId ??
          `VOTE-${meeting.code}-${seat.employeeCode}-${Date.now().toString().slice(-4)}`;

        const submissionHash = computeDeterministicHash(
          [
            submissionId,
            seat.memberId,
            meeting.code,
            payload.voteResult,
            payload.proposedRating,
            payload.proposedOutlook,
            trimmedOpinion,
            payload.conditionsText?.trim() ?? '',
            nowIso,
            String(revisionCount),
          ].join('|')
        );

        const submission: MemberReviewSubmission = {
          submissionId,
          voteResult: payload.voteResult,
          proposedRating: payload.proposedRating,
          proposedOutlook: payload.proposedOutlook,
          opinionText: trimmedOpinion,
          conditionsText: payload.conditionsText?.trim() || undefined,
          referencedCalcScore: payload.referencedCalcScore,
          referencedCalcRating: payload.referencedCalcRating,
          submittedAt: prevSub?.submittedAt ?? nowIso,
          updatedAt: nowIso,
          revisionCount,
          submissionHash,
        };

        const nextSeats = meeting.seats.map((s) =>
          s.seatId === seatId ? { ...s, reviewSubmission: submission } : s
        );

        const allVoted =
          nextSeats.length > 0 &&
          nextSeats.every(
            (s) => s.status === 'confirmed' && Boolean(s.reviewSubmission)
          );

        // Sync/upsert into history so both personal & committee-wide analytics immediately reflect this vote
        const historyRecordId = `HIS-VOTE-${meeting.id}-${seat.memberId}`;
        const historyRecord = {
          id: historyRecordId,
          date: meeting.date,
          projectName: meeting.projectName,
          issuer: meeting.issuer,
          majorCategory: meeting.majorCategory,
          subCategory: meeting.subCategory,
          memberId: seat.memberId,
          seatRole: seat.seatRole,
          voteResult: payload.voteResult,
          reviewType: meeting.reviewType,
        };
        const existsInHistory = prev.history.some((h) => h.id === historyRecordId);
        const nextHistory = existsInHistory
          ? prev.history.map((h) => (h.id === historyRecordId ? historyRecord : h))
          : [historyRecord, ...prev.history];

        successTitle =
          revisionCount > 1
            ? `已修订评审意见并重新投票（第 ${revisionCount} 版）`
            : '评审意见与投票表决已提交存证';
        successDetail = `表决结果：${payload.voteResult}（建议级别 ${payload.proposedRating} / ${payload.proposedOutlook}），表决凭证 ${submissionId} 已写入历史记录与审计链。`;

        return {
          ...prev,
          meetings: prev.meetings.map((m) =>
            m.id === meetingId
              ? {
                  ...m,
                  seats: nextSeats,
                  status: allVoted ? 'completed' : m.status,
                }
              : m
          ),
          history: nextHistory,
          auditLogs: appendAudit(prev, {
            actorRole: 'member',
            actorName: seat.memberName,
            actionType: 'MEMBER_VOTED',
            targetRef: meeting.code,
            summary: `${seat.memberName}（${seat.seatLabel}）提交评审表决：${payload.voteResult}（${payload.proposedRating}/${payload.proposedOutlook}）`,
            details: `表决编号：${submissionId}（第 ${revisionCount} 版）；操作时钟：${win.currentClockLabel}（有效窗口 ${win.windowStartLabel}–${win.windowEndLabel}）；防篡改哈希：${submissionHash.slice(
              0,
              16
            )}…；意见摘要：${trimmedOpinion.slice(0, 80)}${
              trimmedOpinion.length > 80 ? '…' : ''
            }`,
          }),
        };
      });

      if (blockedReason) {
        pushToast('danger', '表决提交未通过校验', blockedReason);
      } else if (successTitle) {
        pushToast('success', successTitle, successDetail);
      }
    },
    [pushToast]
  );

  const declineSeatAndSubstitute = useCallback(
    (meetingId: string, seatId: string, reason: string) => {
      let info = '';
      setState((prev) => {
        const meeting = prev.meetings.find((m) => m.id === meetingId);
        if (!meeting) return prev;
        const seat = meeting.seats.find((s) => s.seatId === seatId);
        if (!seat) return prev;

        const subRes = substituteSeatFromBackup({
          meeting,
          seatId,
          reasonType: 'decline',
          declineReason: reason,
          members: prev.members,
          allMeetings: prev.meetings,
          history: prev.history,
          config: prev.config,
        });
        info = subRes.replacedInName
          ? '系统已从加密备用队列自动递补下一顺位合规委员（签署回避承诺函前保持隐名）'
          : '当前暂无可用加密备用人选，已通知秘书处协调';

        return {
          ...prev,
          meetings: prev.meetings.map((m) =>
            m.id === meetingId ? subRes.updatedMeeting : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'member',
            actorName: seat.memberName,
            actionType: 'MEMBER_DECLINED',
            targetRef: meeting.code,
            summary: `${seat.memberName} 申请回避/退回席位，自动递补为 ${
              subRes.replacedInName ?? '空缺'
            }`,
            details: `回避事由：${reason || '临时档期冲突/利益回避'}；已加入本场排除集并触发备用队列递补。`,
          }),
        };
      });
      pushToast('warning', '已受理回避并自动递补', info);
    },
    [pushToast]
  );

  // --- ADMIN ACTIONS ---

  const updateRuleConfig = useCallback(
    (nextConfig: RuleConfig) => {
      setState((prev) => {
        const diffNotes: string[] = [];
        if (prev.config.convenerConcentrationCap !== nextConfig.convenerConcentrationCap) {
          diffNotes.push(
            `召集集中度上限 ${(prev.config.convenerConcentrationCap * 100).toFixed(0)}%→${(
              nextConfig.convenerConcentrationCap * 100
            ).toFixed(0)}%`
          );
        }
        if (prev.config.coldStartThreshold !== nextConfig.coldStartThreshold) {
          diffNotes.push(
            `冷启动阈值 ${prev.config.coldStartThreshold}→${nextConfig.coldStartThreshold}场`
          );
        }
        if (prev.config.maxManualRotations !== nextConfig.maxManualRotations) {
          diffNotes.push(
            `手动轮换防挑人上限 ${prev.config.maxManualRotations}→${nextConfig.maxManualRotations}次`
          );
        }
        if (prev.config.chiefPriorityBonus !== nextConfig.chiefPriorityBonus) {
          diffNotes.push(
            `重点类别主任委员优先加分 ${prev.config.chiefPriorityBonus}→${nextConfig.chiefPriorityBonus}`
          );
        }
        const prevTypes = [...prev.config.chiefPriorityReviewTypes].sort().join('/');
        const nextTypes = [...nextConfig.chiefPriorityReviewTypes].sort().join('/');
        if (prevTypes !== nextTypes) {
          diffNotes.push(
            `主任委员优先评审类别 [${prevTypes || '无'}]→[${nextTypes || '无'}]`
          );
        }
        if (prev.config.backtrackGapPenalty !== nextConfig.backtrackGapPenalty) {
          diffNotes.push(
            `折返空档罚分 ${prev.config.backtrackGapPenalty}→${nextConfig.backtrackGapPenalty}`
          );
        }
        if (prev.config.crossMajorPenalty !== nextConfig.crossMajorPenalty) {
          diffNotes.push(
            `跨大类降权 ${prev.config.crossMajorPenalty}→${nextConfig.crossMajorPenalty}`
          );
        }

        return {
          ...prev,
          config: nextConfig,
          auditLogs: appendAudit(prev, {
            actorRole: 'admin',
            actorName: '系统管理员',
            actionType: 'RULE_CONFIG_UPDATED',
            targetRef: 'GLOBAL_RULES',
            summary: '实时更新智能匹配规则与评分权重参数',
            details:
              diffNotes.length > 0
                ? diffNotes.join('；')
                : `更新顺位分 [${nextConfig.rankScores.join('/')}] 及连场参数（同细分 +${
                    nextConfig.sameHalfDaySameSubBonus
                  } / 紧邻 +${nextConfig.adjacentSlotBonus} / 同大类跨细分 ${
                    nextConfig.sameMajorCrossSubPenalty
                  } / 超时 ${nextConfig.responseTimeoutMinutes} 分钟）。`,
          }),
        };
      });
      pushToast('success', '规则与评分参数已实时生效', '下一次智能匹配与集中度预警将立即按新参数执行。');
    },
    [pushToast]
  );

  const resetRuleConfigToDefault = useCallback(() => {
    updateRuleConfig({ ...DEFAULT_RULE_CONFIG });
  }, [updateRuleConfig]);

  const updateMemberGovernance = useCallback(
    (
      memberId: string,
      updates: {
        active: boolean;
        canConvene: boolean;
        isChiefCommissioner: boolean;
        chiefCategories: MajorCategory[];
        conflictIssuers: string[];
      }
    ) => {
      let name = '';
      setState((prev) => {
        const target = prev.members.find((m) => m.id === memberId);
        if (!target) return prev;
        name = target.name;
        const normalizedChiefCats = updates.isChiefCommissioner
          ? updates.chiefCategories
          : [];
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  active: updates.active,
                  canConvene: updates.isChiefCommissioner ? true : updates.canConvene,
                  isChiefCommissioner: updates.isChiefCommissioner,
                  chiefCategories: normalizedChiefCats,
                  conflictIssuers: updates.conflictIssuers,
                }
              : m
          ),
          auditLogs: appendAudit(prev, {
            actorRole: 'admin',
            actorName: '系统管理员',
            actionType: 'CHIEF_STATUS_UPDATED',
            targetRef: target.employeeCode,
            summary: `维护「${target.name}」主任委员/召集人资格与利益回避名单`,
            details: `在岗：${updates.active ? '是' : '否'}；召集资格：${
              updates.canConvene || updates.isChiefCommissioner ? '具备' : '否'
            }；主任委员：${
              updates.isChiefCommissioner
                ? `是（${normalizedChiefCats.join('、') || '未指派领域'}）`
                : '否'
            }；关联回避发行人：${updates.conflictIssuers.join('、') || '无'}。`,
          }),
        };
      });
      pushToast('success', '委员资格配置已更新', `${name} 的主任委员及回避配置已同步生效。`);
    },
    [pushToast]
  );

  const resetDemoSandbox = useCallback(() => {
    const fresh = createInitialAppState();
    const withAudit: AppState = {
      ...fresh,
      auditLogs: [
        ...fresh.auditLogs,
        createAuditLogEntry(fresh.auditLogs, {
          actorRole: state.activeRole,
          actorName: '演练沙箱管理员',
          actionType: 'SYSTEM_RESET',
          targetRef: 'SANDBOX_RESET',
          summary: '重置本地沙箱至初始标准演示数据集',
          details: '已恢复 14 名委员档案、近 6 个月历史记录及当日待排/待确认评审会。',
        }),
      ],
    };
    setState(withAudit);
    pushToast('info', '本地演示数据已重置', '所有排期、集中度与审计链均已恢复初始标准场景。');
  }, [state.activeRole, pushToast]);

  return {
    state,
    toasts,
    dismissToast,
    setActiveRole,
    setActiveSecretaryId,
    setActiveMemberId,
    addMeeting,
    applyHalfDayOptimization,
    executeMatchForMeeting,
    manualRotateSeat,
    manualRotateFullPanel,
    simulateTimeoutForSeat,
    sendSeatReminder,
    updateMemberExpertise,
    toggleMemberSlotAvailability,
    setMemberDayAvailability,
    batchSetMemberAvailability,
    saveMemberSignature,
    clearMemberSignature,
    confirmSeatAttendance,
    declineSeatAndSubstitute,
    setSimulatedClock,
    saveMemberCalculation,
    submitMemberReviewVote,
    updateRuleConfig,
    resetRuleConfigToDefault,
    updateMemberGovernance,
    resetDemoSandbox,
  };
}
