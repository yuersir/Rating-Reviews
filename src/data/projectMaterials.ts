import {
  HALF_DAY_SLOTS,
  ModelFactorItem,
  ModelNotchItem,
  ProjectMaterials,
  RatingGrade,
  RatingOutlook,
  ReviewMeeting,
} from '../types/domain';

export const RATING_GRADES: RatingGrade[] = [
  'AAA',
  'AA+',
  'AA',
  'AA-',
  'A+',
  'A',
  'BBB+',
  'BBB',
];

export const RATING_OUTLOOKS: RatingOutlook[] = [
  '稳定',
  '正面',
  '负面',
  '列入信用评级观察名单',
];

export const SCORE_BANDS: Array<{ grade: RatingGrade; minScore: number; label: string }> = [
  { grade: 'AAA', minScore: 88, label: '≥ 88.0 分' },
  { grade: 'AA+', minScore: 80, label: '80.0 – 87.9 分' },
  { grade: 'AA', minScore: 72, label: '72.0 – 79.9 分' },
  { grade: 'AA-', minScore: 64, label: '64.0 – 71.9 分' },
  { grade: 'A+', minScore: 56, label: '56.0 – 63.9 分' },
  { grade: 'A', minScore: 48, label: '48.0 – 55.9 分' },
  { grade: 'BBB+', minScore: 40, label: '40.0 – 47.9 分' },
  { grade: 'BBB', minScore: 0, label: '< 40.0 分' },
];

export function scoreToIndicativeRating(score: number): RatingGrade {
  for (const band of SCORE_BANDS) {
    if (score >= band.minScore) return band.grade;
  }
  return 'BBB';
}

export function applyNotchAdjustment(
  baseRating: RatingGrade,
  notchDelta: number
): RatingGrade {
  const baseIdx = RATING_GRADES.indexOf(baseRating);
  if (baseIdx === -1) return baseRating;
  // Positive notchDelta upgrades rating (smaller index in RATING_GRADES)
  const targetIdx = Math.max(
    0,
    Math.min(RATING_GRADES.length - 1, baseIdx - Math.round(notchDelta))
  );
  return RATING_GRADES[targetIdx];
}

export function computeWeightedModelScore(
  factors: ModelFactorItem[],
  overrideScores?: Record<string, number>
): number {
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight <= 0) return 0;
  const weightedSum = factors.reduce((sum, f) => {
    const score =
      overrideScores && overrideScores[f.id] !== undefined
        ? overrideScores[f.id]
        : f.analystScore;
    return sum + score * f.weight;
  }, 0);
  return Number((weightedSum / totalWeight).toFixed(1));
}

// --- Voting Window Calculation (Meeting Start Time -> Next Day 17:30 Off-Duty) ---

export type VotingWindowStatus = 'before' | 'open' | 'closed';

export interface VotingWindowInfo {
  status: VotingWindowStatus;
  windowStartIso: string;
  windowEndIso: string;
  windowStartLabel: string;
  windowEndLabel: string;
  currentClockLabel: string;
  meetingSlotRangeLabel: string;
  isDuringMeetingSlot: boolean;
  statusLabel: string;
  detailText: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseLocalDateTime(isoLike: string): Date {
  // Expected format: YYYY-MM-DDTHH:mm(:ss)
  const clean = isoLike.replace(' ', 'T').slice(0, 19);
  const [datePart, timePart = '00:00:00'] = clean.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh = 0, mm = 0, ss = 0] = timePart.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh, mm, ss);
}

export function formatLocalDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

export function toLocalIsoString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:00`;
}

export function getMeetingWindowPresetClocks(meeting: ReviewMeeting) {
  const slotDef = HALF_DAY_SLOTS[meeting.halfDay].find(
    (s) => s.slotIndex === meeting.slotIndex
  );
  const [startHHMM = '09:00'] = (slotDef?.timeRange ?? '09:00-09:50').split('-');
  const startDt = parseLocalDateTime(`${meeting.date}T${startHHMM}:00`);

  const beforeDt = new Date(startDt.getTime() - 2 * 60 * 60 * 1000);
  const inMeetingDt = new Date(startDt.getTime() + 15 * 60 * 1000);

  const nextDayOpenDt = new Date(startDt.getTime());
  nextDayOpenDt.setDate(nextDayOpenDt.getDate() + 1);
  nextDayOpenDt.setHours(15, 0, 0, 0);

  const afterDeadlineDt = new Date(startDt.getTime());
  afterDeadlineDt.setDate(afterDeadlineDt.getDate() + 1);
  afterDeadlineDt.setHours(18, 0, 0, 0);

  return {
    beforeMeeting: toLocalIsoString(beforeDt),
    duringMeeting: toLocalIsoString(inMeetingDt),
    nextDayBeforeClose: toLocalIsoString(nextDayOpenDt),
    afterDeadline: toLocalIsoString(afterDeadlineDt),
  };
}

export function getVotingWindowInfo(
  meeting: ReviewMeeting,
  clockIso: string
): VotingWindowInfo {
  const slotDef = HALF_DAY_SLOTS[meeting.halfDay].find(
    (s) => s.slotIndex === meeting.slotIndex
  );
  const [startHHMM = '09:00', endHHMM = '09:50'] = (
    slotDef?.timeRange ?? '09:00-09:50'
  ).split('-');

  const windowStart = parseLocalDateTime(`${meeting.date}T${startHHMM}:00`);
  const slotEnd = parseLocalDateTime(`${meeting.date}T${endHHMM}:00`);

  // Closing deadline: next calendar day 17:30:00 (次日下班前)
  const windowEnd = new Date(windowStart.getTime());
  windowEnd.setDate(windowEnd.getDate() + 1);
  windowEnd.setHours(17, 30, 0, 0);

  const current = parseLocalDateTime(clockIso);
  const currentMs = current.getTime();
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();

  const windowStartLabel = formatLocalDateTime(windowStart);
  const windowEndLabel = formatLocalDateTime(windowEnd);
  const currentClockLabel = formatLocalDateTime(current);
  const meetingSlotRangeLabel = `${meeting.date} ${startHHMM}–${endHHMM}`;
  const isDuringMeetingSlot =
    currentMs >= startMs && currentMs <= slotEnd.getTime();

  if (currentMs < startMs) {
    const diffMins = Math.max(1, Math.round((startMs - currentMs) / 60000));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const waitText = hours > 0 ? `${hours} 小时 ${mins} 分钟` : `${mins} 分钟`;
    return {
      status: 'before',
      windowStartIso: toLocalIsoString(windowStart),
      windowEndIso: toLocalIsoString(windowEnd),
      windowStartLabel,
      windowEndLabel,
      currentClockLabel,
      meetingSlotRangeLabel,
      isDuringMeetingSlot: false,
      statusLabel: '未到开会时间（暂未开放表决）',
      detailText: `距离开会时间（${windowStartLabel}）尚有 ${waitText}。当前仅开放项目资料查阅与个人测算预演，开会后至次日 17:30 前可发表意见并投票。`,
    };
  }

  if (currentMs > endMs) {
    return {
      status: 'closed',
      windowStartIso: toLocalIsoString(windowStart),
      windowEndIso: toLocalIsoString(windowEnd),
      windowStartLabel,
      windowEndLabel,
      currentClockLabel,
      meetingSlotRangeLabel,
      isDuringMeetingSlot: false,
      statusLabel: '表决窗口已截止（已过次日 17:30）',
      detailText: `本场评审会意见发表及表决已于 ${windowEndLabel}（会后次日下班时间）自动关闭，当前仅支持只读查阅资料与已提交表决记录。`,
    };
  }

  const remainMins = Math.max(1, Math.round((endMs - currentMs) / 60000));
  const remHours = Math.floor(remainMins / 60);
  const remM = remainMins % 60;

  return {
    status: 'open',
    windowStartIso: toLocalIsoString(windowStart),
    windowEndIso: toLocalIsoString(windowEnd),
    windowStartLabel,
    windowEndLabel,
    currentClockLabel,
    meetingSlotRangeLabel,
    isDuringMeetingSlot,
    statusLabel: isDuringMeetingSlot
      ? '开会时段内 · 意见发表与表决开放中'
      : '会后次日下班前 · 意见发表与表决开放中',
    detailText: `当前处于有效操作窗口内（${windowStartLabel} 至 ${windowEndLabel}），距次日下班截止剩余 ${remHours} 小时 ${remM} 分钟。`,
  };
}

// --- Deterministic Rich Institutional Project Materials Generator ---

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getProjectMaterials(meeting: ReviewMeeting): ProjectMaterials {
  const seed = hashSeed(`${meeting.code}-${meeting.issuer}-${meeting.subCategory}`);
  const isActionOrMajor =
    meeting.reviewType === 'B2' || meeting.reviewType === 'C2';
  const isNegativeRisk = meeting.reviewType === 'C2';
  const isWatchRisk = meeting.reviewType === 'C1';

  const scoreOffset = isNegativeRisk
    ? -11
    : isWatchRisk
    ? -4
    : meeting.reviewType === 'B2'
    ? -2
    : (seed % 5) - 1;

  if (meeting.majorCategory === '城投') {
    const isProvincial = meeting.subCategory === '省级及高信用城投';
    const baseShift = isProvincial ? 5 : meeting.subCategory === '地市级城投' ? 0 : -6;
    const factors: ModelFactorItem[] = [
      {
        id: 'f1',
        dimension: '区域经济与财政实力',
        factorName: '所在区域 GDP 增速与一般公共预算自给率',
        weight: 25,
        rawMetric: isProvincial
          ? '区域 GDP 4.86 万亿 · 财政自给率 82.4%'
          : '区域 GDP 6,420 亿 · 财政自给率 64.8%',
        analystScore: Math.min(96, Math.max(45, 84 + baseShift + scoreOffset)),
        basisNote:
          '依据最新区域统计公报及财政决算报告核验，税收收入占比稳定在 72% 以上，转移支付结构稳健。',
      },
      {
        id: 'f2',
        dimension: '平台地位与业务专营性',
        factorName: '核心公益基础设施承建份额与政府注资记录',
        weight: 25,
        rawMetric: isProvincial
          ? '省级干线交通核心平台 · 公益资产占比 78%'
          : '市级核心片区开发与公用运营平台 · 占比 68%',
        analystScore: Math.min(95, Math.max(48, 82 + baseShift + scoreOffset)),
        basisNote:
          '已核验政府授权文件及近三年专项债/资本金注入流水，核心业务具备较强区域排他性。',
      },
      {
        id: 'f3',
        dimension: '资本结构与债务负担',
        factorName: '全部债务资本化比率及短期债务占比',
        weight: 20,
        rawMetric: '资产负债率 61.8% · 短期有息债务占比 26.4%',
        analystScore: Math.min(92, Math.max(42, 74 + baseShift + scoreOffset)),
        basisNote:
          '扣除专项债对应资产后调整负债率处于同级城投中位水平，2027 年存在一定集中回售压力。',
      },
      {
        id: 'f4',
        dimension: '流动性与再融资能力',
        factorName: '非受限货币资金/短期债务及银行授信余额',
        weight: 18,
        rawMetric: '现金短债比 0.94x · 未使用授信 218.5 亿元',
        analystScore: Math.min(92, Math.max(40, 76 + baseShift + scoreOffset)),
        basisNote:
          '政策性银行及国有大行授信覆盖率高，但应收政府部门款项回款周期较上年拉长 42 天。',
      },
      {
        id: 'f5',
        dimension: '或有负债与公司治理',
        factorName: '对外担保比率、非标融资占比及信息披露规范度',
        weight: 12,
        rawMetric: '对外担保/净资产 14.2% · 非标占比 4.1%',
        analystScore: Math.min(94, Math.max(45, 79 + baseShift + scoreOffset)),
        basisNote:
          '对外担保对象均为区域内国有平台，未发现重大失信被执行或商票逾期记录。',
      },
    ];

    const notchItems: ModelNotchItem[] = [
      {
        id: 'n1',
        label: '外部政府支持提升',
        delta: isProvincial ? 1 : 0,
        rationale: isProvincial
          ? '作为省级核心基础设施投资主体，在债务化解与资本金补充中具备显著协同支持。'
          : '区域政府支持能力与意愿已在基准指标中充分体现，暂不额外上调子级。',
      },
      {
        id: 'n2',
        label: isActionOrMajor ? '专项重大事项/流动性调整' : '常规治理微调',
        delta: isNegativeRisk ? -1 : 0,
        rationale: isNegativeRisk
          ? '因近期再融资成本抬升及回款滞后，模型审慎触发 -1 子级压力修正。'
          : '无额外触发负面调整条款。',
      },
    ];

    const baseScore = computeWeightedModelScore(factors);
    const baseRating = scoreToIndicativeRating(baseScore);
    const totalNotch = notchItems.reduce((s, n) => s + n.delta, 0);
    const finalRating = applyNotchAdjustment(baseRating, totalNotch);
    const outlook: RatingOutlook = isNegativeRisk
      ? '负面'
      : isWatchRisk
      ? '列入信用评级观察名单'
      : '稳定';

    return {
      meetingId: meeting.id,
      reportCode: `RPT-${meeting.code}`,
      reportVersion: 'V2.1（上会审定稿）',
      generatedAt: `${meeting.date} 08:15`,
      analysts: ['高明哲（主评）', '林晓桐（协评）'],
      methodologyName: '地方基础设施投融资企业信用评级方法（2026修订版）',
      issuanceScale: isProvincial ? '人民币 20.00 亿元' : '人民币 10.00 亿元',
      tenor: '3+2 年期（附第 3 年末调整票面利率选择权）',
      proposedRating: finalRating,
      proposedOutlook: outlook,
      executiveSummary: `${meeting.issuer}系区域内核心${meeting.subCategory}投融资与运营主体，资产规模持续扩张且公益属性明确。结合近三年审计报告及现场尽调核查，项目组测算模型基准得分为 ${baseScore.toFixed(
        1
      )} 分（对应基础级别 ${baseRating}），叠加外部支持与专项修正（${
        totalNotch >= 0 ? `+${totalNotch}` : totalNotch
      } 子级）后，建议评定本次主体及债项级别为 ${finalRating}，评级展望为「${outlook}」。${
        meeting.reviewTriggerNote ? `本次重点复核事项：${meeting.reviewTriggerNote}。` : ''
      }`,
      creditStrengths: [
        '区域经济基础扎实，财政收入结构以税收为主，对核心城投平台持续给予资本金注入与补贴支持。',
        '业务专营性强，在建与已完工公益性基础设施项目权属清晰，政府回购协议要素完备。',
        '融资渠道畅通，国有大型商业银行及政策性银行授信储备充足，直接融资利率保持同级较优水平。',
      ],
      creditConcerns: [
        '在建重点项目后续资本开支规模较大，资产负债率及全部债务规模存在进一步攀升压力。',
        '存货及应收政府部门款项占总资产比重较高，资产流动性偏弱，回款进度易受区域财政节奏影响。',
        '2027 年下半年度面临公开市场债券集中到期与回售，需关注提前再融资接续安排。',
      ],
      financialMetrics: [
        {
          indicator: '资产总额',
          unit: '亿元',
          y2024: isProvincial ? '1,842.6' : '618.4',
          y2025: isProvincial ? '2,015.3' : '679.2',
          y2026Q3: isProvincial ? '2,134.8' : '712.6',
          trendNote: '稳步扩张，基建资产持续转固',
        },
        {
          indicator: '资产负债率',
          unit: '%',
          y2024: '59.4',
          y2025: '60.9',
          y2026Q3: '61.8',
          trendNote: '小幅抬升但可控',
        },
        {
          indicator: '全部有息债务',
          unit: '亿元',
          y2024: isProvincial ? '812.0' : '278.5',
          y2025: isProvincial ? '905.4' : '314.2',
          y2026Q3: isProvincial ? '968.2' : '336.9',
          trendNote: '以长期银行借款及债券为主',
        },
        {
          indicator: '非受限现金 / 短期债务',
          unit: '倍',
          y2024: '1.08',
          y2025: '0.99',
          y2026Q3: '0.94',
          trendNote: '略低于 1.0x，需结合授信覆盖评估',
        },
        {
          indicator: '经营性净现金流',
          unit: '亿元',
          y2024: '18.4',
          y2025: '14.2',
          y2026Q3: '9.6',
          trendNote: '受项目回款节奏影响呈季节性波动',
        },
      ],
      workingPapers: [
        {
          id: 'wp-1',
          code: `WP-${meeting.code}-01`,
          title: '管理层现场尽调访谈纪要与区域财政核查底稿',
          category: '尽职调查',
          preparedBy: '高明哲',
          reviewedBy: '赵启明（质量复核）',
          verifiedDate: '2026-11-17',
          status: '已复核通过',
          summary:
            '实地访谈发行人财务总监及区域国资办相关负责人，核对 2024–2026 年专项债额度及隐性债务置换进展。',
          keyFindings: [
            '截至 2026 年 9 月末，公司存量高息非标融资已压降至 4.1%，综合融资成本同比下降 38bp。',
            '财政部门已明确 2026Q4 拨付前期棚改及交通代建回款 12.6 亿元，相关预算批文已归档。',
          ],
          rawExcerpt:
            '【尽调核查摘录】核对财政局预算执行科出具的《2026年度基础设施代建结算资金拨付计划表》原件，确认前五大在建工程均已纳入本级中长期财政规划，不存在未批先建或违规举债情形。',
        },
        {
          id: 'wp-2',
          code: `WP-${meeting.code}-02`,
          title: '有息债务到期分布、银行授信及受限资产明细底稿',
          category: '债务与现金流',
          preparedBy: '林晓桐',
          reviewedBy: '赵启明（质量复核）',
          verifiedDate: '2026-11-18',
          status: '重点关注提示',
          summary:
            '逐笔核对 2026Q4 至 2028 年公开债与银行借款到期台账，检验极端无新增债券发行下的流动性缓冲。',
          keyFindings: [
            '2027 年到期及面临回售的公开市场债券合计 42.0 亿元，占存续债券余额的 31.5%。',
            '受限资产合计占净资产 19.6%，主要为收费权质押及项目贷款抵押土地，剩余可抵质押资产充足。',
          ],
          rawExcerpt:
            '【压力核查提示】若 2027 年公开债滚续比例降至 70%，需动用约 12.6 亿元银行流动资金授信补足缺口；目前四大行及国开行尚未使用的综合授信余额 218.5 亿元，流动性安全边际整体可控。',
        },
        {
          id: 'wp-3',
          code: `WP-${meeting.code}-03`,
          title: '对外担保、涉诉仲裁及征信合规核查底稿',
          category: '法律与合规',
          preparedBy: '林晓桐',
          reviewedBy: '赵启明（质量复核）',
          verifiedDate: '2026-11-18',
          status: '已复核通过',
          summary:
            '查验人行企业征信报告（2026年11月版）、中国执行信息公开网及上海票据交易所披露信息。',
          keyFindings: [
            '人行企业征信记录正常，无关注类/不良类贷款及欠息记录；近 24 个月无商票逾期。',
            '对外担保对象集中于区域内 3 家国有平台公司，未发现被担保方出现重大信用风险事件。',
          ],
          rawExcerpt:
            '【征信核验结论】已核对 2026 年 11 月 15 日打印版人行征信报告及法律顾问出具的《无重大未决诉讼说明》，未发现对本期偿债能力构成实质威胁的或有负债。',
        },
      ],
      modelName: '城投主体信用打分卡模型',
      modelVersion: 'v3.4（2026 合规备案版）',
      modelFactors: factors,
      modelNotchItems: notchItems,
      analystBaseScore: baseScore,
      analystBaseRating: baseRating,
      analystFinalRating: finalRating,
    };
  }

  if (meeting.majorCategory === '结构') {
    const isREITs = meeting.subCategory === 'REITs与不动产结构化';
    const factors: ModelFactorItem[] = [
      {
        id: 'f1',
        dimension: '基础资产信用质量',
        factorName: isREITs
          ? '底层不动产区位、出租率与租户行业分散度'
          : '入池资产加权信用等级、分散度与历史违约表现',
        weight: 30,
        rawMetric: isREITs
          ? '加权出租率 93.4% · 前五大租户占比 24.8%'
          : '入池笔数 486 笔 · 前五大承租人集中度 16.2%',
        analystScore: Math.min(96, Math.max(48, 84 + scoreOffset)),
        basisNote:
          '对底层资产进行逐笔/抽样核验，历史 3 年逾期率及租金收缴率均优于行业基准中位数。',
      },
      {
        id: 'f2',
        dimension: '现金流压力测试覆盖',
        factorName: '优先级本息压力情景覆盖倍数（DSCR / 超额利差）',
        weight: 28,
        rawMetric: isREITs
          ? 'EBITDA 利息覆盖 4.6x · 压力租金-15%仍足额覆盖'
          : '优先 A 级违约倍数 4.2x · 超额利差 1.85%',
        analystScore: Math.min(95, Math.max(46, 86 + scoreOffset)),
        basisNote:
          '在违约率上浮 2.5 倍、回收率打 7 折且回收期延后 6 个月组合压力下，优先级本息可实现全额兑付。',
      },
      {
        id: 'f3',
        dimension: '交易结构与信用增级',
        factorName: '优先/次级分层厚度、加速清偿及违约触发机制',
        weight: 20,
        rawMetric: '次级档厚度 14.5% · 设资金混同储备账户',
        analystScore: Math.min(96, Math.max(50, 85 + scoreOffset)),
        basisNote:
          '设置严密的信用触发事件（累计违约率 > 3.0% 触发加速清偿）及流动性支持条款。',
      },
      {
        id: 'f4',
        dimension: '参与机构履约能力',
        factorName: '原始权益人/资产服务机构运营能力与后备接管安排',
        weight: 12,
        rawMetric: '资产服务机构主体 AA+ · 已设后备服务机构触发条款',
        analystScore: Math.min(92, Math.max(48, 80 + scoreOffset)),
        basisNote:
          '核验资产服务机构过往已发行产品兑付表现及风控系统隔离能力，运营记录良好。',
      },
      {
        id: 'f5',
        dimension: '法律破产隔离与抵销风险',
        factorName: '真实出售效力、权利完善事件与资金归集频率',
        weight: 10,
        rawMetric: 'T+1 资金转付监管户 · 律师出具无保留破产隔离意见',
        analystScore: Math.min(94, Math.max(50, 83 + scoreOffset)),
        basisNote:
          '现金流归集路径清晰，账户监管协议对混同风险和抵销风险提供了充分缓释。',
      },
    ];

    const notchItems: ModelNotchItem[] = [
      {
        id: 'n1',
        label: '优先档超额信用保护微调',
        delta: meeting.reviewType === 'A' ? 1 : 0,
        rationale:
          meeting.reviewType === 'A'
            ? '本期优先 A 级次级厚度及储备金设置显著高于同类型基准，结构保护充分。'
            : '结构保护已在现金流压力测试维度充分反映。',
      },
      {
        id: 'n2',
        label: isActionOrMajor ? '扩募/资产池变动专项校准' : '常规结构校核',
        delta: isNegativeRisk ? -1 : 0,
        rationale: isActionOrMajor
          ? '针对新纳入底层资产的爬坡期空置率风险进行了审慎情景校核。'
          : '无额外扣分项。',
      },
    ];

    const baseScore = computeWeightedModelScore(factors);
    const baseRating = scoreToIndicativeRating(baseScore);
    const totalNotch = notchItems.reduce((s, n) => s + n.delta, 0);
    const finalRating = applyNotchAdjustment(baseRating, totalNotch);
    const outlook: RatingOutlook = isNegativeRisk ? '负面' : '稳定';

    return {
      meetingId: meeting.id,
      reportCode: `RPT-${meeting.code}`,
      reportVersion: 'V1.8（上会审定稿）',
      generatedAt: `${meeting.date} 08:30`,
      analysts: ['温知微（结构化主评）', '陆思远（量化建模）'],
      methodologyName: isREITs
        ? '基础设施公募 REITs 与不动产结构化信用评级方法（2026版）'
        : '企业资产支持证券（ABS/ABN）现金流压力与分层评级方法（2026版）',
      issuanceScale: isREITs ? '优先档/扩募规模 16.50 亿元' : '优先 A 级 8.55 亿元 / 次级 1.45 亿元',
      tenor: isREITs ? '存续期 25 年' : '加权平均期限 1.82 年（法定到期 3.5 年）',
      proposedRating: finalRating,
      proposedOutlook: outlook,
      executiveSummary: `本项目以 ${meeting.issuer} 持有的${meeting.subCategory}底层资产现金流为偿付来源，通过优先/次级分层（次级占比 14.5%）、超额利差及储备账户形成多层信用增级。蒙特卡洛与确定性压力模型测算综合得分为 ${baseScore.toFixed(
        1
      )} 分（对应基础级别 ${baseRating}），综合结构修正（${
        totalNotch >= 0 ? `+${totalNotch}` : totalNotch
      } 子级）后，建议评定优先级证券信用等级为 ${finalRating}，展望「${outlook}」。`,
      creditStrengths: [
        '基础资产池高度分散且历史违约率低，底层债务人行业及区域集中度均控制在警戒线以内。',
        '次级档信用支持厚度叠加超额利差与现金储备账户，能抵御 2.5 倍以上历史违约率冲击。',
        '设置了加速清偿、违约事件及资金混同风险缓释条款，现金流归集路径清晰透明。',
      ],
      creditConcerns: [
        '宏观经济周期波动可能引起底层资产提前偿付率（CPR）或空置率上升，压缩超额利差空间。',
        '若资产服务机构发生信用恶化，虽设有后备接管条款，但交接窗口期仍存在短期操作摩擦风险。',
        '需持续跟踪前十大底层债务人/主力租户的续约稳定性及关联集中度变化。',
      ],
      financialMetrics: [
        {
          indicator: '入池资产本金/估值余额',
          unit: '亿元',
          y2024: '9.12',
          y2025: '9.86',
          y2026Q3: '10.00',
          trendNote: '静态/扩募资产池封包完毕',
        },
        {
          indicator: '加权平均收益率 / NOI 率',
          unit: '%',
          y2024: '6.45',
          y2025: '6.28',
          y2026Q3: '6.15',
          trendNote: '较优先档预期票面保留充足超额利差',
        },
        {
          indicator: '历史年化违约率 / 空置率',
          unit: '%',
          y2024: '0.82',
          y2025: '0.91',
          y2026Q3: '0.88',
          trendNote: '低于同业静态池平均水平',
        },
        {
          indicator: '优先档压力覆盖倍数',
          unit: '倍',
          y2024: '4.10',
          y2025: '4.15',
          y2026Q3: '4.22',
          trendNote: '满足 AAA/AA+ 档位目标压力倍数',
        },
        {
          indicator: '次级档厚度占比',
          unit: '%',
          y2024: '14.0',
          y2025: '14.5',
          y2026Q3: '14.5',
          trendNote: '劣后吸收损失垫厚实',
        },
      ],
      workingPapers: [
        {
          id: 'wp-1',
          code: `WP-${meeting.code}-01`,
          title: '基础资产池全量数据校验与抽样尽职调查底稿',
          category: '资产池与结构',
          preparedBy: '温知微',
          reviewedBy: '许敬尧（结构化质控）',
          verifiedDate: '2026-11-17',
          status: '已复核通过',
          summary:
            '对入池合同、抵质押登记证明及历史回款流水进行 100% 逻辑核验与 15% 重点大额抽样复核。',
          keyFindings: [
            '抽样合同要素与封包台账一致率 100%，未发现逾期超过 30 天资产混入资产池。',
            '最大单一债务人/租户占比 4.2%，满足入池标准不超过 5% 的硬性约束。',
          ],
          rawExcerpt:
            '【抽样尽调摘录】对前 30 大入池资产原件及租金/租金银行回单逐笔核对，确认底层贸易/租赁背景真实，无关联方循环交易特征。',
        },
        {
          id: 'wp-2',
          code: `WP-${meeting.code}-02`,
          title: '现金流瀑布与 12 组组合压力情景测算底稿',
          category: '债务与现金流',
          preparedBy: '陆思远',
          reviewedBy: '许敬尧（结构化质控）',
          verifiedDate: '2026-11-18',
          status: '重点关注提示',
          summary:
            '构建违约率（1x–3x）、回收率（30%–60%）、违约时间分布（前置/均匀/后置）组合矩阵检验兑付能力。',
          keyFindings: [
            '在「前置违约 + 违约率 2.5 倍 + 回收延迟 6 个月」组合压力下，优先档本息实现 100% 覆盖。',
            '若早偿率（CPR）同时升至 18% 以上，超额利差缓冲将收窄约 42bp，需保持监控。',
          ],
          rawExcerpt:
            '【量化引擎摘录】10,000 次蒙特卡洛模拟显示，优先 A 级在 99.5% 置信度下预期损失率低于 0.04%，达到高信用等级门槛。',
        },
        {
          id: 'wp-3',
          code: `WP-${meeting.code}-03`,
          title: '破产隔离法律意见与资金归集监管核查底稿',
          category: '法律与合规',
          preparedBy: '温知微',
          reviewedBy: '许敬尧（结构化质控）',
          verifiedDate: '2026-11-18',
          status: '已复核通过',
          summary:
            '复核专项法律意见书、标准条款及监管银行协议，验证资金混同与抵销风险缓释机制。',
          keyFindings: [
            '法律意见书明确资产转让构成有效真实出售，具备对抗原始权益人破产风险的隔离效力。',
            '设定资产服务机构主体级别低于 AA 时触发资金按日转付及权利完善通知机制。',
          ],
          rawExcerpt:
            '【法律核查结论】专项计划账户与监管银行三方协议均已落实闭环划转条款，法律结构合规完备。',
        },
      ],
      modelName: '结构化现金流压力与分层测算模型',
      modelVersion: 'v2.8（蒙特卡洛 + 压力矩阵）',
      modelFactors: factors,
      modelNotchItems: notchItems,
      analystBaseScore: baseScore,
      analystBaseRating: baseRating,
      analystFinalRating: finalRating,
    };
  }

  // Default: 工商金融
  const isBank = meeting.subCategory === '银行与非银金融';
  const factors: ModelFactorItem[] = [
    {
      id: 'f1',
      dimension: '行业景气与市场地位',
      factorName: isBank
        ? '区域市场份额、网点沉淀与特许经营壁垒'
        : '细分行业周期位置、市占率及上下游议价能力',
      weight: 22,
      rawMetric: isBank
        ? '核心存贷款市占率 11.4% · 零售存款占比 54%'
        : '核心产品国内市占率前三 · 产能利用率 86.5%',
      analystScore: Math.min(95, Math.max(40, 81 + scoreOffset)),
      basisNote:
        '依据行业协会统计及同业对比，主体在核心细分市场具备较强技术或渠道护城河。',
    },
    {
      id: 'f2',
      dimension: '盈利能力与经营效率',
      factorName: isBank
        ? '净息差（NIM）、拨备前利润及 ROA 表现'
        : 'EBITDA 利润率、毛利率稳定性及 ROE',
      weight: 22,
      rawMetric: isBank
        ? '净息差 1.72% · ROA 0.84% · 成本收入比 31.2%'
        : '综合毛利率 21.8% · EBITDA 利润率 16.4%',
      analystScore: Math.min(94, Math.max(38, 76 + scoreOffset)),
      basisNote:
        '近一年受原材料价格/息差收窄影响盈利承压，但成本管控与高毛利新品放量形成对冲。',
    },
    {
      id: 'f3',
      dimension: '资本充足 / 财务杠杆',
      factorName: isBank
        ? '核心一级资本充足率与拨备覆盖率'
        : '全部债务 / EBITDA 与资产负债率',
      weight: 24,
      rawMetric: isBank
        ? '核心一级资本充足率 10.65% · 拨备覆盖率 248%'
        : '资产负债率 58.6% · 全部债务/EBITDA 4.3x',
      analystScore: Math.min(95, Math.max(36, 75 + scoreOffset)),
      basisNote:
        '财务杠杆处于行业合理区间，但若下游需求继续走弱将推高债务/EBITDA 指标。',
    },
    {
      id: 'f4',
      dimension: '现金流与短期流动性',
      factorName: isBank
        ? '流动性覆盖率（LCR）与同业负债依存度'
        : '经营性现金流 / 短期债务及货币资金覆盖率',
      weight: 20,
      rawMetric: isBank
        ? 'LCR 146.2% · 不良贷款率 1.18%'
        : '经营现金流/短债 0.72x · 非受限现金 38.4 亿',
      analystScore: Math.min(93, Math.max(35, 74 + scoreOffset)),
      basisNote:
        isNegativeRisk
          ? '近期应收账款账期拉长叠加部分债务展期协商，短期流动性承压明显。'
          : '经营现金流保持净流入，银行授信余额充裕，短期偿债覆盖度尚可。',
    },
    {
      id: 'f5',
      dimension: '公司治理与风险管理',
      factorName: '股权结构稳定性、内控合规及资本支出纪律',
      weight: 12,
      rawMetric: '实控人股权质押率 0% · 近三年无重大监管处罚',
      analystScore: Math.min(94, Math.max(42, 80 + scoreOffset)),
      basisNote:
        '治理架构规范，重大投资决策履行董事会及风控委审批程序。',
    },
  ];

  const notchItems: ModelNotchItem[] = [
    {
      id: 'n1',
      label: isBank ? '区域系统重要性外部支持' : '股东及产业协同支持',
      delta: isBank ? 1 : 0,
      rationale: isBank
        ? '作为区域重点法人银行，在资本补充与流动性支持方面具备较强地方协同背书。'
        : '按独立个体信用实力评估，暂不计入额外股东上调子级。',
    },
    {
      id: 'n2',
      label: isNegativeRisk ? '信用事件/展期预警下调' : '流动性与事件校核',
      delta: isNegativeRisk ? -2 : isWatchRisk ? -1 : 0,
      rationale: isNegativeRisk
        ? '因下游核心订单显著萎缩且触发债务展期条款，依据评级纪律触发 -2 子级下调修正。'
        : isWatchRisk
        ? '考虑周期原材料价格波动对现金流的扰动，审慎下调 1 个子级。'
        : '无额外事件扣分。',
    },
  ];

  const baseScore = computeWeightedModelScore(factors);
  const baseRating = scoreToIndicativeRating(baseScore);
  const totalNotch = notchItems.reduce((s, n) => s + n.delta, 0);
  const finalRating = applyNotchAdjustment(baseRating, totalNotch);
  const outlook: RatingOutlook = isNegativeRisk
    ? '负面'
    : isWatchRisk
    ? '列入信用评级观察名单'
    : '稳定';

  return {
    meetingId: meeting.id,
    reportCode: `RPT-${meeting.code}`,
    reportVersion: 'V2.0（上会审定稿）',
    generatedAt: `${meeting.date} 08:20`,
    analysts: ['沈柏舟（工商金融主评）', '许宁远（财务核查）'],
    methodologyName: isBank
      ? '商业银行与非银金融机构主体及资本工具评级方法（2026版）'
      : '工商企业定量财务与行业竞争信用评级方法（2026版）',
    issuanceScale: isBank ? '人民币 30.00 亿元' : '人民币 12.00 亿元',
    tenor: isBank ? '5+5 年期（二级资本工具）' : '3 年期',
    proposedRating: finalRating,
    proposedOutlook: outlook,
    executiveSummary: `${meeting.issuer}为${meeting.subCategory}细分领域重要企业。结合 2024–2026Q3 财务核查及尽调工作底稿，定量与定性模型测算基准得分 ${baseScore.toFixed(
      1
    )} 分（对应基础级别 ${baseRating}），经外部支持及专项事件修正（${
      totalNotch >= 0 ? `+${totalNotch}` : totalNotch
    } 子级）后，项目组建议评定级别为 ${finalRating}，展望「${outlook}」。${
      meeting.reviewTriggerNote ? `本次上会触发背景：${meeting.reviewTriggerNote}。` : ''
    }`,
    creditStrengths: [
      isBank
        ? '区域零售存款基础稳固，核心一级资本充足率与拨备覆盖率高于监管基准。'
        : '细分产品技术积累深厚，头部客户合作粘性高，核心产能布局完善。',
      '公司治理架构清晰，财务披露透明，未发生重大监管处罚或关联方资金占用。',
      '存量授信结构以主流商业银行为主，具备一定资产变现与再融资腾挪空间。',
    ],
    creditConcerns: [
      isNegativeRisk
        ? '核心下游订单大幅下滑并伴随债务展期协商，短期流动性与偿债能力面临严峻考验。'
        : '行业周期波动及原材料/息差压力对毛利率和经营性现金流形成持续扰动。',
      '资本开支及存货/应收款占用资金规模较大，自由现金流阶段性承压。',
      '需持续关注未来 12 个月集中到期债务的偿付资金落实及再融资成本变化。',
    ],
    financialMetrics: [
      {
        indicator: '营业总收入',
        unit: '亿元',
        y2024: '148.6',
        y2025: '162.3',
        y2026Q3: isNegativeRisk ? '94.2' : '126.8',
        trendNote: isNegativeRisk ? '前三季度同比下滑 18.4%' : '保持温和增长',
      },
      {
        indicator: isBank ? '拨备前利润' : 'EBITDA',
        unit: '亿元',
        y2024: '26.4',
        y2025: '28.1',
        y2026Q3: isNegativeRisk ? '13.5' : '21.7',
        trendNote: isNegativeRisk ? '盈利收缩明显' : '盈利韧性尚可',
      },
      {
        indicator: isBank ? '不良贷款率' : '资产负债率',
        unit: '%',
        y2024: isBank ? '1.14' : '56.2',
        y2025: isBank ? '1.16' : '57.8',
        y2026Q3: isBank ? '1.18' : isNegativeRisk ? '64.9' : '58.6',
        trendNote: isNegativeRisk ? '杠杆快速抬升需重点提示' : '处于同业中枢区间',
      },
      {
        indicator: isBank ? '拨备覆盖率' : '全部债务 / EBITDA',
        unit: isBank ? '%' : '倍',
        y2024: isBank ? '254.0' : '3.8',
        y2025: isBank ? '251.2' : '4.1',
        y2026Q3: isBank ? '248.0' : isNegativeRisk ? '6.4' : '4.3',
        trendNote: isNegativeRisk ? '显著突破 5.0x 预警线' : '整体处于可控区间',
      },
      {
        indicator: isBank ? '流动性覆盖率 LCR' : '非受限货币资金 / 短债',
        unit: isBank ? '%' : '倍',
        y2024: isBank ? '149.5' : '1.12',
        y2025: isBank ? '147.8' : '0.96',
        y2026Q3: isBank ? '146.2' : isNegativeRisk ? '0.52' : '0.88',
        trendNote: isNegativeRisk ? '短期资金缺口显著' : '结合未用授信可覆盖短期兑付',
      },
    ],
    workingPapers: [
      {
        id: 'wp-1',
        code: `WP-${meeting.code}-01`,
        title: '核心业务运营、订单/资产质量及行业对标尽调底稿',
        category: '尽职调查',
        preparedBy: '沈柏舟',
        reviewedBy: '周远山（行业质控）',
        verifiedDate: '2026-11-17',
        status: isNegativeRisk ? '重点关注提示' : '已复核通过',
        summary:
          '对主要生产基地/分支机构进行实地尽调，核验前十大客户合同、产能利用率及行业对标数据。',
        keyFindings: [
          isNegativeRisk
            ? '前三大核心客户订单同比减少 31%，部分产线开工率降至 58%，回款账期延至 165 天。'
            : '前五大客户合作年限均超 5 年，核心产线开工率维持在 85% 以上，订单可见度良好。',
          '研发/数字化投入占营收比重保持 3.8%，产品结构持续向高附加值领域升级。',
        ],
        rawExcerpt:
          '【现场尽调摘录】已调阅 2026 年 1–10 月销售出库台账及增值税发票汇总表，确认收入确认政策与同业一致，无提前确认收入迹象。',
      },
      {
        id: 'wp-2',
        code: `WP-${meeting.code}-02`,
        title: '审计附注核查、有息债务结构与流动性压力测试底稿',
        category: '财务核查',
        preparedBy: '许宁远',
        reviewedBy: '周远山（行业质控）',
        verifiedDate: '2026-11-18',
        status: '重点关注提示',
        summary:
          '核查应收账款账龄结构、存货跌价准备计提充分性及未来 12 个月到期债务现金流缺口测算。',
        keyFindings: [
          '1 年以上应收账款占比同比上升 4.6 个百分点，已按账龄组合足额计提信用减值准备。',
          '在营收下滑 15% 的敏感性假设下，自由现金流覆盖利息倍数由 3.2x 降至 2.1x。',
        ],
        rawExcerpt:
          '【财务底稿摘录】核对银行对账单及受限存款明细，确认账面货币资金中 6.8 亿元为承兑汇票保证金，测算短债覆盖率时已全额扣除。',
      },
      {
        id: 'wp-3',
        code: `WP-${meeting.code}-03`,
        title: '关联交易、对外担保及信用舆情合规核查底稿',
        category: '法律与合规',
        preparedBy: '许宁远',
        reviewedBy: '周远山（行业质控）',
        verifiedDate: '2026-11-18',
        status: '已复核通过',
        summary:
          '全量扫描监管问询函、司法涉诉记录、债券估值偏离及环保/安全生产合规记录。',
        keyFindings: [
          '关联交易定价公允且均经股东大会/董事会审议披露，不存在控股股东非经营性资金占用。',
          '未发现重大环保停产或行政处罚事项，企业征信报告无不良记录。',
        ],
        rawExcerpt:
          '【合规核查结论】已完成裁判文书网、企查查风险扫描及债券二级估值追踪，相关风险提示均已完整纳入评级报告。',
      },
    ],
    modelName: isBank ? '商业银行与金融主体信用打分模型' : '工商企业信用定量与定性综合模型',
    modelVersion: 'v4.1（2026 审慎校准版）',
    modelFactors: factors,
    modelNotchItems: notchItems,
    analystBaseScore: baseScore,
    analystBaseRating: baseRating,
    analystFinalRating: finalRating,
  };
}
