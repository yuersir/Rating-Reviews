import { AuditActionType, AuditLogEntry, RoleType } from '../types/domain';

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Deterministic 256-bit style hex digest (FNV-1a multi-lane avalanche mix)
 * so hash chaining runs synchronously in all browser contexts without async race conditions.
 */
export function computeDeterministicHash(input: string): string {
  const lanes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5];
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    for (let l = 0; l < lanes.length; l++) {
      let h = lanes[l] ^ (ch + l * 31 + i);
      h = Math.imul(h, 0x01000193);
      h ^= h >>> 13;
      h = Math.imul(h, 0x5bd1e995);
      lanes[l] = (h ^ (h >>> 15)) >>> 0;
    }
  }
  return lanes.map((v) => v.toString(16).padStart(8, '0')).join('');
}

export function buildAuditPayloadString(
  entry: Omit<AuditLogEntry, 'hash'>
): string {
  return [
    entry.seq,
    entry.id,
    entry.timestamp,
    entry.actorRole,
    entry.actorName,
    entry.actionType,
    entry.targetRef,
    entry.summary,
    entry.details,
    entry.prevHash,
  ].join('|');
}

export function createAuditLogEntry(
  existingLogs: AuditLogEntry[],
  params: {
    actorRole: RoleType;
    actorName: string;
    actionType: AuditActionType;
    targetRef: string;
    summary: string;
    details: string;
    timestamp?: string;
  }
): AuditLogEntry {
  const lastEntry = existingLogs.length > 0 ? existingLogs[existingLogs.length - 1] : null;
  const seq = lastEntry ? lastEntry.seq + 1 : 1;
  const prevHash = lastEntry ? lastEntry.hash : GENESIS_HASH;
  const timestamp = params.timestamp ?? new Date().toISOString();
  const id = `AUD-${String(seq).padStart(5, '0')}`;

  const base: Omit<AuditLogEntry, 'hash'> = {
    seq,
    id,
    timestamp,
    actorRole: params.actorRole,
    actorName: params.actorName,
    actionType: params.actionType,
    targetRef: params.targetRef,
    summary: params.summary,
    details: params.details,
    prevHash,
  };

  const hash = computeDeterministicHash(buildAuditPayloadString(base));
  return { ...base, hash };
}

export interface AuditChainVerification {
  valid: boolean;
  checkedCount: number;
  brokenAtSeq?: number;
  message: string;
}

export function verifyAuditChain(logs: AuditLogEntry[]): AuditChainVerification {
  if (logs.length === 0) {
    return {
      valid: true,
      checkedCount: 0,
      message: '当前暂无审计日志记录。',
    };
  }

  let expectedPrev = GENESIS_HASH;
  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];
    if (entry.prevHash !== expectedPrev) {
      return {
        valid: false,
        checkedCount: i + 1,
        brokenAtSeq: entry.seq,
        message: `第 #${entry.seq} 条记录前序哈希不匹配，检测到链条断裂风险。`,
      };
    }
    const { hash, ...rest } = entry;
    const recomputed = computeDeterministicHash(buildAuditPayloadString(rest));
    if (recomputed !== hash) {
      return {
        valid: false,
        checkedCount: i + 1,
        brokenAtSeq: entry.seq,
        message: `第 #${entry.seq} 条记录摘要校验失败，内容可能被篡改。`,
      };
    }
    expectedPrev = hash;
  }

  return {
    valid: true,
    checkedCount: logs.length,
    message: `已完成全部 ${logs.length} 条记录的链式哈希逐条核验，日志链完整且未被篡改。`,
  };
}

export function exportAuditLogsToCSV(logs: AuditLogEntry[]): string {
  const headers = [
    '序号',
    '审计编号',
    '时间戳',
    '操作角色',
    '操作人',
    '事件类型',
    '关联对象',
    '摘要',
    '详细信息',
    '前序哈希',
    '当前哈希',
  ];
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = logs.map((l) =>
    [
      l.seq,
      l.id,
      l.timestamp,
      l.actorRole,
      l.actorName,
      l.actionType,
      l.targetRef,
      l.summary,
      l.details,
      l.prevHash,
      l.hash,
    ]
      .map(escapeCell)
      .join(',')
  );
  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
