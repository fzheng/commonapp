import React from 'react';
import { STATUS_LABELS, ROUND_TYPE_LABELS, ApplicationStatus, RoundType } from '../../types';

interface StatusBadgeProps {
  status: ApplicationStatus;
  size?: 'sm' | 'md';
}

const statusColors: Record<ApplicationStatus, string> = {
  PLANNED: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-purple-100 text-purple-700',
  ADMITTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  WAITLISTED: 'bg-yellow-100 text-yellow-700',
  DEFERRED: 'bg-orange-100 text-orange-700',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${statusColors[status]} ${sizeClasses}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

interface RoundBadgeProps {
  round: RoundType;
  size?: 'sm' | 'md';
}

const roundColors: Record<RoundType, string> = {
  ED: 'bg-red-100 text-red-700',
  ED2: 'bg-red-100 text-red-700',
  EA: 'bg-orange-100 text-orange-700',
  REA: 'bg-orange-100 text-orange-700',
  RD: 'bg-blue-100 text-blue-700',
  ROLLING: 'bg-green-100 text-green-700',
};

export function RoundBadge({ round, size = 'md' }: RoundBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${roundColors[round]} ${sizeClasses}`}>
      {ROUND_TYPE_LABELS[round]}
    </span>
  );
}
