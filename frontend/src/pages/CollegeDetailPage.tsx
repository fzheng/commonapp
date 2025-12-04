import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, CollegeWithRounds, CollegeRound } from '../api/client';
import { useApp } from '../context/AppContext';
import { ROUND_TYPE_LABELS, RoundType, getCycleOptions } from '../types';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Modal from '../components/common/Modal';
import { RoundBadge } from '../components/common/StatusBadge';

export default function CollegeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCycle } = useApp();
  const [college, setCollege] = useState<CollegeWithRounds | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRound, setEditingRound] = useState<CollegeRound | null>(null);
  const [formData, setFormData] = useState({
    round_type: 'RD' as RoundType,
    cycle: currentCycle,
    deadline_date: '',
    decision_date: '',
  });

  useEffect(() => {
    loadCollege();
  }, [id]);

  const loadCollege = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await api.colleges.get(parseInt(id));
      setCollege(data);
    } catch (error) {
      console.error('Failed to load college:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRound = () => {
    setEditingRound(null);
    setFormData({ round_type: 'RD', cycle: currentCycle, deadline_date: '', decision_date: '' });
    setIsModalOpen(true);
  };

  const handleEditRound = (round: CollegeRound) => {
    setEditingRound(round);
    setFormData({
      round_type: round.round_type,
      cycle: round.cycle,
      deadline_date: round.deadline_date || '',
      decision_date: round.decision_date || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveRound = async () => {
    if (!id) return;
    try {
      const data = {
        ...formData,
        deadline_date: formData.deadline_date || null,
        decision_date: formData.decision_date || null,
      };

      if (editingRound) {
        await api.colleges.updateRound(parseInt(id), editingRound.id, data);
      } else {
        await api.colleges.createRound(parseInt(id), data);
      }
      setIsModalOpen(false);
      loadCollege();
    } catch (error) {
      console.error('Failed to save round:', error);
    }
  };

  const handleDeleteRound = async (roundId: number) => {
    if (!id || !confirm('Are you sure you want to delete this round?')) return;
    try {
      await api.colleges.deleteRound(parseInt(id), roundId);
      loadCollege();
    } catch (error) {
      console.error('Failed to delete round:', error);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse bg-white rounded-lg p-6 h-96" />;
  }

  if (!college) {
    return <div className="text-center py-12 text-gray-500">College not found</div>;
  }

  const currentCycleRounds = (college.rounds || []).filter((r) => r.cycle === currentCycle);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/colleges')} className="text-blue-600 hover:text-blue-800 text-sm mb-2">
            &larr; Back to Colleges
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{college.name}</h1>
          <p className="text-gray-500">
            {college.city && college.state && `${college.city}, ${college.state}`}
            {college.usnews_rank && ` | US News Rank: #${college.usnews_rank}`}
          </p>
        </div>
      </div>

      {/* Admissions URL */}
      {college.admissions_url && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-1">Admissions Page</h3>
          <a href={college.admissions_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
            {college.admissions_url}
          </a>
        </div>
      )}

      {/* Deadlines */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Deadlines - {currentCycle}</h2>
          <Button size="sm" onClick={handleAddRound}>Add Round</Button>
        </div>
        {currentCycleRounds.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No deadlines configured for this cycle</div>
        ) : (
          <div className="divide-y">
            {currentCycleRounds.map((round) => (
              <div key={round.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <RoundBadge round={round.round_type} />
                  <div>
                    <p className="text-sm text-gray-900">
                      Deadline: {round.deadline_date ? new Date(round.deadline_date).toLocaleDateString() : 'Not set'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Decision: {round.decision_date ? new Date(round.decision_date).toLocaleDateString() : 'Not set'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`text-xs px-2 py-1 rounded ${round.source === 'CRAWLER' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                    {round.source}
                  </span>
                  {round.admin_confirmed && (
                    <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Confirmed</span>
                  )}
                  <button onClick={() => handleEditRound(round)} className="text-blue-600 hover:text-blue-800 text-sm">
                    Edit
                  </button>
                  <button onClick={() => handleDeleteRound(round.id)} className="text-red-600 hover:text-red-800 text-sm">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRound ? 'Edit Round' : 'Add Round'}>
        <div className="space-y-4">
          <Select
            label="Round Type"
            value={formData.round_type}
            onChange={(e) => setFormData({ ...formData, round_type: e.target.value as RoundType })}
            options={Object.entries(ROUND_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            disabled={!!editingRound}
          />
          <Select
            label="Cycle"
            value={formData.cycle}
            onChange={(e) => setFormData({ ...formData, cycle: e.target.value })}
            options={getCycleOptions()}
            disabled={!!editingRound}
          />
          <Input
            label="Deadline Date"
            type="date"
            value={formData.deadline_date}
            onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
          />
          <Input
            label="Decision Date"
            type="date"
            value={formData.decision_date}
            onChange={(e) => setFormData({ ...formData, decision_date: e.target.value })}
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRound}>{editingRound ? 'Update' : 'Add'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
