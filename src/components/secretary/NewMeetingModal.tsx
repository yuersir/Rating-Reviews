import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  CommitteeMember,
  HALF_DAY_SLOTS,
  HalfDay,
  MAJOR_CATEGORIES,
  MajorCategory,
  REVIEW_TYPE_MAP,
  ReviewTypeCode,
  ReviewTypeGroup,
  RuleConfig,
  SlotIndex,
  SUB_CATEGORIES,
  SubCategory,
} from '../../types/domain';
import { SCHEDULE_DATES } from '../../data/seedData';

interface NewMeetingModalProps {
  open: boolean;
  members: CommitteeMember[];
  config: RuleConfig;
  onClose: () => void;
  onSubmit: (payload: {
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
  }) => void;
}

const REVIEW_GROUP_OPTIONS: Array<{ group: ReviewTypeGroup; label: string }> = [
  { group: 'A', label: 'A类（初评）' },
  { group: 'B', label: 'B类（连续评级）' },
  { group: 'C', label: 'C类（跟踪）' },
];

export function NewMeetingModal({
  open,
  members,
  config,
  onClose,
  onSubmit,
}: NewMeetingModalProps) {
  const [projectName, setProjectName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [selectedMajor, setSelectedMajor] = useState<MajorCategory>('城投');
  const [subCategory, setSubCategory] = useState<SubCategory>('省级及高信用城投');
  const [date, setDate] = useState<string>(SCHEDULE_DATES[0]);
  const [halfDay, setHalfDay] = useState<HalfDay>('AM');
  const [slotIndex, setSlotIndex] = useState<SlotIndex>(4);
  const [reviewGroup, setReviewGroup] = useState<ReviewTypeGroup>('B');
  const [reviewType, setReviewType] = useState<ReviewTypeCode>('B1');
  const [reviewTriggerNote, setReviewTriggerNote] = useState('');
  const [conflictMemberIds, setConflictMemberIds] = useState<string[]>([]);
  const [conflictNote, setConflictNote] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const subOptions = SUB_CATEGORIES.filter((s) => s.major === selectedMajor);
  const currentReviewMeta = REVIEW_TYPE_MAP[reviewType];
  const triggersChiefPriority =
    config.chiefPriorityReviewTypes.includes(reviewType);

  const handleMajorChange = (major: MajorCategory) => {
    setSelectedMajor(major);
    const first = SUB_CATEGORIES.find((s) => s.major === major);
    if (first) setSubCategory(first.id);
  };

  const handleReviewGroupChange = (group: ReviewTypeGroup) => {
    setReviewGroup(group);
    if (group === 'A') setReviewType('A');
    else if (group === 'B') setReviewType('B1');
    else setReviewType('C1');
  };

  const toggleConflictMember = (id: string) => {
    setConflictMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !issuer.trim()) {
      setError('请完整填写评审项目名称与发行人名称。');
      return;
    }
    setError('');
    onSubmit({
      projectName,
      issuer,
      subCategory,
      date,
      halfDay,
      slotIndex,
      reviewType,
      reviewTriggerNote,
      conflictMemberIds,
      conflictNote,
    });
    setProjectName('');
    setIssuer('');
    setReviewGroup('B');
    setReviewType('B1');
    setReviewTriggerNote('');
    setConflictMemberIds([]);
    setConflictNote('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">新增评审会需求</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              默认配置为 6 人制（1 名召集人 + 5 名评审委员），按客观业务类别（A/B/C类）立案，不预设评审表决结论。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭弹窗"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="px-3.5 py-2.5 text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                评审项目名称 <span className="text-[#B91C1C]">*</span>
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="例如：海州城投2026年度第一期中期票据"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B] focus:ring-1 focus:ring-[#103D6B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                发行人 / 融资主体 <span className="text-[#B91C1C]">*</span>
              </label>
              <input
                type="text"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="例如：海州城市建设投资集团"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B] focus:ring-1 focus:ring-[#103D6B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                所属专业大类
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded">
                {MAJOR_CATEGORIES.map((major) => (
                  <button
                    key={major}
                    type="button"
                    onClick={() => handleMajorChange(major)}
                    className={`py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      selectedMajor === major
                        ? 'bg-white text-[#103D6B] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {major}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                细分专业领域
              </label>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value as SubCategory)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
              >
                {subOptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                评审日期
              </label>
              <select
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
              >
                {SCHEDULE_DATES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                半天场次
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded">
                {(['AM', 'PM'] as HalfDay[]).map((hd) => (
                  <button
                    key={hd}
                    type="button"
                    onClick={() => setHalfDay(hd)}
                    className={`py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      halfDay === hd
                        ? 'bg-white text-[#103D6B] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {hd === 'AM' ? '上午场' : '下午场'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                时段槽位
              </label>
              <select
                value={slotIndex}
                onChange={(e) => setSlotIndex(Number(e.target.value) as SlotIndex)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
              >
                {HALF_DAY_SLOTS[halfDay].map((s) => (
                  <option key={s.slotIndex} value={s.slotIndex}>
                    {s.label} · {s.timeRange}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Objective Review Category Selector (A / B1 / B2 / C1 / C2) */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                评审业务类别（客观立案分类 · 区分 A / B1 / B2 / C1 / C2）
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded">
                {REVIEW_GROUP_OPTIONS.map((opt) => (
                  <button
                    key={opt.group}
                    type="button"
                    onClick={() => handleReviewGroupChange(opt.group)}
                    className={`py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      reviewGroup === opt.group
                        ? 'bg-white text-[#103D6B] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {reviewGroup === 'B' && (
              <div className="grid grid-cols-2 gap-2">
                {(['B1', 'B2'] as ReviewTypeCode[]).map((code) => {
                  const meta = REVIEW_TYPE_MAP[code];
                  const active = reviewType === code;
                  const isPriority = config.chiefPriorityReviewTypes.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setReviewType(code)}
                      className={`px-3 py-2 text-left rounded border transition-colors ${
                        active
                          ? 'bg-[#EFF6FF] border-[#103D6B] text-[#103D6B]'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between gap-2">
                        <span>{meta.subLabel}</span>
                        {isPriority && (
                          <span className="font-mono text-[11px] font-medium text-[#103D6B]">
                            主任委员优先
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {meta.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {reviewGroup === 'C' && (
              <div className="grid grid-cols-2 gap-2">
                {(['C1', 'C2'] as ReviewTypeCode[]).map((code) => {
                  const meta = REVIEW_TYPE_MAP[code];
                  const active = reviewType === code;
                  const isPriority = config.chiefPriorityReviewTypes.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setReviewType(code)}
                      className={`px-3 py-2 text-left rounded border transition-colors ${
                        active
                          ? 'bg-[#EFF6FF] border-[#103D6B] text-[#103D6B]'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between gap-2">
                        <span>{meta.subLabel}</span>
                        {isPriority && (
                          <span className="font-mono text-[11px] font-medium text-[#103D6B]">
                            主任委员优先
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {meta.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 space-y-1">
              <div>
                当前立案类别：
                <span className="font-semibold text-slate-900">
                  {currentReviewMeta.fullLabel}
                </span>{' '}
                — {currentReviewMeta.description}
              </div>
              {triggersChiefPriority && (
                <div className="text-[#103D6B] font-medium">
                  规则联动：该类别属于重点评审类别，召集人将优先匹配「{selectedMajor}」主任委员（+{config.chiefPriorityBonus} 分），但仍严格受近 {config.concentrationWindowDays} 天 {(config.convenerConcentrationCap * 100).toFixed(0)}% 召集集中度上限硬控。
                </div>
              )}
            </div>

            <input
              type="text"
              value={reviewTriggerNote}
              onChange={(e) => setReviewTriggerNote(e.target.value)}
              placeholder="可选：客观触发事项或立项背景说明（如重大资产重组、扩募新增资产包、触发信用跟踪事件等；不预设评审结论）"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700">
                利益冲突回避委员（前置硬性过滤，且排期优化时自动置入半天首尾边缘）
              </label>
              <span className="text-xs text-slate-500 tabular-nums">
                已选 {conflictMemberIds.length} 人
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded">
              {members.map((m) => {
                const checked = conflictMemberIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
                      checked
                        ? 'bg-red-50 text-[#B91C1C] font-medium'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleConflictMember(m.id)}
                      className="rounded border-slate-300 text-[#B91C1C] focus:ring-[#B91C1C]"
                    />
                    <span className="truncate">{m.name}</span>
                  </label>
                );
              })}
            </div>
            <input
              type="text"
              value={conflictNote}
              onChange={(e) => setConflictNote(e.target.value)}
              placeholder="可选：补充利益冲突或特殊回避缘由说明"
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] transition-colors"
            >
              提交评审需求
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
