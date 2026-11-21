import {
  AppState,
  AuditLogEntry,
  CommitteeMember,
  HALF_DAY_SLOTS,
  HalfDay,
  HistoricalReview,
  MajorCategory,
  ReviewMeeting,
  ReviewTypeCode,
  RuleConfig,
  SecretaryProfile,
  SlotIndex,
  SubCategory,
  VoteResult,
  makeSlotKey,
} from '../types/domain';
import { computeDeterministicHash, createAuditLogEntry } from '../engine/auditHash';
import { runDeterministicMatch } from '../engine/matchingEngine';

export const SCHEDULE_DATES = [
  '2026-11-20',
  '2026-11-23',
  '2026-11-24',
  '2026-11-25',
  '2026-11-26',
] as const;

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  concentrationWindowDays: 90,
  convenerConcentrationCap: 0.6,
  coldStartThreshold: 3,
  rankScores: [100, 70, 45, 25, 10],
  sameHalfDaySameSubBonus: 1000,
  adjacentSlotBonus: 300,
  backtrackGapPenalty: -1500,
  crossMajorPenalty: -1200,
  sameMajorCrossSubPenalty: -200,
  chiefPriorityBonus: 2000,
  chiefPriorityReviewTypes: ['B2', 'C2'],
  responseTimeoutMinutes: 30,
  maxManualRotations: 2,
  convenerCount: 1,
  memberCount: 5,
};

function buildSlots(
  dates: readonly string[],
  excludeKeys: string[] = []
): string[] {
  const excluded = new Set(excludeKeys);
  const keys: string[] = [];
  for (const date of dates) {
    (['AM', 'PM'] as HalfDay[]).forEach((halfDay) => {
      HALF_DAY_SLOTS[halfDay].forEach((slot) => {
        const key = makeSlotKey(date, halfDay, slot.slotIndex as SlotIndex);
        if (!excluded.has(key)) keys.push(key);
      });
    });
  }
  return keys;
}

export const ADMIN_CREDENTIAL = {
  employeeCode: 'ADM-001',
  name: '系统合规管理员',
  credentialCode: '9001',
} as const;

function createInitialSecretaries(): SecretaryProfile[] {
  return [
    {
      id: 'S001',
      employeeCode: 'SEC-001',
      name: '沈若琳',
      title: '信评委高级秘书',
      scope: '综合排期与全院评审统筹',
      credentialCode: '8801',
    },
    {
      id: 'S002',
      employeeCode: 'SEC-002',
      name: '陆明轩',
      title: '信评委专职秘书',
      scope: '城投及结构化评审会务',
      credentialCode: '8802',
    },
    {
      id: 'S003',
      employeeCode: 'SEC-003',
      name: '顾清雅',
      title: '信评委专职秘书',
      scope: '工商金融及跟踪评审会务',
      credentialCode: '8803',
    },
  ];
}

function createInitialMembers(): CommitteeMember[] {
  const rawMembers: Array<Omit<CommitteeMember, 'credentialCode'>> = [
    {
      id: 'M001',
      employeeCode: 'CRC-001',
      name: '陈明远',
      title: '首席信用评级官 / 主任委员',
      department: '信用评级委员会',
      active: true,
      canConvene: true,
      isChiefCommissioner: true,
      chiefCategories: ['城投'],
      expertise: [
        { rank: 1, subCategory: '省级及高信用城投' },
        { rank: 2, subCategory: '地市级城投' },
        { rank: 3, subCategory: '区县及园区城投' },
        { rank: 4, subCategory: '银行与非银金融' },
      ],
      conflictIssuers: ['星河城投控股'],
      availableSlotKeys: buildSlots(SCHEDULE_DATES, ['2026-11-24_PM_3']),
    },
    {
      id: 'M002',
      employeeCode: 'CRC-002',
      name: '林知行',
      title: '执行主任委员',
      department: '信用评级委员会',
      active: true,
      canConvene: true,
      isChiefCommissioner: true,
      chiefCategories: ['城投'],
      expertise: [
        { rank: 1, subCategory: '省级及高信用城投' },
        { rank: 2, subCategory: '地市级城投' },
        { rank: 3, subCategory: 'REITs与不动产结构化' },
        { rank: 4, subCategory: '能源与基础化工' },
      ],
      conflictIssuers: [],
      availableSlotKeys: buildSlots(SCHEDULE_DATES, ['2026-11-25_AM_1']),
    },
    {
      id: 'M003',
      employeeCode: 'CRC-003',
      name: '周承泽',
      title: '工商金融主任委员',
      department: '信用评级委员会',
      active: true,
      canConvene: true,
      isChiefCommissioner: true,
      chiefCategories: ['工商金融'],
      expertise: [
        { rank: 1, subCategory: '能源与基础化工' },
        { rank: 2, subCategory: '制造与科技消费' },
        { rank: 3, subCategory: '银行与非银金融' },
        { rank: 4, subCategory: '省级及高信用城投' },
      ],
      conflictIssuers: ['北辰石化集团'],
      availableSlotKeys: buildSlots(SCHEDULE_DATES, ['2026-11-20_AM_4']),
    },
    {
      id: 'M004',
      employeeCode: 'CRC-004',
      name: '苏婉清',
      title: '结构融资主任委员',
      department: '信用评级委员会',
      active: true,
      canConvene: true,
      isChiefCommissioner: true,
      chiefCategories: ['结构'],
      expertise: [
        { rank: 1, subCategory: 'REITs与不动产结构化' },
        { rank: 2, subCategory: '企业资产支持专项计划' },
        { rank: 3, subCategory: '信贷资产证券化ABS' },
        { rank: 4, subCategory: '银行与非银金融' },
      ],
      conflictIssuers: [],
      availableSlotKeys: buildSlots(SCHEDULE_DATES),
    },
    {
      id: 'M005',
      employeeCode: 'CRC-005',
      name: '顾景深',
      title: '资深评审召集人（新晋）',
      department: '公用与城投评审部',
      active: true,
      canConvene: true,
      isChiefCommissioner: false,
      chiefCategories: [],
      expertise: [
        { rank: 1, subCategory: '地市级城投' },
        { rank: 2, subCategory: '省级及高信用城投' },
        { rank: 3, subCategory: '区县及园区城投' },
      ],
      conflictIssuers: [],
      availableSlotKeys: buildSlots(SCHEDULE_DATES),
    },
    {
      id: 'M006',
      employeeCode: 'CRC-006',
      name: '陆文博',
      title: '资深评审召集人',
      department: '工商与金融评审部',
      active: true,
      canConvene: true,
      isChiefCommissioner: false,
      chiefCategories: [],
      expertise: [
        { rank: 1, subCategory: '银行与非银金融' },
        { rank: 2, subCategory: '制造与科技消费' },
        { rank: 3, subCategory: '能源与基础化工' },
        { rank: 4, subCategory: '信贷资产证券化ABS' },
      ],
      conflictIssuers: [],
      availableSlotKeys: buildSlots(SCHEDULE_DATES),
    },
    {
      id: 'M007',
      employeeCode: 'CRC-007',
      name: '沈清扬',
      title: '资深评审召集人',
      department: '结构化产品评审部',
      active: true,
      canConvene: true,
      isChiefCommissioner: false,
      chiefCategories: [],
      expertise: [
        { rank: 1, subCategory: '企业资产支持专项计划' },
        { rank: 2, subCategory: '信贷资产证券化ABS' },
        { rank: 3, subCategory: 'REITs与不动产结构化' },
        { rank: 4, subCategory: '省级及高信用城投' },
        { rank: 5, subCategory: '银行与非银金融' },
      ],
      conflictIssuers: [],
      availableSlotKeys: buildSlots(SCHEDULE_DATES),
    },
    {
      id: 'M008',
      employeeCode: 'CRC-008',
      name: '许安宁',
      title: '资深评审召集人',
      department: '综合评审部',
      active: true,
      canConvene: true,
      isChiefCommissioner: false,
      chiefCategories: [],
      expertise: [
        { rank: 1, subCategory: '区县及园区城投' },
        { rank: 2, subCategory: '省级及高信用城投' },
        { rank: 3, subCategory: '能源与基础化工' },
        { rank: 4, subCategory: '企业资产支持专项计划' },
      ],
      conflictIssuers: [],
      availableSlotKeys: buildSlots(SCHEDULE_DATES, ['2026-11-23_PM_2']),
    },
    {
      id: 'M009',
      employeeCode: 'CRC-009',
      name: '宋嘉禾',
      title: '专职信评委员',
      department: '公用与城投评审部',
      active: true,
      canConvene: false,
      isChiefCommissioner: false,
      chiefCategories: [],
      expertise: [
        { rank: 1, subCategory: '省级及高信用城投' },
        { rank: 2, subCategory: '地市级城投' },
        { rank: 3, subCategory: '能源与基础化工' },
        { rank: 4, subCategory: '区县及园区城投' },
      ],
      conflictIssuers: ['东海省级交通基础设施集团'],
      availableSlotKeys: buildSlots(SCHEDULE_DATES),
    },
    {
      id: 'M010',
      employeeCode: 'CRC-010',
      name: '程致远',
      title: '专职信评委员',
      department: '公用与城投评审部',
      active: true,
      canConvene: false,
      isChiefCommissioner: false,
      chiefCategories: [],
      expertise: [
        { rank: 1, subCategory: '地市级城投' },
        { rank: 2, subCategory: '省级及高信用城投' },
        { rank: 3, subCategory: 'REITs与不动产结构化' },
        { rank: 4, subCategory: '企业资产支持专项计划' },
      ],
      conflictIssuers: [],
      availableSlotKeys: buildSlots(SCHEDULE_DATES),
    },
    {
      id: 'M011',
      employeeCode: 'CRC-011',
      name: '叶书瑶',
      title: '专职信评委员',
      department: '工商与金融评审部',
      active: true,
      canConvene: false,
      isChiefCommissioner: false,
      chiefCategories: [],
      expertise: [
        { rank: 1, subCategory: '能源与基础化工' },
        { rank: 2, subCategory: '制造与科技消费' },
        { rank: 3, subCategory: '银行与非银金融' },
        { rank: 4, subCategory: '企业资产支持专项计划' },
      ],
      conflictIssuers: ['清源新材股份有限公司'],
      availableSlotKeys: buildSlots(SCHEDULE_DATES),
    },
    {
      id: 'M012',
      employeeCode: 'CRC-012',
      name: '唐景行',
      title: '专职信评委员',
      department: '结构化产品评审部',
      active: true,
      canConvene: false,
      isChiefCommissioner: false,
      chiefCategories: [],
      expertise: [
        { rank: 1, subCategory: '信贷资产证券化ABS' },
        { rank: 2, subCategory: '企业资产支持专项计划' },
        { rank: 3, subCategory: 'REITs与不动产结构化' },
        { rank: 4, subCategory: '银行与非银金融' },
      ],
      conflictIssuers: [],
      availableSlotKeys: buildSlots(SCHEDULE_DATES),
    },
    {
      id: 'M013',
      employeeCode: 'CRC-013',
      name: '何思齐',
      title: '专职信评委员',
      department: '工商与金融评审部',
      active: true,
      canConvene: false,
      isChiefCommissioner: false,
      chiefCategories: [],
      expertise: [
        { rank: 1, subCategory: '银行与非银金融' },
        { rank: 2, subCategory: '能源与基础化工' },
        { rank: 3, subCategory: '制造与科技消费' },
        { rank: 4, subCategory: '地市级城投' },
      ],
      conflictIssuers: [],
      availableSlotKeys: buildSlots(SCHEDULE_DATES),
    },
    {
      id: 'M014',
      employeeCode: 'CRC-014',
      name: '秦若愚',
      title: '专职信评委员',
      department: '结构化产品评审部',
      active: true,
      canConvene: false,
      isChiefCommissioner: false,
      chiefCategories: [],
      expertise: [
        { rank: 1, subCategory: '企业资产支持专项计划' },
        { rank: 2, subCategory: 'REITs与不动产结构化' },
        { rank: 3, subCategory: '信贷资产证券化ABS' },
        { rank: 4, subCategory: '省级及高信用城投' },
      ],
      conflictIssuers: [],
      availableSlotKeys: buildSlots(SCHEDULE_DATES),
    },
  ];

  const defaultSignedAt = '2026-11-18T09:30:00.000Z';
  return rawMembers.map((m, idx) => ({
    ...m,
    credentialCode: String(1001 + idx),
    ...(m.id === 'M002' || m.id === 'M004'
      ? {
          savedSignature: {
            method: 'typed_seal' as const,
            typedSealText: m.name,
            autoApply: true,
            updatedAt: defaultSignedAt,
          },
        }
      : {}),
  }));
}

function createInitialHistory(): HistoricalReview[] {
  const records: HistoricalReview[] = [];
  let seq = 1;

  const pushRec = (
    date: string,
    memberId: string,
    seatRole: 'convener' | 'member',
    majorCategory: MajorCategory,
    subCategory: SubCategory,
    projectName: string,
    issuer: string,
    voteResult: VoteResult,
    reviewType: ReviewTypeCode = 'B1'
  ) => {
    records.push({
      id: `HIS-${String(seq++).padStart(4, '0')}`,
      date,
      memberId,
      seatRole,
      majorCategory,
      subCategory,
      projectName,
      issuer,
      voteResult,
      reviewType,
    });
  };

  // --- M001 陈明远 (城投主任委员): Near 90d Convener = 4 城投 + 2 工商金融 = 6 场 (66.7% > 60% -> FORCED ROTATION) ---
  pushRec('2026-11-12', 'M001', 'convener', '城投', '省级及高信用城投', '江北省高速集团2026中票', '江北省高速集团', '通过', 'B2');
  pushRec('2026-10-28', 'M001', 'convener', '城投', '地市级城投', '临港城发2026年度短融', '临港城发集团', '通过', 'B1');
  pushRec('2026-10-14', 'M001', 'convener', '城投', '省级及高信用城投', '海湾水务投资公司债', '海湾水务集团', '有条件通过', 'A');
  pushRec('2026-09-25', 'M001', 'convener', '城投', '区县及园区城投', '南山高新开发定向工具', '南山高新开发', '缓议', 'C2');
  pushRec('2026-09-10', 'M001', 'convener', '工商金融', '银行与非银金融', '东吴农商行二级资本债', '东吴农商银行', '通过', 'A');
  pushRec('2026-08-30', 'M001', 'convener', '工商金融', '能源与基础化工', '新能电力绿债跟踪评级', '新能电力股份', '通过', 'C1');
  // Member participations & older (>90d) records for rich monthly charts
  pushRec('2026-11-04', 'M001', 'member', '结构', 'REITs与不动产结构化', '津港产业园REITs首发', '津港产业园运营', '通过', 'A');
  pushRec('2026-08-05', 'M001', 'convener', '城投', '省级及高信用城投', '东岭交建超短融评级', '东岭交通建设', '通过', 'B1');
  pushRec('2026-07-18', 'M001', 'member', '工商金融', '银行与非银金融', '华安金融租赁金融债', '华安金融租赁', '有条件通过', 'B1');
  pushRec('2026-06-22', 'M001', 'convener', '城投', '地市级城投', '锦江城投主体信用评级', '锦江城投集团', '否决', 'C2');

  // --- M002 林知行 (城投主任委员): Near 90d Convener = 2 城投 + 2 工商金融 + 1 结构 = 5 场 (40.0% <= 60% -> ELIGIBLE +2000) ---
  pushRec('2026-11-15', 'M002', 'convener', '城投', '省级及高信用城投', '华东铁路投资中期票据', '华东铁路投资', '通过', 'B2');
  pushRec('2026-10-22', 'M002', 'convener', '城投', '地市级城投', '青溪城市运营公司债', '青溪城市运营', '通过', 'B1');
  pushRec('2026-10-08', 'M002', 'convener', '工商金融', '能源与基础化工', '朗润化工2026公司债', '朗润化工集团', '有条件通过', 'C1');
  pushRec('2026-09-18', 'M002', 'convener', '工商金融', '制造与科技消费', '智联精密科创债', '智联精密科技', '通过', 'A');
  pushRec('2026-09-02', 'M002', 'convener', '结构', 'REITs与不动产结构化', '华南物流仓储REITs', '华南物流发展', '通过', 'A');
  pushRec('2026-11-02', 'M002', 'member', '城投', '区县及园区城投', '望江经开区专项债', '望江经开建设', '缓议', 'C1');
  pushRec('2026-08-12', 'M002', 'member', '城投', '省级及高信用城投', '宁海港务中期票据', '宁海港务集团', '通过', 'B1');
  pushRec('2026-07-15', 'M002', 'convener', '工商金融', '能源与基础化工', '宏达燃气绿色债券', '宏达燃气集团', '通过', 'B1');
  pushRec('2026-06-19', 'M002', 'member', '结构', '企业资产支持专项计划', '远航供应链第3期ABS', '远航商业保理', '有条件通过', 'A');

  // --- M003 周承泽 (工商金融主任委员): Near 90d Convener = 3 工商金融 + 2 城投 = 5 场 (60.0% boundary, NOT >60%) ---
  pushRec('2026-11-11', 'M003', 'convener', '工商金融', '能源与基础化工', '丰源煤电绿色中期票据', '丰源能源集团', '通过', 'B1');
  pushRec('2026-10-25', 'M003', 'convener', '工商金融', '制造与科技消费', '瑞达装备可转债评级', '瑞达智能装备', '有条件通过', 'B2');
  pushRec('2026-09-29', 'M003', 'convener', '工商金融', '银行与非银金融', '江南城商行永续债', '江南城市商业银行', '通过', 'A');
  pushRec('2026-09-14', 'M003', 'convener', '城投', '省级及高信用城投', '西湖文旅开发公司债', '西湖文旅集团', '通过', 'B1');
  pushRec('2026-08-29', 'M003', 'convener', '城投', '地市级城投', '玉兰轨交建设中期票据', '玉兰轨道交通', '通过', 'B1');
  pushRec('2026-11-05', 'M003', 'member', '工商金融', '能源与基础化工', '青松新材料短融评级', '青松新材料', '否决', 'C2');
  pushRec('2026-07-24', 'M003', 'convener', '工商金融', '制造与科技消费', '天枢微电子科创票据', '天枢微电子', '通过', 'A');
  pushRec('2026-06-28', 'M003', 'member', '城投', '地市级城投', '明州水投公司债', '明州水务投资', '通过', 'B1');

  // --- M004 苏婉清 (结构主任委员): Near 90d Convener = 2 结构 + 2 工商金融 + 1 城投 = 5 场 (40.0%) ---
  pushRec('2026-11-14', 'M004', 'convener', '结构', 'REITs与不动产结构化', '申城保租房公募REITs', '申城安居运营', '通过', 'B2');
  pushRec('2026-10-19', 'M004', 'convener', '结构', '企业资产支持专项计划', '嘉禾保理2026-2期ABS', '嘉禾商业保理', '通过', 'A');
  pushRec('2026-10-03', 'M004', 'convener', '工商金融', '银行与非银金融', '海通金租金融债评级', '海通金融租赁', '有条件通过', 'B1');
  pushRec('2026-09-16', 'M004', 'convener', '工商金融', '制造与科技消费', '康泰医疗器械公司债', '康泰医疗股份', '通过', 'B1');
  pushRec('2026-08-28', 'M004', 'convener', '城投', '省级及高信用城投', '粤海基础设施中期票据', '粤海基建集团', '通过', 'B1');
  pushRec('2026-11-06', 'M004', 'member', '结构', '信贷资产证券化ABS', '兴业车贷2026-1期ABS', '兴业汽车金融', '通过', 'A');
  pushRec('2026-07-20', 'M004', 'convener', '结构', '信贷资产证券化ABS', '惠民消费贷ABN评级', '惠民消费金融', '缓议', 'C1');
  pushRec('2026-06-14', 'M004', 'member', '结构', '企业资产支持专项计划', '绿能光伏收益权ABS', '绿能电力运营', '通过', 'A');

  // --- M005 顾景深 (新晋召集人): Near 90d Convener = 2 城投 (100% 城投, BUT < 3 COLD START EXEMPTION!) ---
  pushRec('2026-11-08', 'M005', 'convener', '城投', '地市级城投', '桐城城建2026公司债', '桐城城市建设', '通过');
  pushRec('2026-10-12', 'M005', 'convener', '城投', '区县及园区城投', '翠湖高新产业园中票', '翠湖高新集团', '有条件通过');
  pushRec('2026-11-01', 'M005', 'member', '城投', '省级及高信用城投', '中原能源基建中票', '中原基建投资', '通过');
  pushRec('2026-09-22', 'M005', 'member', '工商金融', '能源与基础化工', '蓝天环保公司债评级', '蓝天环保科技', '通过');
  pushRec('2026-07-11', 'M005', 'member', '城投', '地市级城投', '白鹭港务建设债', '白鹭港务集团', '通过');

  // --- M006 陆文博 (召集人): Near 90d Convener = 4 工商金融 + 1 城投 = 5 场 (80.0% 工商金融 > 60% -> FORCED ROTATION) ---
  pushRec('2026-11-16', 'M006', 'convener', '工商金融', '银行与非银金融', '浦南商业银行绿色金融债', '浦南商业银行', '通过');
  pushRec('2026-10-30', 'M006', 'convener', '工商金融', '制造与科技消费', '华光半导体科创票据', '华光半导体', '有条件通过');
  pushRec('2026-10-11', 'M006', 'convener', '工商金融', '能源与基础化工', '泰和热电超短融评级', '泰和能源集团', '通过');
  pushRec('2026-09-19', 'M006', 'convener', '工商金融', '银行与非银金融', '鑫源证券次级债评级', '鑫源证券股份', '通过');
  pushRec('2026-09-01', 'M006', 'convener', '城投', '省级及高信用城投', '东海交投中期票据', '东海交通投资', '通过');
  pushRec('2026-07-29', 'M006', 'convener', '工商金融', '银行与非银金融', '民丰农商行资本债', '民丰农商银行', '否决');
  pushRec('2026-06-15', 'M006', 'member', '结构', '信贷资产证券化ABS', '信安消费ABS第一期', '信安消费金融', '通过');

  // --- M007 沈清扬 (均衡型召集人): Near 90d Convener = 2 结构 + 2 工商金融 + 1 城投 = 5 场 ---
  pushRec('2026-11-10', 'M007', 'convener', '结构', '企业资产支持专项计划', '国融租赁第4期专项计划', '国融融资租赁', '通过');
  pushRec('2026-10-21', 'M007', 'convener', '结构', '信贷资产证券化ABS', '智行汽车金融ABS', '智行汽车金融', '通过');
  pushRec('2026-10-05', 'M007', 'convener', '工商金融', '银行与非银金融', '安盈保险资本补充债', '安盈人寿保险', '有条件通过');
  pushRec('2026-09-17', 'M007', 'convener', '工商金融', '制造与科技消费', '锐进新能源公司债', '锐进新能源', '通过');
  pushRec('2026-09-03', 'M007', 'convener', '城投', '省级及高信用城投', '南粤高速发展中票', '南粤高速集团', '通过');
  pushRec('2026-07-16', 'M007', 'member', '结构', 'REITs与不动产结构化', '清风产业园REITs', '清风产投集团', '通过');

  // --- M008 许安宁 (召集人): Near 90d Convener = 2 城投 + 1 工商金融 + 1 结构 = 4 场 ---
  pushRec('2026-11-09', 'M008', 'convener', '城投', '区县及园区城投', '滨江新区开发短融', '滨江新区控股', '有条件通过');
  pushRec('2026-10-18', 'M008', 'convener', '城投', '省级及高信用城投', '北疆交通投资中票', '北疆交通集团', '通过');
  pushRec('2026-09-26', 'M008', 'convener', '工商金融', '能源与基础化工', '辰星化工绿色债', '辰星化工股份', '通过');
  pushRec('2026-09-08', 'M008', 'convener', '结构', '企业资产支持专项计划', '通达供应链ABN', '通达商业保理', '通过');
  pushRec('2026-07-09', 'M008', 'member', '城投', '区县及园区城投', '银杏产城建设债', '银杏产城集团', '缓议');

  // --- Regular Committee Members M009..M014 rich history across 6 months ---
  const regularSeeds: Array<{
    memberId: string;
    items: Array<[string, MajorCategory, SubCategory, string, string, VoteResult]>;
  }> = [
    {
      memberId: 'M009',
      items: [
        ['2026-11-14', '城投', '省级及高信用城投', '川北铁投2026中票', '川北铁路投资', '通过'],
        ['2026-10-29', '城投', '地市级城投', '浔阳城建公司债', '浔阳城建集团', '通过'],
        ['2026-10-10', '城投', '区县及园区城投', '麓谷科创园短融', '麓谷科创投资', '有条件通过'],
        ['2026-09-21', '工商金融', '能源与基础化工', '碧水环境绿色债', '碧水环保股份', '通过'],
        ['2026-09-04', '城投', '省级及高信用城投', '闽东港口集团中票', '闽东港口发展', '通过'],
        ['2026-08-11', '城投', '地市级城投', '衡山文旅开发债', '衡山文旅控股', '缓议'],
        ['2026-07-22', '工商金融', '能源与基础化工', '明阳燃气公司债', '明阳燃气集团', '通过'],
        ['2026-06-18', '城投', '区县及园区城投', '凤城高新定向债', '凤城高新投', '否决'],
      ],
    },
    {
      memberId: 'M010',
      items: [
        ['2026-11-13', '城投', '地市级城投', '沧海城投2026中票', '沧海城市投资', '通过'],
        ['2026-10-26', '结构', 'REITs与不动产结构化', '华中高速公路REITs', '华中交投运营', '通过'],
        ['2026-10-09', '城投', '省级及高信用城投', '苏北轨交建设中票', '苏北轨道交通', '有条件通过'],
        ['2026-09-15', '结构', '企业资产支持专项计划', '恒通租赁专项计划', '恒通融资租赁', '通过'],
        ['2026-08-31', '城投', '地市级城投', '琅琊城发短融评级', '琅琊城发集团', '通过'],
        ['2026-07-19', '城投', '省级及高信用城投', '金陵水务中票评级', '金陵水务集团', '通过'],
        ['2026-06-25', '结构', 'REITs与不动产结构化', '东郊物流园REITs', '东郊物流投资', '缓议'],
      ],
    },
    {
      memberId: 'M011',
      items: [
        ['2026-11-15', '工商金融', '能源与基础化工', '海韵石化绿色公司债', '海韵石化股份', '通过'],
        ['2026-10-24', '工商金融', '制造与科技消费', '凌云航空材料中票', '凌云新材科技', '有条件通过'],
        ['2026-10-06', '工商金融', '银行与非银金融', '浙东农商行金融债', '浙东农商银行', '通过'],
        ['2026-09-18', '结构', '企业资产支持专项计划', '锦程保理2期ABS', '锦程商业保理', '通过'],
        ['2026-09-02', '工商金融', '能源与基础化工', '风华盐化工短融', '风华化工集团', '否决'],
        ['2026-07-26', '工商金融', '制造与科技消费', '光启智能传感债', '光启智能科技', '通过'],
        ['2026-06-21', '工商金融', '能源与基础化工', '松江清洁能源债', '松江能源股份', '通过'],
      ],
    },
    {
      memberId: 'M012',
      items: [
        ['2026-11-12', '结构', '信贷资产证券化ABS', '和融车贷2026-3期ABS', '和融汽车金融', '通过'],
        ['2026-10-27', '结构', '企业资产支持专项计划', '盛泰租赁绿色ABS', '盛泰融资租赁', '通过'],
        ['2026-10-12', '结构', 'REITs与不动产结构化', '云谷数据中心REITs', '云谷算力运营', '有条件通过'],
        ['2026-09-24', '工商金融', '银行与非银金融', '渝西城商行永续债', '渝西商业银行', '通过'],
        ['2026-09-05', '结构', '信贷资产证券化ABS', '惠通小微贷ABS', '惠通小额信贷', '缓议'],
        ['2026-07-17', '结构', '企业资产支持专项计划', '嘉信保理供应链ABS', '嘉信保理股份', '通过'],
      ],
    },
    {
      memberId: 'M013',
      items: [
        ['2026-11-11', '工商金融', '银行与非银金融', '兴海银行二级资本债', '兴海商业银行', '通过'],
        ['2026-10-20', '工商金融', '制造与科技消费', '博远生物医药中票', '博远医药股份', '通过'],
        ['2026-10-02', '城投', '地市级城投', '燕山城建公司债', '燕山城建集团', '有条件通过'],
        ['2026-09-14', '工商金融', '能源与基础化工', '华电清洁能源债', '华电清洁能源', '通过'],
        ['2026-08-09', '工商金融', '银行与非银金融', '长风金租金融债', '长风金融租赁', '通过'],
        ['2026-06-29', '城投', '地市级城投', '柳州产投短融', '柳州产投集团', '否决'],
      ],
    },
    {
      memberId: 'M014',
      items: [
        ['2026-11-13', '结构', '企业资产支持专项计划', '星辉光伏收益权ABS', '星辉新能源', '通过'],
        ['2026-10-23', '结构', 'REITs与不动产结构化', '海滨保租房REITs', '海滨安居集团', '通过'],
        ['2026-10-07', '城投', '省级及高信用城投', '龙江交投2026中票', '龙江交通投资', '有条件通过'],
        ['2026-09-20', '结构', '信贷资产证券化ABS', '银丰消费金融ABS', '银丰消费金融', '通过'],
        ['2026-07-28', '结构', '企业资产支持专项计划', '安达物流供应链ABN', '安达物流集团', '通过'],
      ],
    },
  ];

  const reviewTypesCycle: ReviewTypeCode[] = ['B1', 'A', 'B2', 'C1', 'C2'];
  let seedIdx = 0;
  for (const seed of regularSeeds) {
    for (const [date, major, sub, project, issuer, vote] of seed.items) {
      const rt =
        vote === '否决'
          ? 'C2'
          : vote === '缓议'
          ? 'C1'
          : reviewTypesCycle[seedIdx % reviewTypesCycle.length];
      seedIdx += 1;
      pushRec(date, seed.memberId, 'member', major, sub, project, issuer, vote, rt);
    }
  }

  return records.sort((a, b) => b.date.localeCompare(a.date));
}

function createInitialMeetings(
  members: CommitteeMember[],
  history: HistoricalReview[],
  config: RuleConfig
): ReviewMeeting[] {
  const draftMeetings: ReviewMeeting[] = [
    // Today AM: intentionally interleaved with conflict project in slot 2 so One-Click Optimizer demonstrates clustering + edge placement!
    {
      id: 'MT-20261120-01',
      code: 'CRC-2026-1101',
      projectName: '东海省级交通基础设施2026年度第一期中票',
      issuer: '东海省级交通基础设施集团',
      majorCategory: '城投',
      subCategory: '省级及高信用城投',
      date: '2026-11-20',
      halfDay: 'AM',
      slotIndex: 1,
      reviewType: 'B1',
      conflictMemberIds: ['M009'],
      conflictNote: '宋嘉禾曾参与该发行人前期顾问咨询，须前置回避',
      status: 'draft',
      seats: [],
      convenerBackupQueue: [],
      memberBackupQueue: [],
      excludedMemberIds: [],
      filteredOutCandidates: [],
      manualRotationCount: 0,
    },
    {
      id: 'MT-20261120-02',
      code: 'CRC-2026-1102',
      projectName: '清源新材2026绿色公司债主体跟踪评级',
      issuer: '清源新材股份有限公司',
      majorCategory: '工商金融',
      subCategory: '能源与基础化工',
      date: '2026-11-20',
      halfDay: 'AM',
      slotIndex: 2,
      reviewType: 'C1',
      reviewTriggerNote: '关注基础化工原材料价格波动对经营性现金流覆盖倍数的阶段性影响',
      conflictMemberIds: ['M011'],
      conflictNote: '叶书瑶存在关联方利益冲突，建议移至半天边缘时段防折返',
      status: 'draft',
      seats: [],
      convenerBackupQueue: [],
      memberBackupQueue: [],
      excludedMemberIds: [],
      filteredOutCandidates: [],
      manualRotationCount: 0,
    },
    {
      id: 'MT-20261120-03',
      code: 'CRC-2026-1103',
      projectName: '云港城发高信用永续债连续评级',
      issuer: '云港城市发展控股集团',
      majorCategory: '城投',
      subCategory: '省级及高信用城投',
      date: '2026-11-20',
      halfDay: 'AM',
      slotIndex: 3,
      reviewType: 'B2',
      reviewTriggerNote: '完成省级港口核心资产划转与合并口径重组，触发 B2 重大变化评审流程',
      conflictMemberIds: [],
      status: 'draft',
      seats: [],
      convenerBackupQueue: [],
      memberBackupQueue: [],
      excludedMemberIds: [],
      filteredOutCandidates: [],
      manualRotationCount: 0,
    },
    {
      id: 'MT-20261120-04',
      code: 'CRC-2026-1104',
      projectName: '华辰商业银行2026年二级资本债券首次评级',
      issuer: '华辰商业银行股份有限公司',
      majorCategory: '工商金融',
      subCategory: '银行与非银金融',
      date: '2026-11-20',
      halfDay: 'AM',
      slotIndex: 4,
      reviewType: 'A',
      conflictMemberIds: [],
      status: 'draft',
      seats: [],
      convenerBackupQueue: [],
      memberBackupQueue: [],
      excludedMemberIds: [],
      filteredOutCandidates: [],
      manualRotationCount: 0,
    },
    // Today PM: Slot 1 pre-matched with live 30-min countdown so Secretary & Member can interact immediately!
    {
      id: 'MT-20261120-05',
      code: 'CRC-2026-1105',
      projectName: '明远租赁2026第一期资产支持专项计划',
      issuer: '明远融资租赁有限公司',
      majorCategory: '结构',
      subCategory: '企业资产支持专项计划',
      date: '2026-11-20',
      halfDay: 'PM',
      slotIndex: 1,
      reviewType: 'A',
      conflictMemberIds: [],
      status: 'draft',
      seats: [],
      convenerBackupQueue: [],
      memberBackupQueue: [],
      excludedMemberIds: [],
      filteredOutCandidates: [],
      manualRotationCount: 0,
    },
    {
      id: 'MT-20261120-06',
      code: 'CRC-2026-1106',
      projectName: '滨海科创园基础设施公募REITs扩募评级',
      issuer: '滨海科创园资产运营有限公司',
      majorCategory: '结构',
      subCategory: 'REITs与不动产结构化',
      date: '2026-11-20',
      halfDay: 'PM',
      slotIndex: 2,
      reviewType: 'B2',
      reviewTriggerNote: '本次扩募新增三处核心科创园区底层资产，资产池规模显著变化，触发 B2 重大变化评审',
      conflictMemberIds: [],
      status: 'draft',
      seats: [],
      convenerBackupQueue: [],
      memberBackupQueue: [],
      excludedMemberIds: [],
      filteredOutCandidates: [],
      manualRotationCount: 0,
    },
    {
      id: 'MT-20261120-07',
      code: 'CRC-2026-1107',
      projectName: '江南城建2026年度第二期短期融资券',
      issuer: '江南城市建设投资集团',
      majorCategory: '城投',
      subCategory: '地市级城投',
      date: '2026-11-20',
      halfDay: 'PM',
      slotIndex: 3,
      reviewType: 'B1',
      conflictMemberIds: [],
      status: 'draft',
      seats: [],
      convenerBackupQueue: [],
      memberBackupQueue: [],
      excludedMemberIds: [],
      filteredOutCandidates: [],
      manualRotationCount: 0,
    },
    // Next workday AM
    {
      id: 'MT-20261123-01',
      code: 'CRC-2026-1108',
      projectName: '启明精密制造可转债不定期跟踪评审',
      issuer: '启明精密制造股份有限公司',
      majorCategory: '工商金融',
      subCategory: '制造与科技消费',
      date: '2026-11-23',
      halfDay: 'AM',
      slotIndex: 1,
      reviewType: 'C2',
      reviewTriggerNote: '核心下游客户订单大幅缩减且触发债务展期条款，进入 C2 跟踪行动评审议程',
      conflictMemberIds: [],
      status: 'draft',
      seats: [],
      convenerBackupQueue: [],
      memberBackupQueue: [],
      excludedMemberIds: [],
      filteredOutCandidates: [],
      manualRotationCount: 0,
    },
    {
      id: 'MT-20261123-02',
      code: 'CRC-2026-1109',
      projectName: '兴澜消费金融2026年第一期信贷ABS',
      issuer: '兴澜消费金融有限公司',
      majorCategory: '结构',
      subCategory: '信贷资产证券化ABS',
      date: '2026-11-23',
      halfDay: 'AM',
      slotIndex: 2,
      reviewType: 'A',
      conflictMemberIds: [],
      status: 'draft',
      seats: [],
      convenerBackupQueue: [],
      memberBackupQueue: [],
      excludedMemberIds: [],
      filteredOutCandidates: [],
      manualRotationCount: 0,
    },
  ];

  // Pre-match PM slot 1 (CRC-2026-1105) so users immediately see an active matched session with 30-min countdown
  const pm1 = draftMeetings[4];
  const now = new Date();
  const matchRes = runDeterministicMatch({
    meeting: pm1,
    members,
    allMeetings: draftMeetings,
    history,
    config,
    nowIso: now.toISOString(),
  });

  // Mark convener & first 2 members as confirmed with signed electronic conflict declarations,
  // leaving 3 members pending for interactive e-signing / timeout demo
  const defaultClauses = [
    '本人及近亲属与本次评审项目发行人、增信机构及主要承销机构不存在股权持有、债权债务、任职或亲属关联等利益冲突情形。',
    '本人近十二个月内未参与该发行人的评级承做、顾问咨询或商业利益推介，亦未接受发行人任何不当请托或馈赠。',
    '本人承诺严格遵守信用评级保密纪律，独立、客观、审慎地发表评审意见并独立表决；如会中发现潜在冲突将立即中止参与并申报回避。',
  ];

  const hydratedSeats = matchRes.seats.map((seat, idx) => {
    if (idx <= 2) {
      const signedAt = new Date(now.getTime() - (5 - idx) * 60 * 1000).toISOString();
      const declarationId = `COI-${pm1.code}-${seat.employeeCode}`;
      const declarationHash = computeDeterministicHash(
        [
          declarationId,
          seat.memberId,
          seat.memberName,
          pm1.code,
          pm1.issuer,
          'typed_seal',
          signedAt,
          defaultClauses.join('|'),
        ].join('|')
      );
      return {
        ...seat,
        status: 'confirmed' as const,
        respondedAt: signedAt,
        conflictDeclaration: {
          declarationId,
          signerMemberId: seat.memberId,
          signerName: seat.memberName,
          signerEmployeeCode: seat.employeeCode,
          meetingCode: pm1.code,
          projectName: pm1.projectName,
          issuer: pm1.issuer,
          seatLabel: seat.seatLabel,
          signingMethod: 'typed_seal' as const,
          typedSealText: seat.memberName,
          clausesAccepted: defaultClauses,
          signedAt,
          declarationHash,
        },
      };
    }
    return seat;
  });

  draftMeetings[4] = {
    ...pm1,
    status: 'matched',
    seats: hydratedSeats,
    convenerBackupQueue: matchRes.convenerBackupQueue,
    memberBackupQueue: matchRes.memberBackupQueue,
    filteredOutCandidates: matchRes.filteredOutCandidates,
    lastMatchedAt: now.toISOString(),
  };

  return draftMeetings;
}

export function createInitialAppState(): AppState {
  const config = { ...DEFAULT_RULE_CONFIG };
  const secretaries = createInitialSecretaries();
  const members = createInitialMembers();
  const history = createInitialHistory();
  const meetings = createInitialMeetings(members, history, config);

  let auditLogs: AuditLogEntry[] = [];
  const baseTs = new Date(Date.now() - 20 * 60 * 1000);

  auditLogs = [
    ...auditLogs,
    createAuditLogEntry(auditLogs, {
      actorRole: 'admin',
      actorName: '系统合规管理员',
      actionType: 'RULE_CONFIG_UPDATED',
      targetRef: 'GLOBAL_RULES',
      summary: '初始化信评委智能匹配与轮换核心合规参数',
      details:
        '90天召集人集中度上限 60%（冷启动阈值 3 场）；6人制（1召集人+5委员）；同半天同细分 +1000、紧邻 +300、折返空档 -1500、跨大类 -1200、同大类跨细分 -200；重点评审类别（B2重大变化 / C2跟踪行动）主任委员优先 +2000；超时自动递补 30 分钟；手动轮换防挑人上限 2 次。',
      timestamp: new Date(baseTs.getTime()).toISOString(),
    }),
  ];

  const matchedPm1 = meetings[4];
  auditLogs = [
    ...auditLogs,
    createAuditLogEntry(auditLogs, {
      actorRole: 'secretary',
      actorName: '信评委秘书处',
      actionType: 'AUTO_MATCHED',
      targetRef: matchedPm1.code,
      summary: `完成「${matchedPm1.projectName}」智能匹配（1召集人+5委员）`,
      details: `主选阵容：${matchedPm1.seats
        .map((s) => `${s.seatLabel}:${s.memberName}(${s.totalScore}分)`)
        .join('、')}；生成确定性备用队列（召集人备用 ${
        matchedPm1.convenerBackupQueue.length
      } 人，委员备用 ${matchedPm1.memberBackupQueue.length} 人）。`,
      timestamp: new Date(baseTs.getTime() + 8 * 60 * 1000).toISOString(),
    }),
  ];

  const confirmedNames = matchedPm1.seats
    .filter((s) => s.status === 'confirmed')
    .map((s) => s.memberName)
    .join('、');

  auditLogs = [
    ...auditLogs,
    createAuditLogEntry(auditLogs, {
      actorRole: 'member',
      actorName: confirmedNames || '苏婉清',
      actionType: 'MEMBER_CONFIRMED',
      targetRef: matchedPm1.code,
      summary: `${confirmedNames} 已在 30 分钟时限内确认出席`,
      details: `已锁定 2026-11-20 下午第1场（结构 · 企业资产支持专项计划）席位，将自动纳入同半天后续场次连续性及跨类别计算。`,
      timestamp: new Date(baseTs.getTime() + 14 * 60 * 1000).toISOString(),
    }),
  ];

  return {
    version: 1,
    referenceDate: '2026-11-20',
    simulatedClockIso: '2026-11-20T13:50:00',
    activeRole: 'secretary',
    activeSecretaryId: 'S001',
    activeMemberId: 'M002',
    config,
    secretaries,
    members,
    meetings,
    history,
    auditLogs,
  };
}
