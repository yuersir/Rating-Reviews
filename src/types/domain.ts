export type RoleType = 'secretary' | 'member' | 'admin';

export type MajorCategory = '城投' | '工商金融' | '结构';

export type SubCategory =
  | '省级及高信用城投'
  | '地市级城投'
  | '区县及园区城投'
  | '能源与基础化工'
  | '制造与科技消费'
  | '银行与非银金融'
  | '信贷资产证券化ABS'
  | '企业资产支持专项计划'
  | 'REITs与不动产结构化';

export interface SubCategoryMeta {
  id: SubCategory;
  major: MajorCategory;
  shortLabel: string;
}

export const MAJOR_CATEGORIES: MajorCategory[] = ['城投', '工商金融', '结构'];

export const SUB_CATEGORIES: SubCategoryMeta[] = [
  { id: '省级及高信用城投', major: '城投', shortLabel: '省级城投' },
  { id: '地市级城投', major: '城投', shortLabel: '地市城投' },
  { id: '区县及园区城投', major: '城投', shortLabel: '区县园区' },
  { id: '能源与基础化工', major: '工商金融', shortLabel: '能源化工' },
  { id: '制造与科技消费', major: '工商金融', shortLabel: '制造消费' },
  { id: '银行与非银金融', major: '工商金融', shortLabel: '银行非银' },
  { id: '信贷资产证券化ABS', major: '结构', shortLabel: '信贷ABS' },
  { id: '企业资产支持专项计划', major: '结构', shortLabel: '企业ABN/ABS' },
  { id: 'REITs与不动产结构化', major: '结构', shortLabel: 'REITs不动产' },
];

export const SUB_TO_MAJOR: Record<SubCategory, MajorCategory> = SUB_CATEGORIES.reduce(
  (acc, item) => {
    acc[item.id] = item.major;
    return acc;
  },
  {} as Record<SubCategory, MajorCategory>
);

export type ReviewTypeGroup = 'A' | 'B' | 'C';

export type ReviewTypeCode = 'A' | 'B1' | 'B2' | 'C1' | 'C2';

export interface ReviewTypeMeta {
  code: ReviewTypeCode;
  group: ReviewTypeGroup;
  groupLabel: string;
  subLabel: string;
  fullLabel: string;
  description: string;
}

export const REVIEW_TYPES: ReviewTypeMeta[] = [
  {
    code: 'A',
    group: 'A',
    groupLabel: 'A类 · 初评',
    subLabel: '首次评级',
    fullLabel: 'A类（初评）',
    description: '新发行主体或新设金融产品首次信用评级评审',
  },
  {
    code: 'B1',
    group: 'B',
    groupLabel: 'B类 · 连续评级',
    subLabel: 'B1 常规',
    fullLabel: 'B1（连续评级 · 常规）',
    description: '主体经营及信用基本面稳定下的常规续发或定期连续评级',
  },
  {
    code: 'B2',
    group: 'B',
    groupLabel: 'B类 · 连续评级',
    subLabel: 'B2 重大变化',
    fullLabel: 'B2（连续评级 · 重大变化）',
    description: '涉及重大资产重组、实控人变更或核心财务指标显著异动的连续评级',
  },
  {
    code: 'C1',
    group: 'C',
    groupLabel: 'C类 · 跟踪',
    subLabel: 'C1 关注',
    fullLabel: 'C1（跟踪 · 关注）',
    description: '日常或专项信用事件跟踪关注类复核评审',
  },
  {
    code: 'C2',
    group: 'C',
    groupLabel: 'C类 · 跟踪',
    subLabel: 'C2 行动',
    fullLabel: 'C2（跟踪 · 行动）',
    description: '重大信用触发事件进入专项跟踪行动议程的评审',
  },
];

export const REVIEW_TYPE_MAP: Record<ReviewTypeCode, ReviewTypeMeta> =
  REVIEW_TYPES.reduce((acc, item) => {
    acc[item.code] = item;
    return acc;
  }, {} as Record<ReviewTypeCode, ReviewTypeMeta>);

export type HalfDay = 'AM' | 'PM';

export type SlotIndex = 1 | 2 | 3 | 4;

export interface SlotDefinition {
  halfDay: HalfDay;
  slotIndex: SlotIndex;
  timeRange: string;
  label: string;
}

export const HALF_DAY_SLOTS: Record<HalfDay, SlotDefinition[]> = {
  AM: [
    { halfDay: 'AM', slotIndex: 1, timeRange: '09:00-09:50', label: '上午第1场 (09:00)' },
    { halfDay: 'AM', slotIndex: 2, timeRange: '10:00-10:50', label: '上午第2场 (10:00)' },
    { halfDay: 'AM', slotIndex: 3, timeRange: '11:00-11:50', label: '上午第3场 (11:00)' },
    { halfDay: 'AM', slotIndex: 4, timeRange: '11:55-12:35', label: '上午第4场 (11:55)' },
  ],
  PM: [
    { halfDay: 'PM', slotIndex: 1, timeRange: '13:30-14:20', label: '下午第1场 (13:30)' },
    { halfDay: 'PM', slotIndex: 2, timeRange: '14:30-15:20', label: '下午第2场 (14:30)' },
    { halfDay: 'PM', slotIndex: 3, timeRange: '15:30-16:20', label: '下午第3场 (15:30)' },
    { halfDay: 'PM', slotIndex: 4, timeRange: '16:30-17:20', label: '下午第4场 (16:30)' },
  ],
};

export function makeSlotKey(date: string, halfDay: HalfDay, slotIndex: SlotIndex): string {
  return `${date}_${halfDay}_${slotIndex}`;
}

export interface ExpertiseRank {
  rank: 1 | 2 | 3 | 4 | 5;
  subCategory: SubCategory;
}

export interface SavedMemberSignature {
  method: 'handwritten' | 'typed_seal';
  signatureDataUrl?: string;
  typedSealText?: string;
  autoApply: boolean;
  updatedAt: string;
}

export interface SecretaryProfile {
  id: string;
  employeeCode: string;
  name: string;
  title: string;
  scope: string;
  credentialCode: string;
}

export interface CommitteeMember {
  id: string;
  employeeCode: string;
  credentialCode: string;
  name: string;
  title: string;
  department: string;
  active: boolean;
  canConvene: boolean;
  isChiefCommissioner: boolean;
  chiefCategories: MajorCategory[];
  expertise: ExpertiseRank[]; // 3 to 5 items
  conflictIssuers: string[];
  availableSlotKeys: string[]; // e.g., "2026-11-20_AM_1"
  savedSignature?: SavedMemberSignature;
}

export interface ScoreBreakdownItem {
  code: string;
  label: string;
  points: number;
  note?: string;
}

export interface CandidateEvaluation {
  memberId: string;
  memberName: string;
  employeeCode: string;
  isChiefForMajor: boolean;
  eligible: boolean;
  exclusionReasons: string[];
  totalScore: number;
  breakdown: ScoreBreakdownItem[];
  concentrationRate: number; // 0..1 for this meeting's major category (as convener)
  convener90dTotal: number;
  convener90dMajorCount: number;
  expertiseRank: number | null;
}

export type SeatRole = 'convener' | 'member';

export type SeatResponseStatus = 'pending' | 'confirmed' | 'declined' | 'timed_out';

export interface ConflictDeclarationRecord {
  declarationId: string;
  signerMemberId: string;
  signerName: string;
  signerEmployeeCode: string;
  meetingCode: string;
  projectName: string;
  issuer: string;
  seatLabel: string;
  signingMethod: 'handwritten' | 'typed_seal';
  signatureDataUrl?: string; // PNG data URL from canvas when handwritten
  typedSealText?: string; // Confirmed full name when typed_seal
  clausesAccepted: string[];
  signedAt: string;
  declarationHash: string;
}

export type RatingGrade =
  | 'AAA'
  | 'AA+'
  | 'AA'
  | 'AA-'
  | 'A+'
  | 'A'
  | 'BBB+'
  | 'BBB';

export type RatingOutlook = '稳定' | '正面' | '负面' | '列入信用评级观察名单';

export interface FinancialMetricRow {
  indicator: string;
  unit: string;
  y2024: string;
  y2025: string;
  y2026Q3: string;
  trendNote: string;
}

export interface WorkingPaperItem {
  id: string;
  code: string;
  title: string;
  category: '尽职调查' | '财务核查' | '债务与现金流' | '法律与合规' | '资产池与结构';
  preparedBy: string;
  reviewedBy: string;
  verifiedDate: string;
  status: '已复核通过' | '重点关注提示';
  summary: string;
  keyFindings: string[];
  rawExcerpt: string;
}

export interface ModelFactorItem {
  id: string;
  dimension: string;
  factorName: string;
  weight: number; // percentage, sum = 100
  rawMetric: string;
  analystScore: number; // 0..100
  basisNote: string;
}

export interface ModelNotchItem {
  id: string;
  label: string;
  delta: number; // e.g. +1, -1, 0
  rationale: string;
}

export interface ProjectMaterials {
  meetingId: string;
  reportCode: string;
  reportVersion: string;
  generatedAt: string;
  analysts: string[];
  methodologyName: string;
  issuanceScale: string;
  tenor: string;
  proposedRating: RatingGrade;
  proposedOutlook: RatingOutlook;
  executiveSummary: string;
  creditStrengths: string[];
  creditConcerns: string[];
  financialMetrics: FinancialMetricRow[];
  workingPapers: WorkingPaperItem[];
  modelName: string;
  modelVersion: string;
  modelFactors: ModelFactorItem[];
  modelNotchItems: ModelNotchItem[];
  analystBaseScore: number;
  analystBaseRating: RatingGrade;
  analystFinalRating: RatingGrade;
}

export interface MemberCalculationSnapshot {
  scenarioLabel: string;
  factorScores: Record<string, number>;
  notchDelta: number;
  computedScore: number;
  baseRating: RatingGrade;
  finalRating: RatingGrade;
  memo: string;
  savedAt: string;
}

export interface MemberReviewSubmission {
  submissionId: string;
  voteResult: VoteResult;
  proposedRating: RatingGrade;
  proposedOutlook: RatingOutlook;
  opinionText: string;
  conditionsText?: string;
  referencedCalcScore?: number;
  referencedCalcRating?: RatingGrade;
  submittedAt: string;
  updatedAt: string;
  revisionCount: number;
  submissionHash: string;
}

export interface MeetingSeat {
  seatId: string;
  blindCode: string; // e.g., "ENC-C1", "ENC-M3" shown to Secretary before e-signature
  seatRole: SeatRole;
  seatLabel: string; // e.g., "召集人", "委员 1".."委员 5"
  memberId: string;
  memberName: string;
  employeeCode: string;
  isChiefForMajor: boolean;
  totalScore: number;
  breakdown: ScoreBreakdownItem[];
  status: SeatResponseStatus;
  assignedAt: string;
  deadlineAt: string; // ISO string, 30 min after assignedAt
  respondedAt?: string;
  declineReason?: string;
  substitutedFrom?: string;
  conflictDeclaration?: ConflictDeclarationRecord;
  reminderCount?: number;
  lastRemindedAt?: string;
  memberCalcSnapshot?: MemberCalculationSnapshot;
  reviewSubmission?: MemberReviewSubmission;
}

export type MeetingStatus = 'draft' | 'matched' | 'confirmed' | 'completed';

export interface ReviewMeeting {
  id: string;
  code: string;
  projectName: string;
  issuer: string;
  majorCategory: MajorCategory;
  subCategory: SubCategory;
  date: string; // YYYY-MM-DD
  halfDay: HalfDay;
  slotIndex: SlotIndex;
  reviewType: ReviewTypeCode;
  reviewTriggerNote?: string;
  conflictMemberIds: string[];
  conflictNote?: string;
  status: MeetingStatus;
  seats: MeetingSeat[]; // 1 convener + 5 members
  convenerBackupQueue: CandidateEvaluation[];
  memberBackupQueue: CandidateEvaluation[];
  excludedMemberIds: string[]; // members already rotated out / timed out / declined for this meeting
  filteredOutCandidates: CandidateEvaluation[]; // hard-filtered explanations
  manualRotationCount: number;
  lastMatchedAt?: string;
}

export type VoteResult = '通过' | '有条件通过' | '否决' | '缓议';

export interface HistoricalReview {
  id: string;
  date: string; // YYYY-MM-DD
  projectName: string;
  issuer: string;
  majorCategory: MajorCategory;
  subCategory: SubCategory;
  memberId: string;
  seatRole: SeatRole;
  voteResult: VoteResult;
  reviewType: ReviewTypeCode;
}

export interface RuleConfig {
  concentrationWindowDays: number; // default 90
  convenerConcentrationCap: number; // default 0.60 (60%)
  coldStartThreshold: number; // default 3
  rankScores: [number, number, number, number, number]; // [100, 70, 45, 25, 10]
  sameHalfDaySameSubBonus: number; // +1000
  adjacentSlotBonus: number; // +300
  backtrackGapPenalty: number; // -1500
  crossMajorPenalty: number; // -1200
  sameMajorCrossSubPenalty: number; // -200
  chiefPriorityBonus: number; // +2000 for configured priority review types (default B2, C2)
  chiefPriorityReviewTypes: ReviewTypeCode[]; // default ['B2', 'C2']
  responseTimeoutMinutes: number; // 30
  maxManualRotations: number; // 2
  convenerCount: number; // 1
  memberCount: number; // 5 (total 6)
}

export type AuditActionType =
  | 'MEETING_CREATED'
  | 'SCHEDULE_OPTIMIZED'
  | 'AUTO_MATCHED'
  | 'SECRETARY_REMINDER_SENT'
  | 'MANUAL_ROTATION'
  | 'TIMEOUT_AUTO_ROTATION'
  | 'MEMBER_CONFIRMED'
  | 'MEMBER_DECLINED'
  | 'MEMBER_CALC_SAVED'
  | 'MEMBER_VOTED'
  | 'EXPERTISE_UPDATED'
  | 'AVAILABILITY_UPDATED'
  | 'SIGNATURE_UPDATED'
  | 'RULE_CONFIG_UPDATED'
  | 'CHIEF_STATUS_UPDATED'
  | 'SYSTEM_RESET';

export interface AuditLogEntry {
  seq: number;
  id: string;
  timestamp: string;
  actorRole: RoleType;
  actorName: string;
  actionType: AuditActionType;
  targetRef: string;
  summary: string;
  details: string;
  prevHash: string;
  hash: string;
}

export interface ConcentrationStats {
  memberId: string;
  memberName: string;
  employeeCode: string;
  isChiefCommissioner: boolean;
  chiefCategories: MajorCategory[];
  canConvene: boolean;
  convenerTotal90d: number;
  convenerByMajor: Record<MajorCategory, number>;
  convenerRates: Record<MajorCategory, number>;
  convenerOverCapMajors: MajorCategory[];
  isConvenerColdStart: boolean;
  participantTotal90d: number;
  participantByMajor: Record<MajorCategory, number>;
  participantRates: Record<MajorCategory, number>;
}

export interface ScheduleOptimizationPreview {
  date: string;
  halfDay: HalfDay;
  originalOrder: ReviewMeeting[];
  optimizedOrder: ReviewMeeting[];
  slotAssignments: Array<{
    meetingId: string;
    oldSlot: SlotIndex;
    newSlot: SlotIndex;
    reason: string;
  }>;
  clusterSummary: string;
  edgeMovedCount: number;
  estimatedConflictReduction: number;
  changed: boolean;
}

export interface AppState {
  version: number;
  referenceDate: string; // '2026-11-20'
  simulatedClockIso: string; // Local ISO-like clock e.g. '2026-11-20T13:50:00' for meeting & next-day voting window governance
  activeRole: RoleType;
  activeSecretaryId: string;
  activeMemberId: string;
  config: RuleConfig;
  secretaries: SecretaryProfile[];
  members: CommitteeMember[];
  meetings: ReviewMeeting[];
  history: HistoricalReview[];
  auditLogs: AuditLogEntry[];
}
