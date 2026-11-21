import { useEffect, useState } from 'react';
import { SeatResponseStatus } from '../../types/domain';

interface CountdownTextProps {
  deadlineAt: string;
  status: SeatResponseStatus;
  respondedAt?: string;
}

export function CountdownText({ deadlineAt, status, respondedAt }: CountdownTextProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (status !== 'pending') return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  if (status === 'confirmed') {
    const timeStr = respondedAt
      ? new Date(respondedAt).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    return (
      <span className="text-xs font-medium text-[#15803D] tabular-nums whitespace-nowrap">
        已确认出席{timeStr ? ` · ${timeStr}` : ''}
      </span>
    );
  }

  if (status === 'declined') {
    return (
      <span className="text-xs font-medium text-[#B91C1C] whitespace-nowrap">
        已回避退回
      </span>
    );
  }

  if (status === 'timed_out') {
    return (
      <span className="text-xs font-medium text-[#B91C1C] whitespace-nowrap">
        已超时失效
      </span>
    );
  }

  const remainingSec = Math.max(
    0,
    Math.floor((new Date(deadlineAt).getTime() - nowMs) / 1000)
  );
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const isUrgent = remainingSec <= 5 * 60;

  return (
    <span
      className={`text-xs font-mono tabular-nums whitespace-nowrap ${
        isUrgent ? 'text-[#B91C1C] font-semibold' : 'text-[#B45309] font-medium'
      }`}
    >
      待确认 · 剩余 {formatted}
    </span>
  );
}
