import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  KeyRound,
  Lock,
  RotateCcw,
  Shield,
  Users,
} from 'lucide-react';
import { AppState, RoleType } from '../../types/domain';
import { ADMIN_CREDENTIAL } from '../../data/seedData';

interface RolePortalGatewayProps {
  state: AppState;
  onEnterRole: (role: RoleType, identityId?: string) => void;
  onResetSandbox: () => void;
}

export function RolePortalGateway({
  state,
  onEnterRole,
  onResetSandbox,
}: RolePortalGatewayProps) {
  const [chosenSecretaryId, setChosenSecretaryId] = useState<string>(
    state.activeSecretaryId || state.secretaries[0]?.id || 'S001'
  );
  const [secretaryPin, setSecretaryPin] = useState('');
  const [secretaryError, setSecretaryError] = useState('');

  const [chosenMemberId, setChosenMemberId] = useState<string>(
    state.activeMemberId || state.members[0]?.id || 'M001'
  );
  const [memberPin, setMemberPin] = useState('');
  const [memberError, setMemberError] = useState('');

  const [adminPin, setAdminPin] = useState('');
  const [adminError, setAdminError] = useState('');

  const [confirmReset, setConfirmReset] = useState(false);

  const selectedSecretary =
    state.secretaries.find((s) => s.id === chosenSecretaryId) ??
    state.secretaries[0];
  const selectedMember =
    state.members.find((m) => m.id === chosenMemberId) ?? state.members[0];

  const handleSecretarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSecretary) return;
    if (secretaryPin.trim() !== selectedSecretary.credentialCode) {
      setSecretaryError(
        `身份凭证口令核验失败，请核对「${selectedSecretary.name}」的专属凭证口令。`
      );
      return;
    }
    setSecretaryError('');
    onEnterRole('secretary', selectedSecretary.id);
  };

  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    if (memberPin.trim() !== selectedMember.credentialCode) {
      setMemberError(
        `身份凭证口令核验失败，请核对「${selectedMember.name}」的专属凭证口令。`
      );
      return;
    }
    setMemberError('');
    onEnterRole('member', selectedMember.id);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin.trim() !== ADMIN_CREDENTIAL.credentialCode) {
      setAdminError('系统管理员凭证口令核验失败，请重新输入。');
      return;
    }
    setAdminError('');
    onEnterRole('admin');
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 flex flex-col">
      {/* Top Institutional Header */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 lg:px-10 flex items-center justify-between gap-6">
        <div className="text-sm font-bold tracking-tight text-[#103D6B] whitespace-nowrap">
          信评委评审会智能匹配与轮换系统
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="hidden sm:inline font-mono tabular-nums">
            基准评审日：{state.referenceDate}
          </span>
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置演练数据
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onResetSandbox();
                  setConfirmReset(false);
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#B91C1C] rounded hover:bg-red-800 whitespace-nowrap"
              >
                确认重置
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
              >
                取消
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Center Gateway Content */}
      <main className="flex-1 flex flex-col justify-center max-w-[1240px] w-full mx-auto px-6 py-10 lg:py-14">
        <div className="max-w-3xl mb-9">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#103D6B] mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>实名凭证隔离鉴权 · 一人一页专属权限</span>
          </div>
          <h1
            className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900"
            style={{ textWrap: 'balance' }}
          >
            请使用本人身份凭证登录专属工作台
          </h1>
          <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
            每位秘书、委员与系统管理员均须凭本人专属工号及凭证口令登录对应页面。进入工作台后严格隔离访问权限，不可越权切换或查阅其他人员的个人页面与未解盲信息。
          </p>
        </div>

        {/* 3 Independent Credential Entry Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Entry 1: Secretary Credential Login */}
          <form
            onSubmit={handleSecretarySubmit}
            className="bg-white border border-slate-200 rounded-md flex flex-col justify-between p-6"
          >
            <div>
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded bg-[#EFF6FF] text-[#103D6B] flex items-center justify-center">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono text-slate-400">PORTAL 01</span>
              </div>

              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                秘书工作台
              </h2>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                用于评审排期优化、双盲智能匹配与轮换统筹、近 90 天集中度监测，以及查阅全院历史评审记录与总体统计分析。
              </p>

              <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                <div>
                  <label
                    htmlFor="gateway-secretary-select"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    选择秘书身份
                  </label>
                  <select
                    id="gateway-secretary-select"
                    value={chosenSecretaryId}
                    onChange={(e) => {
                      setChosenSecretaryId(e.target.value);
                      setSecretaryPin('');
                      setSecretaryError('');
                    }}
                    className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-[#103D6B] focus:bg-white"
                  >
                    {state.secretaries.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}（{sec.employeeCode} · {sec.title}）
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label
                      htmlFor="gateway-secretary-pin"
                      className="font-medium text-slate-700"
                    >
                      专属身份凭证口令
                    </label>
                    {selectedSecretary && (
                      <button
                        type="button"
                        onClick={() => {
                          setSecretaryPin(selectedSecretary.credentialCode);
                          setSecretaryError('');
                        }}
                        className="text-[11px] text-[#103D6B] hover:underline font-mono"
                      >
                        填入演练口令 ({selectedSecretary.credentialCode})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="gateway-secretary-pin"
                      type="password"
                      value={secretaryPin}
                      onChange={(e) => {
                        setSecretaryPin(e.target.value);
                        if (secretaryError) setSecretaryError('');
                      }}
                      placeholder="请输入 4 位身份凭证口令"
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                    />
                  </div>
                  {secretaryError && (
                    <div className="mt-1.5 text-[11px] text-[#B91C1C]">
                      {secretaryError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors"
              >
                <span>核验凭证 · 进入秘书工作台</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Entry 2: Committee Member Credential Login */}
          <form
            onSubmit={handleMemberSubmit}
            className="bg-white border border-slate-200 rounded-md flex flex-col justify-between p-6"
          >
            <div>
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded bg-[#EFF6FF] text-[#103D6B] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono text-slate-400">PORTAL 02</span>
              </div>

              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                委员工作台
              </h2>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                登录本人专属页面，快速维护高频可用时间、配置专业领域顺位与默认电子签名、电子签署回避承诺函，并仅查阅本人历史评审与统计。
              </p>

              <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                <div>
                  <label
                    htmlFor="gateway-member-select"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    选择本人委员身份
                  </label>
                  <select
                    id="gateway-member-select"
                    value={chosenMemberId}
                    onChange={(e) => {
                      setChosenMemberId(e.target.value);
                      setMemberPin('');
                      setMemberError('');
                    }}
                    className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-[#103D6B] focus:bg-white"
                  >
                    {state.members.map((m) => {
                      const roleTag = m.isChiefCommissioner
                        ? `${m.chiefCategories.join('/')}主任委员`
                        : m.canConvene
                        ? '召集人'
                        : '评审委员';
                      return (
                        <option key={m.id} value={m.id}>
                          {m.name}（{m.employeeCode} · {roleTag}）
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label
                      htmlFor="gateway-member-pin"
                      className="font-medium text-slate-700"
                    >
                      专属身份凭证口令
                    </label>
                    {selectedMember && (
                      <button
                        type="button"
                        onClick={() => {
                          setMemberPin(selectedMember.credentialCode);
                          setMemberError('');
                        }}
                        className="text-[11px] text-[#103D6B] hover:underline font-mono"
                      >
                        填入演练口令 ({selectedMember.credentialCode})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="gateway-member-pin"
                      type="password"
                      value={memberPin}
                      onChange={(e) => {
                        setMemberPin(e.target.value);
                        if (memberError) setMemberError('');
                      }}
                      placeholder="请输入 4 位身份凭证口令"
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                    />
                  </div>
                  {memberError && (
                    <div className="mt-1.5 text-[11px] text-[#B91C1C]">
                      {memberError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors"
              >
                <span>核验凭证 · 进入委员工作台</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Entry 3: System Admin Credential Login */}
          <form
            onSubmit={handleAdminSubmit}
            className="bg-white border border-slate-200 rounded-md flex flex-col justify-between p-6"
          >
            <div>
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded bg-[#EFF6FF] text-[#103D6B] flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="text-xs font-mono text-slate-400">PORTAL 03</span>
              </div>

              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                系统管理员端
              </h2>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                负责实时配置匹配规则与防折返评分权重、维护三大领域主任委员任职资格与利益回避名录，并核验导出全流程链式审计日志。
              </p>

              <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                <div>
                  <div className="text-xs font-medium text-slate-700 mb-1.5">
                    管理员账号
                  </div>
                  <div className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded text-slate-700">
                    {ADMIN_CREDENTIAL.name}（{ADMIN_CREDENTIAL.employeeCode}）
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label
                      htmlFor="gateway-admin-pin"
                      className="font-medium text-slate-700"
                    >
                      管理员安全凭证口令
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminPin(ADMIN_CREDENTIAL.credentialCode);
                        setAdminError('');
                      }}
                      className="text-[11px] text-[#103D6B] hover:underline font-mono"
                    >
                      填入演练口令 ({ADMIN_CREDENTIAL.credentialCode})
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="gateway-admin-pin"
                      type="password"
                      value={adminPin}
                      onChange={(e) => {
                        setAdminPin(e.target.value);
                        if (adminError) setAdminError('');
                      }}
                      placeholder="请输入 4 位管理员口令"
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                    />
                  </div>
                  {adminError && (
                    <div className="mt-1.5 text-[11px] text-[#B91C1C]">
                      {adminError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors"
              >
                <span>核验凭证 · 进入系统管理员工作台</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>

        {/* Governance Spec Footer Strip */}
        <div className="mt-8 bg-white border border-slate-200 rounded-md px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-slate-400">单场评审席位配置</div>
            <div className="mt-0.5 font-mono font-semibold text-slate-800 tabular-nums">
              {state.config.convenerCount} 名召集人 + {state.config.memberCount} 名委员
            </div>
          </div>
          <div>
            <div className="text-slate-400">召集人集中度红线</div>
            <div className="mt-0.5 font-mono font-semibold text-slate-800 tabular-nums">
              近 {state.config.concentrationWindowDays} 天 ≤{' '}
              {(state.config.convenerConcentrationCap * 100).toFixed(0)}%（冷启动{' '}
              {state.config.coldStartThreshold} 场）
            </div>
          </div>
          <div>
            <div className="text-slate-400">身份数据权限边界</div>
            <div className="mt-0.5 font-semibold text-slate-800">
              委员仅看本人 · 秘书看总体与脱敏队列
            </div>
          </div>
          <div>
            <div className="text-slate-400">电子回避签署机制</div>
            <div className="mt-0.5 font-semibold text-slate-800">
              支持预存电子签名自动调用与哈希存证
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
