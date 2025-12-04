const API_BASE = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Students
  students: {
    list: (params?: { search?: string; hs_grad_year?: number }) => {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.hs_grad_year) query.set('hs_grad_year', params.hs_grad_year.toString());
      return request<Student[]>(`/students?${query}`);
    },
    get: (id: number) => request<Student>(`/students/${id}`),
    create: (data: Omit<Student, 'id' | 'created_at' | 'updated_at'>) =>
      request<Student>('/students', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Student>) =>
      request<Student>(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/students/${id}`, { method: 'DELETE' }),
  },

  // Colleges
  colleges: {
    list: (params?: { search?: string }) => {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      return request<College[]>(`/colleges?${query}`);
    },
    get: (id: number) => request<CollegeWithRounds>(`/colleges/${id}`),
    update: (id: number, data: Partial<College>) =>
      request<College>(`/colleges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    createRound: (collegeId: number, data: Omit<CollegeRound, 'id' | 'college_id'>) =>
      request<CollegeRound>(`/colleges/${collegeId}/rounds`, { method: 'POST', body: JSON.stringify(data) }),
    updateRound: (collegeId: number, roundId: number, data: Partial<CollegeRound>) =>
      request<CollegeRound>(`/colleges/${collegeId}/rounds/${roundId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRound: (collegeId: number, roundId: number) =>
      request<void>(`/colleges/${collegeId}/rounds/${roundId}`, { method: 'DELETE' }),
  },

  // Applications
  applications: {
    list: (params?: { student_id?: number; college_id?: number; cycle?: string; status?: string; round_type?: string }) => {
      const query = new URLSearchParams();
      if (params?.student_id) query.set('student_id', params.student_id.toString());
      if (params?.college_id) query.set('college_id', params.college_id.toString());
      if (params?.cycle) query.set('cycle', params.cycle);
      if (params?.status) query.set('status', params.status);
      if (params?.round_type) query.set('round_type', params.round_type);
      return request<ApplicationWithDetails[]>(`/applications?${query}`);
    },
    create: (data: { student_id: number; college_id: number; round_type: string; cycle: string; status?: string }) =>
      request<StudentApplication>('/applications', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<StudentApplication>) =>
      request<StudentApplication>(`/applications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/applications/${id}`, { method: 'DELETE' }),
  },

  // Dashboard
  dashboard: {
    getStats: (cycle: string) => request<DashboardStats>(`/dashboard/stats?cycle=${cycle}`),
    getUpcomingDeadlines: (params: { days: number; cycle: string; includeOverdue?: boolean }) => {
      const query = new URLSearchParams({
        days: params.days.toString(),
        cycle: params.cycle,
        includeOverdue: params.includeOverdue ? 'true' : 'false',
      });
      return request<UpcomingDeadline[]>(`/dashboard/upcoming-deadlines?${query}`);
    },
  },

  // Settings
  settings: {
    get: () => request<SystemSettings>('/settings'),
    update: (data: Partial<SystemSettings>) =>
      request<SystemSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
    export: (format: 'csv' | 'json') => request<{ data: string; filename: string }>(`/settings/export?format=${format}`),
  },

  // Crawler
  crawler: {
    run: () => request<CrawlLog>('/crawler/run', { method: 'POST' }),
    getLogs: (limit?: number) => request<CrawlLog[]>(`/crawler/logs?limit=${limit || 10}`),
    getStatus: () => request<{ isRunning: boolean; lastRun: CrawlLog | null }>('/crawler/status'),
  },
};

// Types
export interface Student {
  id: number;
  name: string;
  email: string | null;
  hs_grad_year: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  application_count?: number;
}

export interface RoundDeadline {
  round_type: string;
  deadline_date: string | null;
}

export interface College {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  admissions_url: string | null;
  usnews_rank: number | null;
  available_rounds?: string[];
  round_deadlines?: RoundDeadline[];
}

export interface CollegeRound {
  id: number;
  college_id: number;
  round_type: 'ED' | 'ED2' | 'EA' | 'REA' | 'RD' | 'ROLLING';
  cycle: string;
  deadline_date: string | null;
  decision_date: string | null;
  source: 'MANUAL' | 'CRAWLER';
  admin_confirmed: boolean;
  last_crawled_at: string | null;
}

export interface CollegeWithRounds extends College {
  rounds: CollegeRound[];
}

export interface StudentApplication {
  id: number;
  student_id: number;
  college_id: number;
  round_type: 'ED' | 'ED2' | 'EA' | 'REA' | 'RD' | 'ROLLING';
  cycle: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' | 'WITHDRAWN';
  submitted_at: string | null;
  decision_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationWithDetails extends StudentApplication {
  student_name: string;
  college_name: string;
  deadline_date: string | null;
}

export interface DashboardStats {
  totalStudents: number;
  totalApplications: number;
  applicationsByStatus: Record<string, number>;
  applicationsByRound: Record<string, number>;
}

export interface UpcomingDeadline {
  student_id: number;
  student_name: string;
  college_id: number;
  college_name: string;
  round_type: string;
  deadline_date: string;
  days_until: number;
  status: string;
}

export interface SystemSettings {
  id: number;
  current_cycle: string;
  crawl_frequency: 'weekly' | 'monthly' | 'manual';
  dashboard_deadline_window_days: number;
  default_export_folder: string | null;
}

export interface CrawlLog {
  id: number;
  run_started_at: string;
  run_finished_at: string | null;
  colleges_attempted: number;
  colleges_successful: number;
  colleges_failed: number;
  details: string | null;
}
