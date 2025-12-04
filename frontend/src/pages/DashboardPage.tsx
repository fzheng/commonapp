import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api, DashboardStats, UpcomingDeadline } from '../api/client';
import { STATUS_LABELS, ROUND_TYPE_LABELS, getCycleOptions, ApplicationStatus, RoundType } from '../types';
import { StatusBadge, RoundBadge } from '../components/common/StatusBadge';
import Select from '../components/common/Select';

export default function DashboardPage() {
  const { currentCycle } = useApp();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deadlines, setDeadlines] = useState<UpcomingDeadline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState(currentCycle);
  const [deadlineWindow, setDeadlineWindow] = useState(30);

  useEffect(() => {
    loadData();
  }, [selectedCycle, deadlineWindow]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsData, deadlinesData] = await Promise.all([
        api.dashboard.getStats(selectedCycle),
        api.dashboard.getUpcomingDeadlines({
          days: deadlineWindow,
          cycle: selectedCycle,
          includeOverdue: true,
        }),
      ]);
      setStats(statsData);
      setDeadlines(deadlinesData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-6 h-24" />
          ))}
        </div>
        <div className="bg-white rounded-lg p-6 h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="w-64">
          <Select
            label="Cycle"
            value={selectedCycle}
            onChange={(e) => setSelectedCycle(e.target.value)}
            options={getCycleOptions()}
          />
        </div>
        <div className="w-48">
          <Select
            label="Deadline Window"
            value={deadlineWindow}
            onChange={(e) => setDeadlineWindow(Number(e.target.value))}
            options={[
              { value: 7, label: 'Next 7 days' },
              { value: 14, label: 'Next 14 days' },
              { value: 30, label: 'Next 30 days' },
              { value: 60, label: 'Next 60 days' },
            ]}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={stats?.totalStudents || 0} icon={<UsersIcon />} color="blue" />
        <StatCard title="Total Applications" value={stats?.totalApplications || 0} icon={<DocumentIcon />} color="indigo" />
        <StatCard title="Submitted" value={stats?.applicationsByStatus.SUBMITTED || 0} icon={<CheckIcon />} color="green" />
        <StatCard title="Admitted" value={stats?.applicationsByStatus.ADMITTED || 0} icon={<StarIcon />} color="yellow" />
      </div>

      {/* Applications by Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Applications by Status</h3>
          <div className="space-y-3">
            {Object.entries(stats?.applicationsByStatus || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <StatusBadge status={status as ApplicationStatus} />
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Applications by Round</h3>
          <div className="space-y-3">
            {Object.entries(stats?.applicationsByRound || {})
              .filter(([, count]) => count > 0)
              .map(([round, count]) => (
                <div key={round} className="flex items-center justify-between">
                  <RoundBadge round={round as RoundType} />
                  <span className="font-medium">{count}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Upcoming Deadlines</h3>
        </div>
        {deadlines.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No upcoming deadlines in the selected window
          </div>
        ) : (
          <div className="divide-y">
            {deadlines.map((deadline, index) => (
              <div
                key={`${deadline.student_id}-${deadline.college_id}-${index}`}
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                onClick={() => navigate(`/students/${deadline.student_id}`)}
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold ${
                      deadline.days_until < 0
                        ? 'bg-red-100 text-red-600'
                        : deadline.days_until <= 7
                        ? 'bg-yellow-100 text-yellow-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {deadline.days_until < 0 ? 'PAST' : formatDate(deadline.deadline_date)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{deadline.student_name}</p>
                    <p className="text-sm text-gray-500">{deadline.college_name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <RoundBadge round={deadline.round_type as RoundType} size="sm" />
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        deadline.days_until < 0
                          ? 'text-red-600'
                          : deadline.days_until <= 7
                          ? 'text-yellow-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {deadline.days_until < 0
                        ? `${Math.abs(deadline.days_until)} days overdue`
                        : deadline.days_until === 0
                        ? 'Due today'
                        : `${deadline.days_until} days left`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'indigo' | 'green' | 'yellow';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function UsersIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}
