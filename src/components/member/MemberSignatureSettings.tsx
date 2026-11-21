import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eraser,
  PenTool,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { CommitteeMember, SavedMemberSignature } from '../../types/domain';

interface MemberSignatureSettingsProps {
  member: CommitteeMember;
  onSaveSignature: (memberId: string, signature: SavedMemberSignature) => void;
  onClearSignature: (memberId: string) => void;
}

export function MemberSignatureSettings({
  member,
  onSaveSignature,
  onClearSignature,
}: MemberSignatureSettingsProps) {
  const existing = member.savedSignature;
  const [method, setMethod] = useState<'handwritten' | 'typed_seal'>(
    existing?.method ?? 'handwritten'
  );
  const [autoApply, setAutoApply] = useState<boolean>(
    existing?.autoApply ?? true
  );
  const [hasDrawnStroke, setHasDrawnStroke] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    setMethod(member.savedSignature?.method ?? 'handwritten');
    setAutoApply(member.savedSignature?.autoApply ?? true);
  }, [member.id, member.savedSignature]);

  useEffect(() => {
    if (method !== 'handwritten') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 560;
    const height = rect.height || 168;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#0F172A';
    }
    setHasDrawnStroke(false);
  }, [method, member.id]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
    const pt = getPoint(e);
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
    const pt = getPoint(e);
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

  const clearPad = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawnStroke(false);
  };

  const handleSave = () => {
    const nowIso = new Date().toISOString();
    if (method === 'handwritten') {
      const dataUrl = hasDrawnStroke
        ? canvasRef.current?.toDataURL('image/png')
        : existing?.method === 'handwritten'
        ? existing.signatureDataUrl
        : undefined;
      if (!dataUrl) return;
      onSaveSignature(member.id, {
        method: 'handwritten',
        signatureDataUrl: dataUrl,
        autoApply,
        updatedAt: nowIso,
      });
      setHasDrawnStroke(false);
    } else {
      onSaveSignature(member.id, {
        method: 'typed_seal',
        typedSealText: member.name,
        autoApply,
        updatedAt: nowIso,
      });
    }
  };

  const handleToggleAutoApplyDirect = (nextAuto: boolean) => {
    setAutoApply(nextAuto);
    if (existing) {
      onSaveSignature(member.id, {
        ...existing,
        autoApply: nextAuto,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const canSaveHandwritten =
    hasDrawnStroke ||
    (existing?.method === 'handwritten' && Boolean(existing.signatureDataUrl));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left: Current Saved Signature Status & Preview */}
      <div className="xl:col-span-5 bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              当前已存默认电子签名
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              仅绑定本人身份凭证（{member.name} · {member.employeeCode}）
            </p>
          </div>
          {existing && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#15803D]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              已配置
            </span>
          )}
        </div>

        <div className="p-6 space-y-5">
          {existing ? (
            <>
              <div className="p-5 bg-[#F8FAFC] border border-slate-200 rounded flex flex-col items-center justify-center min-h-[140px]">
                {existing.method === 'handwritten' && existing.signatureDataUrl ? (
                  <img
                    src={existing.signatureDataUrl}
                    alt={`${member.name}默认手写签名`}
                    className="max-h-24 w-auto object-contain"
                  />
                ) : (
                  <div className="inline-flex flex-col items-center px-6 py-2.5 border-2 border-[#B91C1C]/80 text-[#B91C1C] rounded-xs bg-white">
                    <span className="text-[10px] tracking-widest">
                      信评委合规电子签章
                    </span>
                    <span className="text-lg font-bold tracking-widest mt-0.5">
                      {existing.typedSealText || member.name}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums mt-0.5">
                      {member.employeeCode}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">签名方式</span>
                  <span className="font-medium text-slate-900">
                    {existing.method === 'handwritten'
                      ? '本人手写电子笔迹'
                      : '实名合规电子签章'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">最近更新时间</span>
                  <span className="font-mono tabular-nums text-slate-800">
                    {new Date(existing.updatedAt).toLocaleString('zh-CN', {
                      hour12: false,
                    })}
                  </span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3.5 bg-[#EFF6FF]/60 border border-[#103D6B]/20 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={existing.autoApply}
                  onChange={(e) =>
                    handleToggleAutoApplyDirect(e.target.checked)
                  }
                  className="mt-0.5 rounded border-slate-300 text-[#103D6B] focus:ring-[#103D6B]"
                />
                <div className="text-xs">
                  <div className="font-semibold text-[#103D6B]">
                    签署回避承诺函时自动调用此默认签名
                  </div>
                  <div className="text-slate-600 mt-0.5 leading-snug">
                    开启后，确认参会时系统将自动载入已保存签名，仅需逐项核验回避条款即可一键完成签署，大幅减少重复操作。
                  </div>
                </div>
              </label>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => onClearSignature(member.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#B91C1C] bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  清除预存签名
                </button>
              </div>
            </>
          ) : (
            <div className="py-10 text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-medium text-slate-700">
                尚未配置默认电子签名
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                在右侧绘制一次本人手写签名或启用实名电子签章后，后续确认评审会日程将自动调用，无需每次重复手写。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Configure / Update Default Signature */}
      <div className="xl:col-span-7 bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              设置或更新本人默认电子签名
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              支持采集一次手写笔迹或启用实名电子签章，变更将同步写入不可篡改审计日志
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMethod('handwritten')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                method === 'handwritten'
                  ? 'bg-white text-[#103D6B] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              手写电子签名
            </button>
            <button
              type="button"
              onClick={() => setMethod('typed_seal')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                method === 'typed_seal'
                  ? 'bg-white text-[#103D6B] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              实名电子签章
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {method === 'handwritten' ? (
            <div className="space-y-2.5">
              <div className="relative border border-dashed border-slate-300 rounded bg-[#FAFBFC] overflow-hidden">
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="w-full h-44 touch-none cursor-crosshair block"
                />
                {!hasDrawnStroke && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                    <PenTool className="w-4 h-4" />
                    <span>
                      请在此手写签署「{member.name}」并点击下方保存为默认电子签名
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {hasDrawnStroke
                    ? '已采集新手写笔迹，点击保存后将覆盖原默认签名'
                    : '使用鼠标、触控板或手写笔书写本人姓名'}
                </span>
                <button
                  type="button"
                  onClick={clearPad}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  清空重写
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-slate-900">
                  绑定本人实名合规电子签章
                </div>
                <p className="text-slate-600 leading-relaxed max-w-md">
                  系统依据当前已验证身份凭证自动生成专属合规电子签章，签署《利益冲突回避承诺函》时附带工号与时间戳防篡改哈希存证。
                </p>
              </div>
              <div className="inline-flex flex-col items-center px-5 py-2 border-2 border-[#B91C1C]/80 text-[#B91C1C] rounded-xs bg-white shrink-0">
                <span className="text-[10px] tracking-widest">
                  信评委合规电子签章
                </span>
                <span className="text-base font-bold tracking-widest mt-0.5">
                  {member.name}
                </span>
                <span className="text-[10px] font-mono tabular-nums mt-0.5">
                  {member.employeeCode}
                </span>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
              className="rounded border-slate-300 text-[#103D6B] focus:ring-[#103D6B]"
            />
            <span>保存后默认开启「签署承诺函时自动调用已有签名」</span>
          </label>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="button"
              disabled={method === 'handwritten' && !canSaveHandwritten}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#103D6B] rounded hover:bg-[#0B2C4E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              保存为本人默认电子签名
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
