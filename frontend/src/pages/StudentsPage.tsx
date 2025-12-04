import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Student } from '../api/client';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Table from '../components/common/Table';

export default function StudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', hs_grad_year: new Date().getFullYear() + 1, notes: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load students when debounced search changes
  useEffect(() => {
    loadStudents();
  }, [debouncedSearch]);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const data = await api.students.list({ search: debouncedSearch || undefined });
      setStudents(data);
    } catch (error) {
      console.error('Failed to load students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingStudent(null);
    setFormData({ name: '', email: '', hs_grad_year: new Date().getFullYear() + 1, notes: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      email: student.email || '',
      hs_grad_year: student.hs_grad_year,
      notes: student.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingStudent) {
        await api.students.update(editingStudent.id, formData);
      } else {
        await api.students.create(formData);
      }
      setIsModalOpen(false);
      loadStudents();
    } catch (error) {
      console.error('Failed to save student:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (student: Student) => {
    if (!confirm(`Are you sure you want to delete ${student.name}?`)) return;
    try {
      await api.students.delete(student.id);
      loadStudents();
    } catch (error) {
      console.error('Failed to delete student:', error);
    }
  };

  const columns = [
    { key: 'name', header: 'Name', render: (s: Student) => <span className="font-medium">{s.name}</span> },
    { key: 'email', header: 'Email', render: (s: Student) => s.email || '-' },
    { key: 'hs_grad_year', header: 'Grad Year' },
    { key: 'application_count', header: 'Applications', render: (s: Student) => s.application_count || 0 },
    {
      key: 'actions',
      header: '',
      render: (s: Student) => (
        <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => handleEdit(s)} className="text-blue-600 hover:text-blue-800">Edit</button>
          <button onClick={() => handleDelete(s)} className="text-red-600 hover:text-red-800">Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Button onClick={handleCreate}>Add Student</Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 h-16" />
          ))}
        </div>
      ) : (
        <Table
          columns={columns}
          data={students}
          onRowClick={(s) => navigate(`/students/${s.id}`)}
          emptyMessage="No students found"
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStudent ? 'Edit Student' : 'Add Student'}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="High School Graduation Year"
            type="number"
            value={formData.hs_grad_year}
            onChange={(e) => setFormData({ ...formData, hs_grad_year: parseInt(e.target.value) })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving} disabled={!formData.name}>
              {editingStudent ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
