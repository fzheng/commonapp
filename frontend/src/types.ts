export type RoundType = 'ED' | 'ED2' | 'EA' | 'REA' | 'RD' | 'ROLLING';
export type ApplicationStatus = 'PLANNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' | 'WITHDRAWN';
export type DataSource = 'MANUAL' | 'CRAWLER';
export type CrawlFrequency = 'weekly' | 'monthly' | 'manual';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  ADMITTED: 'Admitted',
  REJECTED: 'Rejected',
  WAITLISTED: 'Waitlisted',
  DEFERRED: 'Deferred',
  WITHDRAWN: 'Withdrawn',
};

export const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  ED: 'Early Decision',
  ED2: 'Early Decision II',
  EA: 'Early Action',
  REA: 'Restrictive EA',
  RD: 'Regular Decision',
  ROLLING: 'Rolling',
};

export const ROUND_TYPE_DESCRIPTIONS: Record<RoundType, string> = {
  ED: 'Binding commitment. If admitted, you must attend and withdraw all other applications. Typically due early November with decisions mid-December.',
  ED2: 'Second round of Early Decision with later deadline (usually January). Same binding commitment as ED.',
  EA: 'Non-binding early application. Apply early, get decision early, but no obligation to attend. Can apply EA to multiple schools.',
  REA: 'Restrictive Early Action (also called SCEA). Non-binding but restricts applying early to other private schools. Common at Harvard, Yale, Stanford, Princeton.',
  RD: 'Regular Decision. Standard application deadline (usually January 1-15) with decisions by late March/April. Non-binding.',
  ROLLING: 'Applications reviewed as received. No fixed deadline; decisions sent continuously. Apply early for best chances.',
};

export const STATUS_DESCRIPTIONS: Record<ApplicationStatus, string> = {
  PLANNED: 'Student intends to apply but hasn\'t started yet.',
  IN_PROGRESS: 'Application is being worked on but not yet submitted.',
  SUBMITTED: 'Application has been submitted and is awaiting a decision.',
  ADMITTED: 'Student has been accepted to the college.',
  REJECTED: 'Student was not accepted.',
  WAITLISTED: 'Student is on the waitlist pending space availability.',
  DEFERRED: 'Early application was deferred to regular decision round.',
  WITHDRAWN: 'Student withdrew their application.',
};

export function getCurrentCycle(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 8) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

export function getCycleOptions(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  const options = [];
  for (let i = -1; i <= 2; i++) {
    const startYear = currentYear + i;
    const cycle = `${startYear}-${startYear + 1}`;
    options.push({ value: cycle, label: cycle });
  }
  return options;
}

export const DEADLINE_WINDOW_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
];

export const CRAWL_FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'manual', label: 'Manual only' },
];
