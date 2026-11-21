import {
  CandidateEvaluation,
  CommitteeMember,
  ConcentrationStats,
  HalfDay,
  HistoricalReview,
  MAJOR_CATEGORIES,
  MajorCategory,
  MeetingSeat,
  REVIEW_TYPE_MAP,
  ReviewMeeting,
  RuleConfig,
  ScheduleOptimizationPreview,
  ScoreBreakdownItem,
  SlotIndex,
  makeSlotKey,
} from '../types/domain';

function parseDateMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

/**
 * Compute dynamic N-day (default 90-day) concentration metrics for every member
 * relative to the given reference date (e.g., meeting date or current system date).
 */
export function computeMemberConcentration(
  member: CommitteeMember,
  history: HistoricalReview[],
  meetings: ReviewMeeting[],
  referenceDate: string,
  config: RuleConfig
): ConcentrationStats {
  const refMs = parseDateMs(referenceDate);
  const windowMs = config.concentrationWindowDays * 24 * 60 * 60 * 1000;

  const convenerByMajor: Record<MajorCategory, number> = {
    城投: 0,
    工商金融: 0,
    结构: 0,
  };
  const participantByMajor: Record<MajorCategory, number> = {
    城投: 0,
    工商金融: 0,
    结构: 0,
  };

  // Count historical reviews within rolling window (<= referenceDate and >= referenceDate - windowDays)
  for (const h of history) {
    if (h.memberId !== member.id) continue;
    const hMs = parseDateMs(h.date);
    if (hMs <= refMs && refMs - hMs <= windowMs) {
      participantByMajor[h.majorCategory] += 1;
      if (h.seatRole === 'convener') {
        convenerByMajor[h.majorCategory] += 1;
      }
    }
  }

  // Also include confirmed / completed current-cycle meetings within window (not yet archived in history)
  for (const mt of meetings) {
    const mMs = parseDateMs(mt.date);
    if (mMs > refMs || refMs - mMs > windowMs) continue;
    const seat = mt.seats.find(
      (s) => s.memberId === member.id && s.status === 'confirmed'
    );
    if (!seat) continue;
    participantByMajor[mt.majorCategory] += 1;
    if (seat.seatRole === 'convener') {
      convenerByMajor[mt.majorCategory] += 1;
    }
  }

  const convenerTotal90d =
    convenerByMajor['城投'] + convenerByMajor['工商金融'] + convenerByMajor['结构'];
  const participantTotal90d =
    participantByMajor['城投'] +
    participantByMajor['工商金融'] +
    participantByMajor['结构'];

  const convenerRates: Record<MajorCategory, number> = {
    城投: convenerTotal90d > 0 ? convenerByMajor['城投'] / convenerTotal90d : 0,
    工商金融:
      convenerTotal90d > 0 ? convenerByMajor['工商金融'] / convenerTotal90d : 0,
    结构: convenerTotal90d > 0 ? convenerByMajor['结构'] / convenerTotal90d : 0,
  };

  const participantRates: Record<MajorCategory, number> = {
    城投:
      participantTotal90d > 0
        ? participantByMajor['城投'] / participantTotal90d
        : 0,
    工商金融:
      participantTotal90d > 0
        ? participantByMajor['工商金融'] / participantTotal90d
        : 0,
    结构:
      participantTotal90d > 0
        ? participantByMajor['结构'] / participantTotal90d
        : 0,
  };

  const isConvenerColdStart = convenerTotal90d < config.coldStartThreshold;

  const convenerOverCapMajors: MajorCategory[] = isConvenerColdStart
    ? []
    : MAJOR_CATEGORIES.filter(
        (cat) => convenerRates[cat] > config.convenerConcentrationCap
      );

  return {
    memberId: member.id,
    memberName: member.name,
    employeeCode: member.employeeCode,
    isChiefCommissioner: member.isChiefCommissioner,
    chiefCategories: member.chiefCategories,
    canConvene: member.canConvene,
    convenerTotal90d,
    convenerByMajor,
    convenerRates,
    convenerOverCapMajors,
    isConvenerColdStart,
    participantTotal90d,
    participantByMajor,
    participantRates,
  };
}

export function computeAllConcentrations(
  members: CommitteeMember[],
  history: HistoricalReview[],
  meetings: ReviewMeeting[],
  referenceDate: string,
  config: RuleConfig
): ConcentrationStats[] {
  return members.map((m) =>
    computeMemberConcentration(m, history, meetings, referenceDate, config)
  );
}

/**
 * Evaluate a single candidate for either 'convener' or 'member' role on a target meeting.
 */
export function evaluateCandidate(params: {
  member: CommitteeMember;
  meeting: ReviewMeeting;
  role: 'convener' | 'member';
  allMeetings: ReviewMeeting[];
  history: HistoricalReview[];
  config: RuleConfig;
  additionalExcludedIds?: Set<string>;
}): CandidateEvaluation {
  const {
    member,
    meeting,
    role,
    allMeetings,
    history,
    config,
    additionalExcludedIds,
  } = params;

  const exclusionReasons: string[] = [];
  const breakdown: ScoreBreakdownItem[] = [];

  const conc = computeMemberConcentration(
    member,
    history,
    allMeetings.filter((m) => m.id !== meeting.id),
    meeting.date,
    config
  );
  const majorRate = conc.convenerRates[meeting.majorCategory];
  const majorCount = conc.convenerByMajor[meeting.majorCategory];
  const isChiefForMajor =
    member.isChiefCommissioner &&
    member.chiefCategories.includes(meeting.majorCategory);

  // 1. Hard Filter: Active status
  if (!member.active) {
    exclusionReasons.push('委员当前处于非在岗/停用状态');
  }

  // 2. Hard Filter: Convener eligibility
  if (role === 'convener' && !member.canConvene) {
    exclusionReasons.push('未具备召集人任职资格');
  }

  // 3. Hard Filter: Conflict of Interest (Project explicit list + issuer match)
  if (meeting.conflictMemberIds.includes(member.id)) {
    exclusionReasons.push('列入本项目利益冲突回避名单');
  }
  const hasIssuerConflict = member.conflictIssuers.some(
    (ci) =>
      ci.trim() !== '' &&
      (meeting.issuer.includes(ci.trim()) || ci.trim().includes(meeting.issuer))
  );
  if (hasIssuerConflict) {
    exclusionReasons.push(`与发行人「${meeting.issuer}」存在关联利益冲突`);
  }

  // 4. Hard Filter: Rotation exclusions (declined / timed out / manually rotated out)
  if (
    meeting.excludedMemberIds.includes(member.id) ||
    additionalExcludedIds?.has(member.id)
  ) {
    exclusionReasons.push('本场已触发轮换/超时/回避限制（防重复入选）');
  }

  // 5. Hard Filter: Dynamic 90-day convener concentration cap (>60%, cold-start >=3)
  if (
    role === 'convener' &&
    !conc.isConvenerColdStart &&
    majorRate > config.convenerConcentrationCap
  ) {
    exclusionReasons.push(
      `近${config.concentrationWindowDays}天${meeting.majorCategory}召集集中度达 ${(
        majorRate * 100
      ).toFixed(1)}%（${majorCount}/${conc.convenerTotal90d}场），超过 ${(
        config.convenerConcentrationCap * 100
      ).toFixed(0)}% 上限，触发强制轮换`
    );
  }

  // 6. Hard Filter: Availability in target slot
  const targetSlotKey = makeSlotKey(
    meeting.date,
    meeting.halfDay,
    meeting.slotIndex
  );
  if (!member.availableSlotKeys.includes(targetSlotKey)) {
    exclusionReasons.push('该时段未申报可用时间');
  }

  // 7. Hard Filter: Overlapping meeting at exact same date + halfDay + slotIndex
  const overlappingMeeting = allMeetings.find(
    (other) =>
      other.id !== meeting.id &&
      other.date === meeting.date &&
      other.halfDay === meeting.halfDay &&
      other.slotIndex === meeting.slotIndex &&
      other.seats.some(
        (s) =>
          s.memberId === member.id &&
          (s.status === 'confirmed' || s.status === 'pending')
      )
  );
  if (overlappingMeeting) {
    exclusionReasons.push(
      `与同时段项目「${overlappingMeeting.code}」时间重叠`
    );
  }

  // Expertise rank lookup
  const expMatch = member.expertise.find(
    (e) => e.subCategory === meeting.subCategory
  );
  const expertiseRank = expMatch ? expMatch.rank : null;

  if (exclusionReasons.length > 0) {
    return {
      memberId: member.id,
      memberName: member.name,
      employeeCode: member.employeeCode,
      isChiefForMajor,
      eligible: false,
      exclusionReasons,
      totalScore: -99999,
      breakdown: [],
      concentrationRate: majorRate,
      convener90dTotal: conc.convenerTotal90d,
      convener90dMajorCount: majorCount,
      expertiseRank,
    };
  }

  // --- SCORING ENGINE ---

  // A. Expertise Rank Score (1st..5th: 100 / 70 / 45 / 25 / 10)
  if (expertiseRank !== null) {
    const pts = config.rankScores[expertiseRank - 1] ?? 0;
    breakdown.push({
      code: 'EXPERTISE_RANK',
      label: `专业第 ${expertiseRank} 顺位（${meeting.subCategory}）`,
      points: pts,
    });
  } else {
    // Check if member has any expertise in the same Major Category
    const sameMajorDeclared = member.expertise.some(
      (e) =>
        (e.subCategory.includes('城投') && meeting.majorCategory === '城投') ||
        ((e.subCategory === '能源与基础化工' ||
          e.subCategory === '制造与科技消费' ||
          e.subCategory === '银行与非银金融') &&
          meeting.majorCategory === '工商金融') ||
        ((e.subCategory === '信贷资产证券化ABS' ||
          e.subCategory === '企业资产支持专项计划' ||
          e.subCategory === 'REITs与不动产结构化') &&
          meeting.majorCategory === '结构')
    );
    breakdown.push({
      code: 'EXPERTISE_NONE',
      label: sameMajorDeclared
        ? `未申报该细分顺位（具备${meeting.majorCategory}同大类经验）`
        : '未申报该细分领域顺位',
      points: 0,
    });
  }

  // B. Priority Review Category (e.g. B2 重大变化 / C2 跟踪行动) Chief Commissioner Priority (+2000 if within 60% cap)
  const isPriorityReviewType = config.chiefPriorityReviewTypes.includes(
    meeting.reviewType
  );
  if (role === 'convener' && isPriorityReviewType && isChiefForMajor) {
    const rtMeta = REVIEW_TYPE_MAP[meeting.reviewType];
    breakdown.push({
      code: 'CHIEF_PRIORITY_REVIEW',
      label: `${rtMeta.fullLabel} · ${meeting.majorCategory}主任委员优先`,
      points: config.chiefPriorityBonus,
      note: conc.isConvenerColdStart
        ? `近90天召集${conc.convenerTotal90d}场（冷启动豁免）`
        : `近90天集中度 ${(majorRate * 100).toFixed(1)}% ≤ ${(
            config.convenerConcentrationCap * 100
          ).toFixed(0)}%`,
    });
  }

  // C. Half-day continuity, anti-backtracking, and cross-category penalties
  const sameHalfDayAssigned = allMeetings.filter(
    (other) =>
      other.id !== meeting.id &&
      other.date === meeting.date &&
      other.halfDay === meeting.halfDay &&
      other.seats.some(
        (s) =>
          s.memberId === member.id &&
          (s.status === 'confirmed' || s.status === 'pending')
      )
  );

  if (sameHalfDayAssigned.length > 0) {
    // 1. Same half-day same sub-category bonus (+1000)
    const hasSameSub = sameHalfDayAssigned.some(
      (m) => m.subCategory === meeting.subCategory
    );
    if (hasSameSub) {
      breakdown.push({
        code: 'SAME_HALFDAY_SUB',
        label: `同半天同细分连续参评（${meeting.subCategory}）`,
        points: config.sameHalfDaySameSubBonus,
      });
    }

    // 2. Cross-major penalty (-1200) when confirmed (or scheduled) other major category in same half-day
    const confirmedOtherMajor = sameHalfDayAssigned.find(
      (m) =>
        m.majorCategory !== meeting.majorCategory &&
        m.seats.some(
          (s) =>
            s.memberId === member.id &&
            (s.status === 'confirmed' || s.status === 'pending')
        )
    );
    if (confirmedOtherMajor) {
      breakdown.push({
        code: 'CROSS_MAJOR_PENALTY',
        label: `同半天已有${confirmedOtherMajor.majorCategory}项目，跨大类降权`,
        points: config.crossMajorPenalty,
        note: `关联场次 ${confirmedOtherMajor.code}`,
      });
    } else if (!hasSameSub) {
      // Same major category, different sub-category (-200)
      const sameMajorDiffSub = sameHalfDayAssigned.find(
        (m) =>
          m.majorCategory === meeting.majorCategory &&
          m.subCategory !== meeting.subCategory
      );
      if (sameMajorDiffSub) {
        breakdown.push({
          code: 'SAME_MAJOR_CROSS_SUB',
          label: `同半天同大类跨细分（${sameMajorDiffSub.subCategory} → ${meeting.subCategory}）`,
          points: config.sameMajorCrossSubPenalty,
        });
      }
    }

    // 3. Adjacent slot bonus (+300) vs Backtracking gap penalty (-1500)
    const occupiedSlots = sameHalfDayAssigned.map((m) => m.slotIndex);
    const minDistance = Math.min(
      ...occupiedSlots.map((slot) => Math.abs(slot - meeting.slotIndex))
    );

    if (minDistance === 1) {
      breakdown.push({
        code: 'ADJACENT_SLOT',
        label: '紧邻时段无缝衔接（防折返）',
        points: config.adjacentSlotBonus,
      });
    } else if (minDistance >= 2) {
      breakdown.push({
        code: 'BACKTRACK_GAP',
        label: `同半天出现折返空档（间隔 ${minDistance - 1} 个时段）`,
        points: config.backtrackGapPenalty,
      });
    }
  }

  const totalScore = breakdown.reduce((sum, item) => sum + item.points, 0);

  return {
    memberId: member.id,
    memberName: member.name,
    employeeCode: member.employeeCode,
    isChiefForMajor,
    eligible: true,
    exclusionReasons: [],
    totalScore,
    breakdown,
    concentrationRate: majorRate,
    convener90dTotal: conc.convenerTotal90d,
    convener90dMajorCount: majorCount,
    expertiseRank,
  };
}

function compareCandidatesDeterministic(
  a: CandidateEvaluation,
  b: CandidateEvaluation
): number {
  // Higher total score first
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  // Lower 90d concentration rate tie-breaker for fairness
  if (Math.abs(a.concentrationRate - b.concentrationRate) > 0.0001) {
    return a.concentrationRate - b.concentrationRate;
  }
  // Better expertise rank (lower rank number = higher priority)
  const rankA = a.expertiseRank ?? 99;
  const rankB = b.expertiseRank ?? 99;
  if (rankA !== rankB) return rankA - rankB;
  // Deterministic employeeCode tie-breaker
  return a.employeeCode.localeCompare(b.employeeCode);
}

export interface MatchExecutionResult {
  seats: MeetingSeat[];
  convenerBackupQueue: CandidateEvaluation[];
  memberBackupQueue: CandidateEvaluation[];
  filteredOutCandidates: CandidateEvaluation[];
  shortageWarning?: string;
}

/**
 * Deterministic Matching Engine: selects 1 Convener + 5 Members (or config counts)
 * and builds deterministic backup queues for both roles.
 */
export function runDeterministicMatch(params: {
  meeting: ReviewMeeting;
  members: CommitteeMember[];
  allMeetings: ReviewMeeting[];
  history: HistoricalReview[];
  config: RuleConfig;
  nowIso?: string;
}): MatchExecutionResult {
  const { meeting, members, allMeetings, history, config } = params;
  const now = params.nowIso ? new Date(params.nowIso) : new Date();
  const assignedAt = now.toISOString();
  const deadlineAt = new Date(
    now.getTime() + config.responseTimeoutMinutes * 60 * 1000
  ).toISOString();

  // Step 1: Evaluate all members for Convener role
  const convenerEvals = members.map((m) =>
    evaluateCandidate({
      member: m,
      meeting,
      role: 'convener',
      allMeetings,
      history,
      config,
    })
  );

  const eligibleConveners = convenerEvals
    .filter((e) => e.eligible)
    .sort(compareCandidatesDeterministic);

  const selectedConvener = eligibleConveners[0] ?? null;
  const convenerBackupQueue = eligibleConveners.slice(1);

  const selectedIds = new Set<string>();
  if (selectedConvener) {
    selectedIds.add(selectedConvener.memberId);
  }

  // Step 2: Evaluate remaining members for the 5 Committee Member seats
  const memberEvals = members
    .filter((m) => !selectedIds.has(m.id))
    .map((m) =>
      evaluateCandidate({
        member: m,
        meeting,
        role: 'member',
        allMeetings,
        history,
        config,
      })
    );

  const eligibleMembers = memberEvals
    .filter((e) => e.eligible)
    .sort(compareCandidatesDeterministic);

  const selectedMembers = eligibleMembers.slice(0, config.memberCount);
  const memberBackupQueue = eligibleMembers.slice(config.memberCount);

  // Collect hard-filtered explanation records (merge convener & member exclusions uniquely)
  const filteredMap = new Map<string, CandidateEvaluation>();
  for (const ev of convenerEvals) {
    if (!ev.eligible) {
      // Check if eligible as regular member
      const asMember = memberEvals.find((me) => me.memberId === ev.memberId);
      if (!asMember || !asMember.eligible) {
        filteredMap.set(ev.memberId, {
          ...ev,
          exclusionReasons: Array.from(
            new Set([
              ...ev.exclusionReasons,
              ...(asMember?.exclusionReasons ?? []),
            ])
          ),
        });
      } else {
        // Excluded only as convener (e.g. >60% concentration or not convener), keep note if concentration cap triggered
        const hasCapReason = ev.exclusionReasons.some((r) =>
          r.includes('强制轮换')
        );
        if (hasCapReason) {
          filteredMap.set(ev.memberId, {
            ...ev,
            exclusionReasons: ev.exclusionReasons.filter((r) =>
              r.includes('强制轮换')
            ),
          });
        }
      }
    }
  }

  const seats: MeetingSeat[] = [];

  if (selectedConvener) {
    seats.push({
      seatId: `${meeting.id}-convener`,
      blindCode: 'ENC-C1',
      seatRole: 'convener',
      seatLabel: '召集人',
      memberId: selectedConvener.memberId,
      memberName: selectedConvener.memberName,
      employeeCode: selectedConvener.employeeCode,
      isChiefForMajor: selectedConvener.isChiefForMajor,
      totalScore: selectedConvener.totalScore,
      breakdown: selectedConvener.breakdown,
      status: 'pending',
      assignedAt,
      deadlineAt,
      reminderCount: 0,
    });
  }

  selectedMembers.forEach((ev, idx) => {
    seats.push({
      seatId: `${meeting.id}-member-${idx + 1}`,
      blindCode: `ENC-M${idx + 1}`,
      seatRole: 'member',
      seatLabel: `评审委员 ${idx + 1}`,
      memberId: ev.memberId,
      memberName: ev.memberName,
      employeeCode: ev.employeeCode,
      isChiefForMajor: ev.isChiefForMajor,
      totalScore: ev.totalScore,
      breakdown: ev.breakdown,
      status: 'pending',
      assignedAt,
      deadlineAt,
      reminderCount: 0,
    });
  });

  const requiredTotal = config.convenerCount + config.memberCount;
  const shortageWarning =
    seats.length < requiredTotal
      ? `受时段可用性、利益冲突或60%集中度上限约束，当前仅匹配到 ${seats.length}/${requiredTotal} 个席位，请协调委员开放时段或调整排期。`
      : undefined;

  return {
    seats,
    convenerBackupQueue,
    memberBackupQueue,
    filteredOutCandidates: Array.from(filteredMap.values()),
    shortageWarning,
  };
}

/**
 * Substitute a single seat using the deterministic backup queue (for 30-min timeout,
 * member decline, or secretary single-seat manual rotation).
 */
export function substituteSeatFromBackup(params: {
  meeting: ReviewMeeting;
  seatId: string;
  reasonType: 'timeout' | 'decline' | 'manual';
  declineReason?: string;
  members: CommitteeMember[];
  allMeetings: ReviewMeeting[];
  history: HistoricalReview[];
  config: RuleConfig;
  nowIso?: string;
}): {
  updatedMeeting: ReviewMeeting;
  replacedOutName: string;
  replacedInName: string | null;
} {
  const {
    meeting,
    seatId,
    reasonType,
    declineReason,
    members,
    allMeetings,
    history,
    config,
  } = params;
  const targetSeat = meeting.seats.find((s) => s.seatId === seatId);
  if (!targetSeat) {
    return { updatedMeeting: meeting, replacedOutName: '', replacedInName: null };
  }
  // Compliance invariant: Secretary has zero manual rotation authority over confirmed seats
  if (reasonType === 'manual' && targetSeat.status === 'confirmed') {
    return { updatedMeeting: meeting, replacedOutName: '', replacedInName: null };
  }

  const now = params.nowIso ? new Date(params.nowIso) : new Date();
  const assignedAt = now.toISOString();
  const deadlineAt = new Date(
    now.getTime() + config.responseTimeoutMinutes * 60 * 1000
  ).toISOString();

  const updatedExcluded = Array.from(
    new Set([...meeting.excludedMemberIds, targetSeat.memberId])
  );
  const currentActiveMemberIds = new Set(
    meeting.seats
      .filter((s) => s.seatId !== seatId)
      .map((s) => s.memberId)
  );

  // Re-evaluate backup queue dynamically against current exclusions & seats
  const candidatePool = members
    .filter((m) => !currentActiveMemberIds.has(m.id))
    .map((m) =>
      evaluateCandidate({
        member: m,
        meeting: { ...meeting, excludedMemberIds: updatedExcluded },
        role: targetSeat.seatRole,
        allMeetings,
        history,
        config,
      })
    )
    .filter((ev) => ev.eligible)
    .sort(compareCandidatesDeterministic);

  const nextCandidate = candidatePool[0] ?? null;

  const newSeats = meeting.seats.map((seat) => {
    if (seat.seatId !== seatId) return seat;
    if (!nextCandidate) {
      return {
        ...seat,
        status:
          reasonType === 'timeout'
            ? ('timed_out' as const)
            : ('declined' as const),
        respondedAt: assignedAt,
        declineReason:
          declineReason ||
          (reasonType === 'timeout' ? '30分钟响应超时（暂无可递补人选）' : '无可用备用递补'),
      };
    }

    const prevBaseCode = (seat.blindCode || 'ENC-S').replace(/-R\d+$/, '');
    const prevRotMatch = (seat.blindCode || '').match(/-R(\d+)$/);
    const nextRotIndex = prevRotMatch ? Number(prevRotMatch[1]) + 1 : 1;
    const nextBlindCode = `${prevBaseCode}-R${nextRotIndex}`;
    const prevDisplayRef =
      targetSeat.status === 'confirmed' && targetSeat.conflictDeclaration
        ? targetSeat.memberName
        : `加密席位 ${targetSeat.blindCode}`;

    return {
      ...seat,
      blindCode: nextBlindCode,
      memberId: nextCandidate.memberId,
      memberName: nextCandidate.memberName,
      employeeCode: nextCandidate.employeeCode,
      isChiefForMajor: nextCandidate.isChiefForMajor,
      totalScore: nextCandidate.totalScore,
      breakdown: nextCandidate.breakdown,
      status: 'pending' as const,
      assignedAt,
      deadlineAt,
      respondedAt: undefined,
      declineReason: undefined,
      conflictDeclaration: undefined,
      reminderCount: 0,
      lastRemindedAt: undefined,
      substitutedFrom: `${prevDisplayRef}（${
        reasonType === 'timeout'
          ? '30分钟超时自动递补'
          : reasonType === 'decline'
          ? '委员申请回避递补'
          : '秘书手动轮换递补'
      }）`,
    };
  });

  // Rebuild both backup queues for transparency
  const nextActiveIds = new Set(newSeats.map((s) => s.memberId));
  const updatedMeetingDraft: ReviewMeeting = {
    ...meeting,
    seats: newSeats,
    excludedMemberIds: updatedExcluded,
    manualRotationCount:
      reasonType === 'manual'
        ? meeting.manualRotationCount + 1
        : meeting.manualRotationCount,
  };

  const convenerBackupQueue = members
    .filter((m) => !nextActiveIds.has(m.id))
    .map((m) =>
      evaluateCandidate({
        member: m,
        meeting: updatedMeetingDraft,
        role: 'convener',
        allMeetings,
        history,
        config,
      })
    )
    .filter((e) => e.eligible)
    .sort(compareCandidatesDeterministic);

  const memberBackupQueue = members
    .filter((m) => !nextActiveIds.has(m.id))
    .map((m) =>
      evaluateCandidate({
        member: m,
        meeting: updatedMeetingDraft,
        role: 'member',
        allMeetings,
        history,
        config,
      })
    )
    .filter((e) => e.eligible)
    .sort(compareCandidatesDeterministic);

  return {
    updatedMeeting: {
      ...updatedMeetingDraft,
      convenerBackupQueue,
      memberBackupQueue,
    },
    replacedOutName: targetSeat.memberName,
    replacedInName: nextCandidate ? nextCandidate.memberName : null,
  };
}

/**
 * Rotate ONLY unconfirmed (pending) seats for a meeting while strictly preserving
 * every confirmed seat untouched (Secretary cannot manually rotate confirmed seats).
 */
export function rotatePendingSeatsOnly(params: {
  meeting: ReviewMeeting;
  members: CommitteeMember[];
  allMeetings: ReviewMeeting[];
  history: HistoricalReview[];
  config: RuleConfig;
  nowIso?: string;
}): {
  updatedMeeting: ReviewMeeting;
  rotatedOutNames: string[];
  rotatedInNames: string[];
} {
  const { meeting, members, allMeetings, history, config } = params;
  const pendingSeats = meeting.seats.filter((s) => s.status === 'pending');
  if (pendingSeats.length === 0) {
    return {
      updatedMeeting: meeting,
      rotatedOutNames: [],
      rotatedInNames: [],
    };
  }

  const now = params.nowIso ? new Date(params.nowIso) : new Date();
  const assignedAt = now.toISOString();
  const deadlineAt = new Date(
    now.getTime() + config.responseTimeoutMinutes * 60 * 1000
  ).toISOString();

  const rotatedOutNames = pendingSeats.map((s) => s.memberName);
  const rotatedInNames: string[] = [];

  const updatedExcluded = Array.from(
    new Set([
      ...meeting.excludedMemberIds,
      ...pendingSeats.map((s) => s.memberId),
    ])
  );

  // Confirmed (and any non-pending) seats remain strictly locked and cannot be reassigned
  const lockedMemberIds = new Set(
    meeting.seats
      .filter((s) => s.status !== 'pending')
      .map((s) => s.memberId)
  );

  const usedNewMemberIds = new Set<string>(lockedMemberIds);
  const draftMeetingForEval: ReviewMeeting = {
    ...meeting,
    excludedMemberIds: updatedExcluded,
  };

  // Evaluate fresh pools once for pending convener (if any) and pending members
  const newSeats = meeting.seats.map((seat) => {
    if (seat.status !== 'pending') {
      // Confirmed seat strictly preserved untouched
      return seat;
    }

    const candidates = members
      .filter((m) => !usedNewMemberIds.has(m.id))
      .map((m) =>
        evaluateCandidate({
          member: m,
          meeting: draftMeetingForEval,
          role: seat.seatRole,
          allMeetings,
          history,
          config,
        })
      )
      .filter((ev) => ev.eligible)
      .sort(compareCandidatesDeterministic);

    const nextCandidate = candidates[0] ?? null;
    if (!nextCandidate) {
      return {
        ...seat,
        status: 'declined' as const,
        respondedAt: assignedAt,
        declineReason: '待确认席位盲态轮换后暂无可用备用递补人选',
      };
    }

    usedNewMemberIds.add(nextCandidate.memberId);
    rotatedInNames.push(nextCandidate.memberName);

    const prevBaseCode = (seat.blindCode || 'ENC-S').replace(/-R\d+$/, '');
    const prevRotMatch = (seat.blindCode || '').match(/-R(\d+)$/);
    const nextRotIndex = prevRotMatch ? Number(prevRotMatch[1]) + 1 : 1;
    const nextBlindCode = `${prevBaseCode}-R${nextRotIndex}`;

    return {
      ...seat,
      blindCode: nextBlindCode,
      memberId: nextCandidate.memberId,
      memberName: nextCandidate.memberName,
      employeeCode: nextCandidate.employeeCode,
      isChiefForMajor: nextCandidate.isChiefForMajor,
      totalScore: nextCandidate.totalScore,
      breakdown: nextCandidate.breakdown,
      status: 'pending' as const,
      assignedAt,
      deadlineAt,
      respondedAt: undefined,
      declineReason: undefined,
      conflictDeclaration: undefined,
      reminderCount: 0,
      lastRemindedAt: undefined,
      substitutedFrom: `加密席位 ${seat.blindCode}（秘书批量轮换待确认席位）`,
    };
  });

  const nextActiveIds = new Set(newSeats.map((s) => s.memberId));
  const updatedMeetingDraft: ReviewMeeting = {
    ...meeting,
    status: 'matched',
    seats: newSeats,
    excludedMemberIds: updatedExcluded,
    manualRotationCount: meeting.manualRotationCount + 1,
    lastMatchedAt: assignedAt,
  };

  const convenerBackupQueue = members
    .filter((m) => !nextActiveIds.has(m.id))
    .map((m) =>
      evaluateCandidate({
        member: m,
        meeting: updatedMeetingDraft,
        role: 'convener',
        allMeetings,
        history,
        config,
      })
    )
    .filter((e) => e.eligible)
    .sort(compareCandidatesDeterministic);

  const memberBackupQueue = members
    .filter((m) => !nextActiveIds.has(m.id))
    .map((m) =>
      evaluateCandidate({
        member: m,
        meeting: updatedMeetingDraft,
        role: 'member',
        allMeetings,
        history,
        config,
      })
    )
    .filter((e) => e.eligible)
    .sort(compareCandidatesDeterministic);

  return {
    updatedMeeting: {
      ...updatedMeetingDraft,
      convenerBackupQueue,
      memberBackupQueue,
    },
    rotatedOutNames,
    rotatedInNames,
  };
}

/**
 * Half-day Anti-Backtracking Schedule Optimizer:
 * 1. Identifies meetings with conflict constraints / special avoidance lists (edge candidates)
 *    and moves them to the first or last slot of the half-day so they don't break continuity
 *    for mainstream committee members.
 * 2. Clusters remaining meetings tightly by MajorCategory -> SubCategory so members can attend
 *    consecutive same-sub-category reviews (+1000 / +300) without backtracking gaps (-1500).
 */
export function computeHalfDayOptimization(
  meetings: ReviewMeeting[],
  date: string,
  halfDay: HalfDay
): ScheduleOptimizationPreview {
  const targetMeetings = meetings
    .filter((m) => m.date === date && m.halfDay === halfDay)
    .sort((a, b) => a.slotIndex - b.slotIndex);

  if (targetMeetings.length <= 1) {
    return {
      date,
      halfDay,
      originalOrder: targetMeetings,
      optimizedOrder: targetMeetings,
      slotAssignments: [],
      clusterSummary: '当前半天仅安排 1 场或无项目，无需重排。',
      edgeMovedCount: 0,
      estimatedConflictReduction: 0,
      changed: false,
    };
  }

  // Partition into conflict-heavy edge projects vs standard cluster projects
  const conflictProjects = targetMeetings.filter(
    (m) => m.conflictMemberIds.length > 0 || Boolean(m.conflictNote)
  );
  const normalProjects = targetMeetings.filter(
    (m) => m.conflictMemberIds.length === 0 && !m.conflictNote
  );

  // Count major category frequencies among normal projects so the largest cluster stays contiguous
  const majorCounts: Record<string, number> = {};
  for (const m of normalProjects) {
    majorCounts[m.majorCategory] = (majorCounts[m.majorCategory] || 0) + 1;
  }

  const sortedNormal = [...normalProjects].sort((a, b) => {
    const countDiff =
      (majorCounts[b.majorCategory] || 0) - (majorCounts[a.majorCategory] || 0);
    if (countDiff !== 0) return countDiff;
    if (a.majorCategory !== b.majorCategory) {
      return a.majorCategory.localeCompare(b.majorCategory);
    }
    if (a.subCategory !== b.subCategory) {
      return a.subCategory.localeCompare(b.subCategory);
    }
    return a.code.localeCompare(b.code);
  });

  // Place conflict projects on edges: 1st conflict -> trailing edge (end), 2nd conflict -> leading edge (start)
  // while trying to keep edge project adjacent to its own major category if possible
  let optimized: ReviewMeeting[] = [];
  if (conflictProjects.length === 0) {
    optimized = sortedNormal;
  } else if (conflictProjects.length === 1) {
    const cp = conflictProjects[0];
    // Put at start if first normal shares major category, else at end
    if (
      sortedNormal.length > 0 &&
      sortedNormal[0].majorCategory === cp.majorCategory &&
      sortedNormal[sortedNormal.length - 1].majorCategory !== cp.majorCategory
    ) {
      optimized = [cp, ...sortedNormal];
    } else {
      optimized = [...sortedNormal, cp];
    }
  } else {
    // Multiple conflict projects: split between leading and trailing edges
    const leading: ReviewMeeting[] = [];
    const trailing: ReviewMeeting[] = [];
    conflictProjects.forEach((cp, idx) => {
      if (idx % 2 === 0) trailing.push(cp);
      else leading.push(cp);
    });
    optimized = [...leading, ...sortedNormal, ...trailing];
  }

  const availableSlots = targetMeetings
    .map((m) => m.slotIndex)
    .sort((a, b) => a - b);

  const slotAssignments = optimized.map((m, idx) => {
    const newSlot = availableSlots[idx] as SlotIndex;
    const isConflict =
      m.conflictMemberIds.length > 0 || Boolean(m.conflictNote);
    const isEdge = idx === 0 || idx === optimized.length - 1;
    let reason = `按「${m.majorCategory} · ${m.subCategory}」同类聚类连续排布`;
    if (isConflict && isEdge) {
      reason = '含利益冲突回避约束，置入半天首尾边缘防打断主评连场';
    } else if (m.slotIndex === newSlot) {
      reason = '已处于同类聚类最优连续时段';
    }
    return {
      meetingId: m.id,
      oldSlot: m.slotIndex,
      newSlot,
      reason,
    };
  });

  const changed = slotAssignments.some((a) => a.oldSlot !== a.newSlot);

  // Measure category transitions before vs after
  const countTransitions = (list: ReviewMeeting[]) => {
    let t = 0;
    for (let i = 1; i < list.length; i++) {
      if (list[i].majorCategory !== list[i - 1].majorCategory) t += 2;
      else if (list[i].subCategory !== list[i - 1].subCategory) t += 1;
    }
    return t;
  };
  const beforeTrans = countTransitions(targetMeetings);
  const afterTrans = countTransitions(optimized);
  const edgeMovedCount = slotAssignments.filter((a) => {
    const m = targetMeetings.find((x) => x.id === a.meetingId);
    return (
      m &&
      (m.conflictMemberIds.length > 0 || Boolean(m.conflictNote)) &&
      a.oldSlot !== a.newSlot
    );
  }).length;

  const optimizedWithSlots = optimized.map((m, idx) => ({
    ...m,
    slotIndex: availableSlots[idx] as SlotIndex,
  }));

  const clusterGroups = Array.from(
    new Set(optimizedWithSlots.map((m) => m.majorCategory))
  ).join(' → ');

  return {
    date,
    halfDay,
    originalOrder: targetMeetings,
    optimizedOrder: optimizedWithSlots,
    slotAssignments,
    clusterSummary: `优化后聚类序列：${clusterGroups}（跨类切换成本由 ${beforeTrans} 降至 ${afterTrans}）`,
    edgeMovedCount,
    estimatedConflictReduction: Math.max(0, beforeTrans - afterTrans),
    changed,
  };
}
