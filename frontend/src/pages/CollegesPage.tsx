import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, College, RoundDeadline } from '../api/client';
import Input from '../components/common/Input';
import Table from '../components/common/Table';

// Round type badge colors
const roundColors: Record<string, string> = {
  ED: 'bg-red-100 text-red-800',
  ED2: 'bg-orange-100 text-orange-800',
  EA: 'bg-blue-100 text-blue-800',
  REA: 'bg-purple-100 text-purple-800',
  RD: 'bg-green-100 text-green-800',
  ROLLING: 'bg-gray-100 text-gray-800',
};

// Round type display order
const roundOrder = ['ED', 'ED2', 'REA', 'EA', 'RD', 'ROLLING'];

// Format date for tooltip
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No date set';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function RoundBadges({ roundDeadlines }: { roundDeadlines: RoundDeadline[] }) {
  if (!roundDeadlines || roundDeadlines.length === 0) return <span className="text-gray-400">-</span>;

  // Sort rounds by display order
  const sorted = [...roundDeadlines].sort(
    (a, b) => roundOrder.indexOf(a.round_type) - roundOrder.indexOf(b.round_type)
  );

  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((rd) => (
        <span
          key={rd.round_type}
          title={`${rd.round_type}: ${formatDate(rd.deadline_date)}`}
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roundColors[rd.round_type] || 'bg-gray-100 text-gray-800'}`}
        >
          {rd.round_type}
        </span>
      ))}
    </div>
  );
}

export default function CollegesPage() {
  const navigate = useNavigate();
  const [colleges, setColleges] = useState<College[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load colleges when debounced search changes
  useEffect(() => {
    loadColleges();
  }, [debouncedSearch]);

  const loadColleges = async () => {
    setIsLoading(true);
    try {
      const data = await api.colleges.list({ search: debouncedSearch || undefined });
      setColleges(data);
    } catch (error) {
      console.error('Failed to load colleges:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    {
      key: 'usnews_rank',
      header: 'Rank',
      render: (c: College) => c.usnews_rank ? `#${c.usnews_rank}` : '-',
      className: 'w-20',
    },
    {
      key: 'name',
      header: 'Name',
      render: (c: College) => <span className="font-medium">{c.name}</span>,
    },
    {
      key: 'round_deadlines',
      header: 'Deadlines',
      render: (c: College) => <RoundBadges roundDeadlines={c.round_deadlines || []} />,
    },
    {
      key: 'location',
      header: 'Location',
      render: (c: College) => c.city && c.state ? `${c.city}, ${c.state}` : '-',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search colleges..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <p className="text-sm text-gray-500">{colleges.length} colleges</p>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 h-16" />
          ))}
        </div>
      ) : (
        <Table
          columns={columns}
          data={colleges}
          onRowClick={(c) => navigate(`/colleges/${c.id}`)}
          emptyMessage="No colleges found"
        />
      )}
    </div>
  );
}
