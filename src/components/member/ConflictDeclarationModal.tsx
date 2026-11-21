import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eraser,
  FileCheck2,
  PenTool,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ConflictDeclarationRecord,
  HALF_DAY_SLOTS,
  MeetingSeat,
  ReviewMeeting,
  SavedMemberSignature,
} from '../../types/domain';

export const CONFLICT_DECLARATION_CLAUSES = [
  '本人及近亲属与本次评审项目发行人、增信机构及主要承销机构不存在股权持有、债权债务、任职或亲属关联等利益冲突情形。',
  '本人近十二个月内未参与该发行人的评级承做、顾问咨询或商业利益推介，亦未接受发行人任何不当请托或馈赠。',
  '本人承诺严格遵守信用评级保密纪律，独立、客观、审慎地发表评审意见并独立表决；如会中发现潜在冲突将立即中止参与并申报回避。',
];

interface ConflictDeclarationSignModalProps {
  mode: 'sign';
  open: boolean;
  meeting: ReviewMeeting | null;
  seat: MeetingSeat | null;
  savedSignature?: SavedMemberSignature;
  onSaveDefaultSignature?: (signature: SavedMemberSignature) => void;
  onClose: () => void;
  onConfirmSigned: (payload: {
    signingMethod: 'handwritten' | 'typed_seal';
    signatureDataUrl?: string;
    typedSealText?: string;
    clausesAccepted: string[];
  }) => void;
}

interface ConflictDeclarationViewModalProps {
  mode: 'view';
  open: boolean;
  declaration: ConflictDeclarationRecord | null;
  onClose: () => void;
}

type ConflictDeclarationModalProps =
  | ConflictDeclarationSignModalProps
  | ConflictDeclarationViewModalProps;

export function ConflictDeclarationModal(props: ConflictDeclarationModalProps) {
  const [checkedClauses, setCheckedClauses] = useState<boolean[]>([
    false,
    false,
    false,
  ]);
  const [signingMethod, setSigningMethod] = useState<'handwritten' | 'typed_seal'>(
    'handwritten'
  );
  const [typedName, setTypedName] = useState('');
  const [hasDrawnStroke, setHasDrawnStroke] = useState(false);
  const [usingSavedSig, setUsingSavedSig] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const savedSig = props.mode === 'sign' ? props.savedSignature : undefined;
  const seatId = props.mode === 'sign' ? props.seat?.seatId : null;

  // Reset form state whenever signing modal opens for a new seat
  useEffect(() => {
    if (props.mode === 'sign' && props.open) {
      setCheckedClauses([false, false, false]);
      setHasDrawnStroke(false);
      setSaveAsDefault(true);
      if (savedSig && savedSig.autoApply) {
        setUsingSavedSig(true);
        setSigningMethod(savedSig.method);
        setTypedName(savedSig.typedSealText ?? '');
      } else {
        setUsingSavedSig(false);
        setSigningMethod('handwritten');
        setTypedName('');
      }
    }
  }, [props.mode, props.open, seatId, savedSig]);

  // Initialize HiDPI canvas whenever handwritten tab is active in manual draw mode
  useEffect(() => {
    if (
      props.mode !== 'sign' ||
      !props.open ||
      usingSavedSig ||
      signingMethod !== 'handwritten'
    ) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 560;
    const height = rect.height || 144;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#0F172A';
    }
    setHasDrawnStroke(false);
  }, [props.mode, props.open, usingSavedSig, signingMethod]);

  if (!props.open) return null;

  // --- READ-ONLY VIEW CERTIFICATE MODE ---
  if (props.mode === 'view') {
    const decl = props.declaration;
    if (!decl) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#15803D]" />
              <h2 className="text-sm font-semibold text-slate-900">
                电子利益冲突回避承诺函存证凭证
              </h2>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              aria-label="关闭凭证"
              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
            <div className="text-center pb-4 border-b border-slate-200">
              <div className="text-base font-bold text-slate-900 tracking-wide">
                信用评级评审会利益冲突回避与独立评审承诺函
              </div>
              <div className="mt-1 text-xs font-mono text-slate-500 tabular-nums">
                存证编号：{decl.declarationId} · 签署时间：
                {new Date(decl.signedAt).toLocaleString('zh-CN', { hour12: false })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200 rounded p-4">
              <div>
                <span className="text-slate-500">评审项目：</span>
                <span className="font-medium text-slate-900">{decl.projectName}</span>
              </div>
              <div>
                <span className="text-slate-500">项目编号：</span>
                <span className="font-mono text-slate-900">{decl.meetingCode}</span>
              </div>
              <div>
                <span className="text-slate-500">发行主体：</span>
                <span className="font-medium text-slate-900">{decl.issuer}</span>
              </div>
              <div>
                <span className="text-slate-500">承诺人及席位：</span>
                <span className="font-medium text-slate-900">
                  {decl.signerName}（{decl.signerEmployeeCode} · {decl.seatLabel}）
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
              <div className="font-semibold text-slate-900">已逐项确认之合规承诺条款：</div>
              {decl.clausesAccepted.map((clause, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] shrink-0 mt-0.5" />
                  <span>
                    {idx + 1}. {clause}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1 text-xs">
                <div className="text-slate-500">
                  签署方式：
                  <span className="font-medium text-slate-800">
                    {decl.signingMethod === 'handwritten'
                      ? '电子手写签名'
                      : '实名合规电子签章'}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 break-all">
                  防篡改摘要哈希：{decl.declarationHash}
                </div>
              </div>

              <div className="shrink-0">
                {decl.signingMethod === 'handwritten' && decl.signatureDataUrl ? (
                  <div className="border border-slate-200 rounded bg-white p-2">
                    <img
                      src={decl.signatureDataUrl}
                      alt={`${decl.signerName}电子手写签名`}
                      className="h-16 w-44 object-contain"
                    />
                  </div>
                ) : (
                  <div className="inline-flex flex-col items-center px-5 py-2 border-2 border-[#B91C1C]/80 text-[#B91C1C] rounded-xs bg-red-50/30">
                    <span className="text-[10px] tracking-widest">信评委合规电子签章</span>
                    <span className="text-base font-bold tracking-widest mt-0.5">
                      {decl.typedSealText || decl.signerName}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums mt-0.5">
                      {decl.signerEmployeeCode}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={props.onClose}
              className="px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E]"
            >
              关闭存证预览
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- INTERACTIVE SIGNING MODE ---
  const { meeting, seat, onClose, onConfirmSigned, onSaveDefaultSignature } = props;
  if (!meeting || !seat) return null;

  const slotDef = HALF_DAY_SLOTS[meeting.halfDay].find(
    (s) => s.slotIndex === meeting.slotIndex
  );

  const allClausesChecked = checkedClauses.every(Boolean);
  const typedMatches = typedName.trim() === seat.memberName;
  const signatureReady = usingSavedSig
    ? Boolean(savedSig)
    : signingMethod === 'handwritten'
    ? hasDrawnStroke
    : typedMatches;
  const canSubmit = allClausesChecked && signatureReady;

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    if (!hasDrawnStroke) setHasDrawnStroke(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  };

  const clearSignaturePad = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawnStroke(false);
  };

  const handleConfirm = () => {
    if (!canSubmit) return;

    if (usingSavedSig && savedSig) {
      onConfirmSigned({
        signingMethod: savedSig.method,
        signatureDataUrl: savedSig.signatureDataUrl,
        typedSealText: savedSig.typedSealText || seat.memberName,
        clausesAccepted: CONFLICT_DECLARATION_CLAUSES,
      });
      return;
    }

    if (signingMethod === 'handwritten') {
      const dataUrl = canvasRef.current?.toDataURL('image/png');
      if (saveAsDefault && onSaveDefaultSignature && dataUrl) {
        onSaveDefaultSignature({
          method: 'handwritten',
          signatureDataUrl: dataUrl,
          autoApply: true,
          updatedAt: new Date().toISOString(),
        });
      }
      onConfirmSigned({
        signingMethod: 'handwritten',
        signatureDataUrl: dataUrl,
        clausesAccepted: CONFLICT_DECLARATION_CLAUSES,
      });
    } else {
      const sealText = typedName.trim();
      if (saveAsDefault && onSaveDefaultSignature) {
        onSaveDefaultSignature({
          method: 'typed_seal',
          typedSealText: sealText,
          autoApply: true,
          updatedAt: new Date().toISOString(),
        });
      }
      onConfirmSigned({
        signingMethod: 'typed_seal',
        typedSealText: sealText,
        clausesAccepted: CONFLICT_DECLARATION_CLAUSES,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#103D6B]" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                确认参会并电子签署《利益冲突回避承诺函》
              </h2>
              <p className="text-[11px] text-slate-500">
                合规强制前置程序：签署完成后立即锁定出席席位并生成防篡改哈希存证
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭签署窗口"
            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Meeting & Signer Info Block */}
          <div className="bg-slate-50 border border-slate-200 rounded p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div>
              <span className="text-slate-500">评审项目：</span>
              <span className="font-semibold text-slate-900">{meeting.projectName}</span>
            </div>
            <div>
              <span className="text-slate-500">项目编号：</span>
              <span className="font-mono text-slate-900">{meeting.code}</span>
            </div>
            <div>
              <span className="text-slate-500">发行主体：</span>
              <span className="font-medium text-slate-900">{meeting.issuer}</span>
            </div>
            <div>
              <span className="text-slate-500">评审时段：</span>
              <span className="font-mono tabular-nums text-slate-900">
                {meeting.date} {meeting.halfDay === 'AM' ? '上午' : '下午'}第
                {meeting.slotIndex}场（{slotDef?.timeRange}）
              </span>
            </div>
            <div className="sm:col-span-2 pt-1.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="text-slate-500">承诺签署委员：</span>
                <span className="font-semibold text-[#103D6B]">
                  {seat.memberName}（{seat.employeeCode}）
                </span>
              </span>
              <span className="font-medium text-slate-700">
                本场担任：{seat.seatLabel}
              </span>
            </div>
          </div>

          {/* 3 Mandatory Compliance Clauses */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">
                一、请逐项核验并勾选利益冲突回避承诺条款（须全部同意）
              </span>
              <button
                type="button"
                onClick={() =>
                  setCheckedClauses(
                    allClausesChecked ? [false, false, false] : [true, true, true]
                  )
                }
                className="text-xs text-[#103D6B] hover:underline"
              >
                {allClausesChecked ? '取消全选' : '全部已阅并确认'}
              </button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded">
              {CONFLICT_DECLARATION_CLAUSES.map((clause, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-2.5 p-3 text-xs text-slate-700 hover:bg-slate-50/70 cursor-pointer leading-relaxed"
                >
                  <input
                    type="checkbox"
                    checked={checkedClauses[idx]}
                    onChange={(e) => {
                      const next = [...checkedClauses];
                      next[idx] = e.target.checked;
                      setCheckedClauses(next);
                    }}
                    className="mt-0.5 rounded border-slate-300 text-[#103D6B] focus:ring-[#103D6B]"
                  />
                  <span>
                    <strong className="text-slate-900">条款 {idx + 1}：</strong>
                    {clause}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Electronic Signature Area */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">
                二、完成电子签名 / 实名签章
              </span>

              {usingSavedSig && savedSig ? (
                <button
                  type="button"
                  onClick={() => {
                    setUsingSavedSig(false);
                    setSigningMethod('handwritten');
                    setTypedName('');
                  }}
                  className="text-xs text-[#103D6B] hover:underline self-start sm:self-auto"
                >
                  本次改为重新手写 / 更换签名
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {savedSig && (
                    <button
                      type="button"
                      onClick={() => {
                        setUsingSavedSig(true);
                        setSigningMethod(savedSig.method);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#15803D] bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      调用已保存默认签名
                    </button>
                  )}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded">
                    <button
                      type="button"
                      onClick={() => setSigningMethod('handwritten')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                        signingMethod === 'handwritten'
                          ? 'bg-white text-[#103D6B] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      手写电子签名
                    </button>
                    <button
                      type="button"
                      onClick={() => setSigningMethod('typed_seal')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                        signingMethod === 'typed_seal'
                          ? 'bg-white text-[#103D6B] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      实名电子签章
                    </button>
                  </div>
                </div>
              )}
            </div>

            {usingSavedSig && savedSig ? (
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <div className="inline-flex items-center gap-1.5 font-semibold text-[#15803D]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    已自动调用本人预存默认电子签名
                  </div>
                  <div className="text-slate-600">
                    签名类型：
                    {savedSig.method === 'handwritten'
                      ? '本人手写电子笔迹'
                      : '实名合规电子签章'}
                    ，无需重复书写，勾选上方全部条款后即可直接完成签署。
                  </div>
                </div>

                <div className="shrink-0">
                  {savedSig.method === 'handwritten' && savedSig.signatureDataUrl ? (
                    <div className="border border-slate-200 rounded bg-white p-2">
                      <img
                        src={savedSig.signatureDataUrl}
                        alt={`${seat.memberName}默认电子签名`}
                        className="h-14 w-36 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="inline-flex flex-col items-center px-4 py-1.5 border-2 border-[#B91C1C]/80 text-[#B91C1C] rounded-xs bg-white">
                      <span className="text-[10px] tracking-widest">
                        信评委合规电子签章
                      </span>
                      <span className="text-sm font-bold tracking-widest">
                        {savedSig.typedSealText || seat.memberName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : signingMethod === 'handwritten' ? (
              <div className="space-y-2.5">
                <div className="relative border border-dashed border-slate-300 rounded bg-[#FAFBFC] overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="w-full h-36 touch-none cursor-crosshair block"
                  />
                  {!hasDrawnStroke && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                      <PenTool className="w-3.5 h-3.5" />
                      <span>请在此签名区域使用鼠标或触控笔手写签署「{seat.memberName}」</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {hasDrawnStroke
                      ? '已采集手写电子笔迹，提交后将生成不可篡改摘要存证'
                      : '请先手写签名后提交'}
                  </span>
                  <button
                    type="button"
                    onClick={clearSignaturePad}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                  >
                    <Eraser className="w-3 h-3" />
                    清空重写
                  </button>
                </div>
                {onSaveDefaultSignature && (
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={saveAsDefault}
                      onChange={(e) => setSaveAsDefault(e.target.checked)}
                      className="rounded border-slate-300 text-[#103D6B] focus:ring-[#103D6B]"
                    />
                    <span>同步保存为我的默认电子签名，后续签署回避承诺函时自动调用</span>
                  </label>
                )}
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    请完整键入本人实名「<span className="font-semibold text-[#103D6B]">{seat.memberName}</span>」以核验并加盖合规电子签章
                  </label>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder={`请输入：${seat.memberName}`}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:outline-none focus:border-[#103D6B]"
                  />
                </div>
                {typedMatches && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-[#15803D] font-medium">
                      实名核验通过，已预览合规电子签章
                    </span>
                    <div className="inline-flex flex-col items-center px-4 py-1.5 border-2 border-[#B91C1C]/80 text-[#B91C1C] rounded-xs bg-white">
                      <span className="text-[10px] tracking-widest">信评委合规电子签章</span>
                      <span className="text-sm font-bold tracking-widest">
                        {seat.memberName}
                      </span>
                    </div>
                  </div>
                )}
                {onSaveDefaultSignature && (
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={saveAsDefault}
                      onChange={(e) => setSaveAsDefault(e.target.checked)}
                      className="rounded border-slate-300 text-[#103D6B] focus:ring-[#103D6B]"
                    />
                    <span>同步保存为我的默认电子签章，后续签署回避承诺函时自动调用</span>
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            {!allClausesChecked
              ? '请先勾选全部 3 项利益冲突回避条款'
              : !signatureReady
              ? signingMethod === 'handwritten'
                ? '请在签名板完成手写电子签名'
                : `请准确输入「${seat.memberName}」完成实名签章`
              : '合规条款与电子签名均已就绪，可正式签署确认参会'}
          </span>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              确认电子签署并锁定出席
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

