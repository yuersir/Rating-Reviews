import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import {
  AuditActionType,
  AuditLogEntry,
  CommitteeMember,
  MAJOR_CATEGORIES,
  MajorCategory,
  REVIEW_TYPES,
  ReviewTypeCode,
  RoleType,
  RuleConfig,
} from '../../types/domain';
import {
  exportAuditLogsToCSV,
  triggerFileDownload,
  verifyAuditChain,
} from '../../engine/auditHash';

interface AdminWorkspaceProps {
  activeSubTab: 'rules' | 'chiefs' | 'audit';
  config: RuleConfig;
  members: CommitteeMember[];
  auditLogs: AuditLogEntry[];
  onUpdateConfig: (next: RuleConfig) => void;
  onResetConfig: () => void;
  onUpdateMemberGovernance: (
    memberId: string,
    updates: {
      active: boolean;
      canConvene: boolean;
      isChiefCommissioner: boolean;
      chiefCategories: MajorCategory[];
      conflictIssuers: string[];
    }
  ) => void;
}

const ACTION_LABELS: Record<AuditActionType, string> = {
  MEETING_CREATED: '新增评审需求',
  SCHEDULE_OPTIMIZED: '防折返排期优化',
  AUTO_MATCHED: '智能盲配执行',
  SECRETARY_REMINDER_SENT: '系统匿名催办',
  MANUAL_ROTATION: '秘书盲态轮换',
  TIMEOUT_AUTO_ROTATION: '30分钟超时递补',
  MEMBER_CONFIRMED: '委员确认出席',
  MEMBER_DECLINED: '委员回避退回',
  MEMBER_CALC_SAVED: '委员自行测算',
  MEMBER_VOTED: '委员评审表决',
  EXPERTISE_UPDATED: '专业顺位申报',
  AVAILABILITY_UPDATED: '可用时段变更',
  SIGNATURE_UPDATED: '默认电子签名设置',
  RULE_CONFIG_UPDATED: '规则参数调整',
  CHIEF_STATUS_UPDATED: '主任委员资格维护',
  SYSTEM_RESET: '沙箱数据重置',
};

const ROLE_LABELS: Record<RoleType, string> = {
  secretary: '信评委秘书',
  member: '信评委员',
  admin: '系统管理员',
};

export function AdminWorkspace({
  activeSubTab,
  config,
  members,
  auditLogs,
  onUpdateConfig,
  onResetConfig,
  onUpdateMemberGovernance,
}: AdminWorkspaceProps) {
  const [draftConfig, setDraftConfig] = useState<RuleConfig>(config);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editActive, setEditActive] = useState(true);
  const [editCanConvene, setEditCanConvene] = useState(false);
  const [editIsChief, setEditIsChief] = useState(false);
  const [editChiefCats, setEditChiefCats] = useState<MajorCategory[]>([]);
  const [editConflictsText, setEditConflictsText] = useState('');

  // Audit log filters & verification state
  const [auditSearch, setAuditSearch] = useState('');
  const [auditRoleFilter, setAuditRoleFilter] = useState<'ALL' | RoleType>('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState<
    'ALL' | AuditActionType
  >('ALL');
  const [verificationResult, setVerificationResult] = useState<ReturnType<
    typeof verifyAuditChain
  > | null>(null);

  useEffect(() => {
    setDraftConfig(config);
  }, [config]);

  const configDirty =
    JSON.stringify(draftConfig) !== JSON.stringify(config);

  const openMemberEdit = (m: CommitteeMember) => {
    setEditingMemberId(m.id);
    setEditActive(m.active);
    setEditCanConvene(m.canConvene);
    setEditIsChief(m.isChiefCommissioner);
    setEditChiefCats(m.chiefCategories);
    setEditConflictsText(m.conflictIssuers.join('、'));
  };

  const toggleChiefCat = (cat: MajorCategory) => {
    setEditChiefCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const saveMemberEdit = () => {
    if (!editingMemberId) return;
    const conflictIssuers = editConflictsText
      .split(/[、,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    onUpdateMemberGovernance(editingMemberId, {
      active: editActive,
      canConvene: editIsChief ? true : editCanConvene,
      isChiefCommissioner: editIsChief,
      chiefCategories: editIsChief ? editChiefCats : [],
      conflictIssuers,
    });
    setEditingMemberId(null);
  };

  const filteredLogs = useMemo(() => {
    return [...auditLogs]
      .reverse()
      .filter((log) => {
        if (auditRoleFilter !== 'ALL' && log.actorRole !== auditRoleFilter) {
          return false;
        }
        if (
          auditActionFilter !== 'ALL' &&
          log.actionType !== auditActionFilter
        ) {
          return false;
        }
        if (auditSearch.trim()) {
          const q = auditSearch.trim().toLowerCase();
          return (
            log.summary.toLowerCase().includes(q) ||
            log.details.toLowerCase().includes(q) ||
            log.actorName.toLowerCase().includes(q) ||
            log.targetRef.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [auditLogs, auditRoleFilter, auditActionFilter, auditSearch]);

  const handleExportCSV = () => {
    const csv = exportAuditLogsToCSV(auditLogs);
    triggerFileDownload(
      `信评委不可篡改审计日志_${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8;'
    );
  };

  const handleExportJSON = () => {
    const verification = verifyAuditChain(auditLogs);
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        chainIntegrity: verification,
        totalEntries: auditLogs.length,
        entries: auditLogs,
      },
      null,
      2
    );
    triggerFileDownload(
      `信评委不可篡改审计日志_${new Date().toISOString().slice(0, 10)}.json`,
      payload,
      'application/json;charset=utf-8;'
    );
  };

  // --- SUB-TAB 1: REAL-TIME RULE & SCORING CONFIG ---
  if (activeSubTab === 'rules') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              匹配规则与评分参数实时配置中心
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              所有参数保存后立即作用于智能匹配引擎与近 90 天集中度监测，变更前后差异将自动写入不可篡改审计链。
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onResetConfig}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              恢复合规默认值
            </button>
            <button
              type="button"
              disabled={!configDirty}
              onClick={() => onUpdateConfig(draftConfig)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              保存并实时生效
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Group 1: Concentration & Rotation Governance */}
          <div className="bg-white border border-slate-200 rounded-md p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                一、动态集中度红线与防挑人轮换治理
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                管控召集人领域集中度强制轮换、冷启动豁免、超时自动递补与手动重匹次数上限
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  滚动监测时间窗口（天）
                </label>
                <input
                  type="number"
                  min={30}
                  max={365}
                  value={draftConfig.concentrationWindowDays}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      concentrationWindowDays: Math.max(
                        30,
                        Number(e.target.value) || 90
                      ),
                    })
                  }
                  className="w-full px-3 py-2 font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  召集人单一领域集中度上限（%）
                </label>
                <input
                  type="number"
                  min={20}
                  max={100}
                  value={Math.round(draftConfig.convenerConcentrationCap * 100)}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      convenerConcentrationCap:
                        Math.min(100, Math.max(20, Number(e.target.value) || 60)) /
                        100,
                    })
                  }
                  className="w-full px-3 py-2 font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  冷启动保护阈值（场次）
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={draftConfig.coldStartThreshold}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      coldStartThreshold: Math.max(
                        1,
                        Number(e.target.value) || 3
                      ),
                    })
                  }
                  className="w-full px-3 py-2 font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  重点类别主任委员优先加分
                </label>
                <input
                  type="number"
                  step={100}
                  value={draftConfig.chiefPriorityBonus}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      chiefPriorityBonus: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  响应超时自动轮换时限（分钟）
                </label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={draftConfig.responseTimeoutMinutes}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      responseTimeoutMinutes: Math.max(
                        5,
                        Number(e.target.value) || 30
                      ),
                    })
                  }
                  className="w-full px-3 py-2 font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  单场秘书手动轮换上限（防挑人）
                </label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={draftConfig.maxManualRotations}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      maxManualRotations: Math.max(
                        0,
                        Number(e.target.value) || 0
                      ),
                    })
                  }
                  className="w-full px-3 py-2 font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="font-medium text-slate-700">
                触发主任委员优先匹配的评审类别（受 60% 集中度红线硬控）
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REVIEW_TYPES.map((rt) => {
                  const checked = draftConfig.chiefPriorityReviewTypes.includes(
                    rt.code
                  );
                  const toggleType = (code: ReviewTypeCode) => {
                    const nextTypes = checked
                      ? draftConfig.chiefPriorityReviewTypes.filter(
                          (c) => c !== code
                        )
                      : [...draftConfig.chiefPriorityReviewTypes, code];
                    setDraftConfig({
                      ...draftConfig,
                      chiefPriorityReviewTypes: nextTypes,
                    });
                  };
                  return (
                    <label
                      key={rt.code}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-[#EFF6FF] border-[#103D6B]/40 text-[#103D6B] font-medium'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleType(rt.code)}
                        className="rounded border-slate-300 text-[#103D6B]"
                      />
                      <span>{rt.fullLabel}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Group 2: Continuity, Anti-Backtracking & Expertise Weights */}
          <div className="bg-white border border-slate-200 rounded-md p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                二、半天连续性、防折返与跨类别评分权重
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                激励同半天同类连场，严厉惩戒折返空档与跨大类切换
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  同半天同细分领域加分
                </label>
                <input
                  type="number"
                  step={50}
                  value={draftConfig.sameHalfDaySameSubBonus}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      sameHalfDaySameSubBonus: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  紧邻时段无缝衔接加分
                </label>
                <input
                  type="number"
                  step={50}
                  value={draftConfig.adjacentSlotBonus}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      adjacentSlotBonus: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  出现折返空档罚分（负值）
                </label>
                <input
                  type="number"
                  step={50}
                  value={draftConfig.backtrackGapPenalty}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      backtrackGapPenalty: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  同半天跨大类降权（负值）
                </label>
                <input
                  type="number"
                  step={50}
                  value={draftConfig.crossMajorPenalty}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      crossMajorPenalty: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1.5">
                  同半天同大类跨细分罚分（负值）
                </label>
                <input
                  type="number"
                  step={50}
                  value={draftConfig.sameMajorCrossSubPenalty}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      sameMajorCrossSubPenalty: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-medium text-slate-700 mb-2">
                委员自主申报第 1 至第 5 专业顺位基础分
              </div>
              <div className="grid grid-cols-5 gap-2">
                {draftConfig.rankScores.map((score, idx) => (
                  <div key={idx}>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      第{idx + 1}顺位
                    </label>
                    <input
                      type="number"
                      value={score}
                      onChange={(e) => {
                        const next = [...draftConfig.rankScores] as [
                          number,
                          number,
                          number,
                          number,
                          number,
                        ];
                        next[idx] = Number(e.target.value) || 0;
                        setDraftConfig({ ...draftConfig, rankScores: next });
                      }}
                      className="w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- SUB-TAB 2: CHIEF COMMISSIONER & GOVERNANCE MAINTENANCE ---
  if (activeSubTab === 'chiefs') {
    const editingMember = members.find((m) => m.id === editingMemberId);

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                主任委员资格、召集人授权与利益回避名录维护
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                维护三大领域（城投 / 工商金融 / 结构）主任委员资格；重点评审类别（
                {config.chiefPriorityReviewTypes.join(' / ') || '暂未勾选'}
                ）项目将自动优先匹配至对应领域主任委员（+{config.chiefPriorityBonus} 分，仍受 60% 集中度上限硬控）。
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              主任委员 {members.filter((m) => m.isChiefCommissioner).length} 人 ·
              召集人 {members.filter((m) => m.canConvene).length} 人
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4">委员 / 工号</th>
                  <th className="py-3 px-4">部门与职务</th>
                  <th className="py-3 px-4">在岗状态</th>
                  <th className="py-3 px-4">召集人资格</th>
                  <th className="py-3 px-4">主任委员授权领域</th>
                  <th className="py-3 px-4">固定回避发行人</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{m.name}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {m.employeeCode}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>{m.title}</div>
                      <div className="text-[11px] text-slate-400">
                        {m.department}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={
                          m.active
                            ? 'text-[#15803D] font-medium'
                            : 'text-[#B91C1C] font-medium'
                        }
                      >
                        {m.active ? '在岗有效' : '暂停参评'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                      {m.canConvene ? '具备召集资格' : '普通委员'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {m.isChiefCommissioner ? (
                        <span className="font-semibold text-[#103D6B]">
                          主任委员 · {m.chiefCategories.join('、') || '未指派'}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {m.conflictIssuers.length > 0
                        ? m.conflictIssuers.join('、')
                        : '无'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openMemberEdit(m)}
                        className="px-3 py-1.5 text-xs font-medium text-[#103D6B] bg-white border border-slate-300 rounded hover:bg-[#EFF6FF]"
                      >
                        维护资格
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Governance Edit Modal */}
        {editingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-lg bg-white border border-slate-200 rounded-md shadow-lg p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  维护委员治理资格 · {editingMember.name}（
                  {editingMember.employeeCode}）
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  变更后立即生效于智能匹配引擎并写入不可篡改审计日志。
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="rounded border-slate-300 text-[#103D6B]"
                  />
                  <span className="font-medium text-slate-800">
                    委员在岗有效（取消勾选将前置硬过滤排除）
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsChief ? true : editCanConvene}
                    disabled={editIsChief}
                    onChange={(e) => setEditCanConvene(e.target.checked)}
                    className="rounded border-slate-300 text-[#103D6B]"
                  />
                  <span className="font-medium text-slate-800">
                    具备评审会召集人任职资格
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsChief}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setEditIsChief(next);
                      if (next) setEditCanConvene(true);
                    }}
                    className="rounded border-slate-300 text-[#103D6B]"
                  />
                  <span className="font-medium text-[#103D6B]">
                    授予专业领域主任委员资格（{config.chiefPriorityReviewTypes.join('/') || '重点类别'}项目 +
                    {config.chiefPriorityBonus} 分）
                  </span>
                </label>

                {editIsChief && (
                  <div className="pl-6 pt-1 space-y-1.5">
                    <div className="text-slate-600">选择分管主任委员大类：</div>
                    <div className="flex items-center gap-3">
                      {MAJOR_CATEGORIES.map((cat) => (
                        <label
                          key={cat}
                          className="inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={editChiefCats.includes(cat)}
                            onChange={() => toggleChiefCat(cat)}
                            className="rounded border-slate-300 text-[#103D6B]"
                          />
                          <span>{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <label className="block font-medium text-slate-700 mb-1.5">
                    固定利益冲突回避发行人（多个用顿号或逗号分隔）
                  </label>
                  <input
                    type="text"
                    value={editConflictsText}
                    onChange={(e) => setEditConflictsText(e.target.value)}
                    placeholder="例如：东海城建开发集团、北辰石化集团"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingMemberId(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={saveMemberEdit}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E]"
                >
                  保存资格变更
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- SUB-TAB 3: IMMUTABLE HASH-CHAINED AUDIT LOGS ---
  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-md p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            不可篡改链式审计日志台账
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            每条合规操作均绑定前序记录摘要哈希（prevHash → hash）形成防篡改链条，只读留痕，支持实时完整性核验与监管报告导出。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setVerificationResult(verifyAuditChain(auditLogs))}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#103D6B] bg-[#EFF6FF] border border-[#103D6B]/20 rounded hover:bg-[#DBEAFE] whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            校验哈希链完整性
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            导出 CSV
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            导出 JSON 凭证
          </button>
        </div>
      </div>

      {verificationResult && (
        <div
          className={`px-4 py-3 rounded-md border text-xs flex items-center justify-between gap-3 ${
            verificationResult.valid
              ? 'bg-emerald-50/70 border-emerald-200 text-[#15803D]'
              : 'bg-red-50 border-red-200 text-[#B91C1C]'
          }`}
        >
          <div className="flex items-center gap-2">
            {verificationResult.valid ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <ShieldX className="w-4 h-4 shrink-0" />
            )}
            <span className="font-medium">{verificationResult.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setVerificationResult(null)}
            className="text-xs underline opacity-80 hover:opacity-100 whitespace-nowrap"
          >
            关闭提示
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600 font-mono tabular-nums">
            审计链总长度：{auditLogs.length} 条 · 当前显示 {filteredLogs.length} 条
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="检索摘要、对象或操作人..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded w-52 focus:outline-none focus:border-[#103D6B]"
              />
            </div>

            <select
              value={auditRoleFilter}
              onChange={(e) =>
                setAuditRoleFilter(e.target.value as 'ALL' | RoleType)
              }
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
            >
              <option value="ALL">全部角色</option>
              <option value="secretary">信评委秘书</option>
              <option value="member">信评委员</option>
              <option value="admin">系统管理员</option>
            </select>

            <select
              value={auditActionFilter}
              onChange={(e) =>
                setAuditActionFilter(e.target.value as 'ALL' | AuditActionType)
              }
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
            >
              <option value="ALL">全部事件类型</option>
              {(Object.keys(ACTION_LABELS) as AuditActionType[]).map((k) => (
                <option key={k} value={k}>
                  {ACTION_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500">
                <th className="py-3 px-4">序号 / 时间</th>
                <th className="py-3 px-4">角色 / 操作人</th>
                <th className="py-3 px-4">事件类型 / 对象</th>
                <th className="py-3 px-4">操作摘要与合规明细</th>
                <th className="py-3 px-4 text-right">防篡改链式指纹</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    无符合筛选条件的审计日志记录。
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 align-top">
                    <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        #{log.seq} · {log.id}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(log.timestamp).toLocaleString('zh-CN', {
                          hour12: false,
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">
                        {ROLE_LABELS[log.actorRole]}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {log.actorName}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-[#103D6B]">
                        {ACTION_LABELS[log.actionType]}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {log.targetRef}
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <div className="font-medium text-slate-900">
                        {log.summary}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {log.details}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] whitespace-nowrap">
                      <div className="text-slate-700" title={log.hash}>
                        H: {log.hash.slice(0, 12)}…
                      </div>
                      <div className="text-slate-400 mt-0.5" title={log.prevHash}>
                        P: {log.prevHash.slice(0, 12)}…
                      </div>
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
