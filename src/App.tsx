import { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CalendarCheck,
  CalendarClock,
  Clock,
  FileSearch,
  Gauge,
  LogOut,
  PenTool,
  Plus,
  RotateCcw,
  Shield,
  Sliders,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { RoleType } from './types/domain';
import { ADMIN_CREDENTIAL } from './data/seedData';
import { useCommitteeStore } from './store/useCommitteeStore';
import { RolePortalGateway } from './components/portal/RolePortalGateway';
import { SecretaryWorkspace } from './components/secretary/SecretaryWorkspace';
import {
  MemberWorkspace,
  MemberWorkspaceTab,
} from './components/member/MemberWorkspace';
import { AdminWorkspace } from './components/admin/AdminWorkspace';

type SecretaryTab = 'scheduling' | 'concentration' | 'analytics';
type AdminTab = 'rules' | 'chiefs' | 'audit';

const ROLE_META: Record<
  RoleType,
  { label: string; icon: typeof Users }
> = {
  secretary: {
    label: '秘书工作台',
    icon: CalendarClock,
  },
  member: {
    label: '委员工作台',
    icon: Users,
  },
  admin: {
    label: '系统管理员工作台',
    icon: Shield,
  },
};

export default function App() {
  const store = useCommitteeStore();
  const { state, toasts, dismissToast } = store;

  // Independent credential gateway state: starts at standalone login screen
  const [enteredPortal, setEnteredPortal] = useState(false);

  const [secretaryTab, setSecretaryTab] = useState<SecretaryTab>('scheduling');
  const [memberTab, setMemberTab] = useState<MemberWorkspaceTab>('schedule');
  const [adminTab, setAdminTab] = useState<AdminTab>('rules');
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const activeSecretary = useMemo(
    () =>
      state.secretaries.find((s) => s.id === state.activeSecretaryId) ??
      state.secretaries[0],
    [state.secretaries, state.activeSecretaryId]
  );

  const activeMember = useMemo(
    () =>
      state.members.find((m) => m.id === state.activeMemberId) ??
      state.members[0],
    [state.members, state.activeMemberId]
  );

  const memberPendingCount = useMemo(() => {
    if (!activeMember) return 0;
    return state.meetings.reduce(
      (sum, mt) =>
        sum +
        mt.seats.filter(
          (s) => s.memberId === activeMember.id && s.status === 'pending'
        ).length,
      0
    );
  }, [state.meetings, activeMember]);

  const draftMeetingsCount = useMemo(
    () => state.meetings.filter((m) => m.status === 'draft').length,
    [state.meetings]
  );

  const handleEnterRole = (role: RoleType, identityId?: string) => {
    store.setActiveRole(role);
    if (role === 'secretary' && identityId) {
      store.setActiveSecretaryId(identityId);
      setSecretaryTab('scheduling');
    } else if (role === 'member' && identityId) {
      store.setActiveMemberId(identityId);
      setMemberTab('schedule');
    } else if (role === 'admin') {
      setAdminTab('rules');
    }
    setEnteredPortal(true);
    setConfirmReset(false);
  };

  const handleExitToGateway = () => {
    setEnteredPortal(false);
    setConfirmReset(false);
    setNewMeetingOpen(false);
  };

  if (!enteredPortal) {
    return (
      <>
        <RolePortalGateway
          state={state}
          onEnterRole={handleEnterRole}
          onResetSandbox={store.resetDemoSandbox}
        />
        {toasts.length > 0 && (
          <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="pointer-events-auto bg-white border border-slate-200 rounded-md shadow-md px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div
                    className={`text-xs font-semibold ${
                      t.tone === 'success'
                        ? 'text-[#15803D]'
                        : t.tone === 'danger'
                        ? 'text-[#B91C1C]'
                        : t.tone === 'warning'
                        ? 'text-[#B45309]'
                        : 'text-[#103D6B]'
                    }`}
                  >
                    {t.title}
                  </div>
                  {t.detail && (
                    <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      {t.detail}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(t.id)}
                  aria-label="关闭通知"
                  className="p-0.5 text-slate-400 hover:text-slate-700 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  const currentRoleMeta = ROLE_META[state.activeRole];
  const CurrentRoleIcon = currentRoleMeta.icon;

  const authenticatedLabel =
    state.activeRole === 'secretary' && activeSecretary
      ? `${activeSecretary.name}（${activeSecretary.employeeCode}）`
      : state.activeRole === 'member' && activeMember
      ? `${activeMember.name}（${activeMember.employeeCode}）`
      : `${ADMIN_CREDENTIAL.name}（${ADMIN_CREDENTIAL.employeeCode}）`;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9] text-slate-900">
      {/* Row 1: Institutional Identity Top Header (No sidebar — full viewport clarity) */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded bg-[#103D6B] text-white flex items-center justify-center shrink-0">
            <CurrentRoleIcon className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-sm font-bold tracking-tight text-[#103D6B] whitespace-nowrap">
              信评委智能匹配与轮换系统
            </span>
            <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
              /
            </span>
            <span className="text-xs font-semibold text-slate-800 whitespace-nowrap hidden sm:inline">
              {currentRoleMeta.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 pr-2 border-r border-slate-200">
            <span className="text-slate-400">当前身份</span>
            <span className="font-semibold text-slate-900 font-mono">
              {authenticatedLabel}
            </span>
          </div>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors whitespace-nowrap"
              title="恢复默认演练数据集"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置演练
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  store.resetDemoSandbox();
                  setConfirmReset(false);
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#B91C1C] rounded hover:bg-red-800 whitespace-nowrap"
              >
                确认重置
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
              >
                取消
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleExitToGateway}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#103D6B] bg-[#EFF6FF] border border-[#103D6B]/20 rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出当前凭证
          </button>
        </div>
      </header>

      {/* Row 2: Prominent Horizontal Workspace Tab Navigation Bar */}
      <nav
        aria-label="工作台主导航"
        className="bg-white border-b border-slate-200 sticky top-14 z-20"
      >
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
            {state.activeRole === 'secretary' && (
              <>
                <button
                  type="button"
                  onClick={() => setSecretaryTab('scheduling')}
                  className={`inline-flex items-center gap-2 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    secretaryTab === 'scheduling'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarClock className="w-4 h-4 shrink-0" />
                  <span>评审排期与智能匹配</span>
                  {draftMeetingsCount > 0 && (
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      ({draftMeetingsCount}待匹)
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSecretaryTab('concentration')}
                  className={`inline-flex items-center gap-2 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    secretaryTab === 'concentration'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Gauge className="w-4 h-4 shrink-0" />
                  <span>近90天集中度监测</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSecretaryTab('analytics')}
                  className={`inline-flex items-center gap-2 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    secretaryTab === 'analytics'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>全院历史评审与统计</span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    ({state.history.length})
                  </span>
                </button>
              </>
            )}

            {state.activeRole === 'member' && (
              <>
                <button
                  type="button"
                  onClick={() => setMemberTab('schedule')}
                  className={`inline-flex items-center gap-2 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    memberTab === 'schedule'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarCheck className="w-4 h-4 shrink-0" />
                  <span>当日日程与签署</span>
                  {memberPendingCount > 0 && (
                    <span className="font-mono text-[11px] font-semibold text-[#B45309] tabular-nums">
                      ({memberPendingCount}待签)
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMemberTab('availability')}
                  className={`inline-flex items-center gap-2 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    memberTab === 'availability'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>可用时间维护</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMemberTab('expertise')}
                  className={`inline-flex items-center gap-2 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    memberTab === 'expertise'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCog className="w-4 h-4 shrink-0" />
                  <span>专业领域顺位</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMemberTab('signature')}
                  className={`inline-flex items-center gap-2 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    memberTab === 'signature'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <PenTool className="w-4 h-4 shrink-0" />
                  <span>电子签名管理</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMemberTab('analytics')}
                  className={`inline-flex items-center gap-2 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    memberTab === 'analytics'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>本人历史与统计</span>
                </button>
              </>
            )}

            {state.activeRole === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => setAdminTab('rules')}
                  className={`inline-flex items-center gap-2 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    adminTab === 'rules'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sliders className="w-4 h-4 shrink-0" />
                  <span>规则与评分参数</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminTab('chiefs')}
                  className={`inline-flex items-center gap-2 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    adminTab === 'chiefs'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Award className="w-4 h-4 shrink-0" />
                  <span>主任委员与回避维护</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminTab('audit')}
                  className={`inline-flex items-center gap-2 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    adminTab === 'audit'
                      ? 'border-[#103D6B] text-[#103D6B]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSearch className="w-4 h-4 shrink-0" />
                  <span>不可篡改审计日志</span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    ({state.auditLogs.length})
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Right Contextual Primary Action */}
          <div className="shrink-0 py-2">
            {state.activeRole === 'secretary' && (
              <button
                type="button"
                onClick={() => {
                  setSecretaryTab('scheduling');
                  setNewMeetingOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                新增评审需求
              </button>
            )}
            {state.activeRole === 'member' && (
              <span className="hidden lg:inline text-[11px] font-mono text-slate-500 tabular-nums">
                席位规模 {state.config.convenerCount}+{state.config.memberCount} · 红线{' '}
                {(state.config.convenerConcentrationCap * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* Main Workspace Viewport (Full Spacious Width) */}
      <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
        {state.activeRole === 'secretary' && (
          <SecretaryWorkspace
            activeSubTab={secretaryTab}
            members={state.members}
            meetings={state.meetings}
            history={state.history}
            referenceDate={state.referenceDate}
            config={state.config}
            newModalOpen={newMeetingOpen}
            onCloseNewModal={() => setNewMeetingOpen(false)}
            onOpenNewModal={() => setNewMeetingOpen(true)}
            onAddMeeting={store.addMeeting}
            onOptimizeHalfDay={store.applyHalfDayOptimization}
            onRunMatch={store.executeMatchForMeeting}
            onManualRotateSeat={store.manualRotateSeat}
            onManualRotateFull={store.manualRotateFullPanel}
            onSimulateTimeout={store.simulateTimeoutForSeat}
            onSendReminder={store.sendSeatReminder}
          />
        )}

        {state.activeRole === 'member' && activeMember && (
          <MemberWorkspace
            activeSubTab={memberTab}
            member={activeMember}
            meetings={state.meetings}
            history={state.history}
            referenceDate={state.referenceDate}
            simulatedClockIso={state.simulatedClockIso}
            config={state.config}
            onNavigateTab={setMemberTab}
            onSetSimulatedClock={store.setSimulatedClock}
            onUpdateExpertise={store.updateMemberExpertise}
            onToggleSlot={store.toggleMemberSlotAvailability}
            onSetDayAvailability={store.setMemberDayAvailability}
            onBatchSetAvailability={store.batchSetMemberAvailability}
            onSaveSignature={store.saveMemberSignature}
            onClearSignature={store.clearMemberSignature}
            onConfirmAttendance={store.confirmSeatAttendance}
            onDeclineAttendance={store.declineSeatAndSubstitute}
            onSaveCalculation={store.saveMemberCalculation}
            onSubmitVote={store.submitMemberReviewVote}
          />
        )}

        {state.activeRole === 'admin' && (
          <AdminWorkspace
            activeSubTab={adminTab}
            config={state.config}
            members={state.members}
            auditLogs={state.auditLogs}
            onUpdateConfig={store.updateRuleConfig}
            onResetConfig={store.resetRuleConfigToDefault}
            onUpdateMemberGovernance={store.updateMemberGovernance}
          />
        )}
      </main>

      {/* Toast Notification Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto bg-white border border-slate-200 rounded-md shadow-md px-4 py-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div
                  className={`text-xs font-semibold ${
                    t.tone === 'success'
                      ? 'text-[#15803D]'
                      : t.tone === 'danger'
                      ? 'text-[#B91C1C]'
                      : t.tone === 'warning'
                      ? 'text-[#B45309]'
                      : 'text-[#103D6B]'
                  }`}
                >
                  {t.title}
                </div>
                {t.detail && (
                  <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {t.detail}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="关闭通知"
                className="p-0.5 text-slate-400 hover:text-slate-700 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
