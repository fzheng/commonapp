import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Student, ApplicationWithDetails, College, RoundDeadline } from '../api/client';
import { useApp } from '../context/AppContext';
import { ROUND_TYPE_LABELS, STATUS_LABELS, RoundType, ApplicationStatus } from '../types';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import SearchableSelect from '../components/common/SearchableSelect';
import Modal from '../components/common/Modal';
import { RoundBadge } from '../components/common/StatusBadge';

// Round display order
const ROUND_ORDER: RoundType[] = ['ED', 'ED2', 'REA', 'EA', 'RD', 'ROLLING'];

// Format deadline date for display
function formatDeadline(dateStr: string | null): string {
  if (!dateStr) return 'TBD';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCycle } = useApp();
  const [student, setStudent] = useState<Student | null>(null);
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ college_id: 0, round_type: 'RD' as RoundType, cycle: currentCycle });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [studentData, appsData, collegesData] = await Promise.all([
        api.students.get(parseInt(id)),
        api.applications.list({ student_id: parseInt(id) }),
        api.colleges.list(),
      ]);
      setStudent(studentData);
      setApplications(appsData);
      setColleges(collegesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddApplication = () => {
    const firstCollege = colleges[0];
    const defaultRound = getDefaultRoundForCollege(firstCollege);
    setFormData({ college_id: firstCollege?.id || 0, round_type: defaultRound, cycle: currentCycle });
    setIsModalOpen(true);
  };

  // Get the default round for a college (first available or RD)
  const getDefaultRoundForCollege = (college: College | undefined): RoundType => {
    if (!college?.round_deadlines || college.round_deadlines.length === 0) {
      return 'RD';
    }
    // Return the first round in display order that exists
    for (const round of ROUND_ORDER) {
      if (college.round_deadlines.some(rd => rd.round_type === round)) {
        return round;
      }
    }
    return 'RD';
  };

  // Handle college selection change - reset round to appropriate default
  const handleCollegeChange = (collegeId: number) => {
    const selectedCollege = colleges.find(c => c.id === collegeId);
    const defaultRound = getDefaultRoundForCollege(selectedCollege);
    setFormData({ ...formData, college_id: collegeId, round_type: defaultRound });
  };

  // Get available rounds for the selected college
  const selectedCollege = useMemo(() =>
    colleges.find(c => c.id === formData.college_id),
    [colleges, formData.college_id]
  );

  const availableRoundOptions = useMemo(() => {
    const roundDeadlines = selectedCollege?.round_deadlines || [];

    // If no rounds configured, just show RD with TBD
    if (roundDeadlines.length === 0) {
      return [{ value: 'RD', label: `${ROUND_TYPE_LABELS.RD} (TBD)` }];
    }

    // Sort rounds by display order and include deadline info
    return ROUND_ORDER
      .filter(round => roundDeadlines.some(rd => rd.round_type === round))
      .map(round => {
        const deadline = roundDeadlines.find(rd => rd.round_type === round);
        const deadlineStr = formatDeadline(deadline?.deadline_date || null);
        return {
          value: round,
          label: `${ROUND_TYPE_LABELS[round]} (${deadlineStr})`,
        };
      });
  }, [selectedCollege]);

  const handleSaveApplication = async () => {
    if (!id || !formData.college_id) return;
    try {
      await api.applications.create({
        student_id: parseInt(id),
        college_id: formData.college_id,
        round_type: formData.round_type,
        cycle: formData.cycle,
      });
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to add application:', error);
    }
  };

  const handleStatusChange = async (appId: number, status: ApplicationStatus) => {
    try {
      await api.applications.update(appId, { status });
      loadData();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleDeleteApplication = async (appId: number) => {
    if (!confirm('Are you sure you want to remove this application?')) return;
    try {
      await api.applications.delete(appId);
      loadData();
    } catch (error) {
      console.error('Failed to delete application:', error);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse bg-white rounded-lg p-6 h-96" />;
  }

  if (!student) {
    return <div className="text-center py-12 text-gray-500">Student not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/students')} className="text-blue-600 hover:text-blue-800 text-sm mb-2">
            &larr; Back to Students
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
          <p className="text-gray-500">Class of {student.hs_grad_year} {student.email && `| ${student.email}`}</p>
        </div>
        <Button onClick={handleAddApplication}>Add Application</Button>
      </div>

      {/* Notes */}
      {student.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-1">Notes</h3>
          <p className="text-sm text-yellow-700">{student.notes}</p>
        </div>
      )}

      {/* Applications */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Applications ({applications.length})</h2>
        </div>
        {applications.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No applications yet</div>
        ) : (
          <div className="divide-y">
            {applications.map((app) => (
              <div key={app.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="font-medium text-gray-900">{app.college_name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <RoundBadge round={app.round_type as RoundType} size="sm" />
                      <span className="text-sm text-gray-500">{app.cycle}</span>
                      {app.deadline_date && (
                        <span className="text-sm text-gray-500">| Due: {new Date(app.deadline_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <select
                    value={app.status}
                    onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <button onClick={() => handleDeleteApplication(app.id)} className="text-red-600 hover:text-red-800 text-sm">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Application Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Application">
        <div className="space-y-4">
          <SearchableSelect
            label="College"
            value={formData.college_id}
            onChange={(val) => handleCollegeChange(val as number)}
            options={colleges.map((c) => ({ value: c.id, label: `${c.name} ${c.usnews_rank ? `(#${c.usnews_rank})` : ''}` }))}
            placeholder="Search for a college..."
          />
          <Select
            label="Round"
            value={formData.round_type}
            onChange={(e) => setFormData({ ...formData, round_type: e.target.value as RoundType })}
            options={availableRoundOptions}
          />
          {selectedCollege && (!selectedCollege.round_deadlines || selectedCollege.round_deadlines.length === 0) && (
            <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded">
              No deadline data available for this college. Admin can add deadlines on the college detail page.
            </p>
          )}
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveApplication} disabled={!formData.college_id}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
