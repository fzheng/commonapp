import React, { useState } from 'react';
import {
  ROUND_TYPE_LABELS,
  ROUND_TYPE_DESCRIPTIONS,
  STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  RoundType,
  ApplicationStatus,
} from '../../types';

// Round type badge colors (same as CollegesPage)
const roundColors: Record<string, string> = {
  ED: 'bg-red-100 text-red-800',
  ED2: 'bg-orange-100 text-orange-800',
  EA: 'bg-blue-100 text-blue-800',
  REA: 'bg-purple-100 text-purple-800',
  RD: 'bg-green-100 text-green-800',
  ROLLING: 'bg-gray-100 text-gray-800',
};

// Status colors
const statusColors: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  ADMITTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  WAITLISTED: 'bg-orange-100 text-orange-800',
  DEFERRED: 'bg-purple-100 text-purple-800',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
};

interface GlossaryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Glossary({ isOpen, onClose }: GlossaryProps) {
  const [activeTab, setActiveTab] = useState<'rounds' | 'statuses'>('rounds');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-30" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Terminology Glossary</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('rounds')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === 'rounds'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Application Rounds
            </button>
            <button
              onClick={() => setActiveTab('statuses')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === 'statuses'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Application Statuses
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
            {activeTab === 'rounds' ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  College applications have different round types, each with unique deadlines and implications.
                </p>
                {(Object.keys(ROUND_TYPE_LABELS) as RoundType[]).map((round) => (
                  <div key={round} className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-semibold ${roundColors[round]}`}
                      >
                        {round}
                      </span>
                      <span className="font-medium text-gray-900">
                        {ROUND_TYPE_LABELS[round]}
                      </span>
                      {(round === 'ED' || round === 'ED2') && (
                        <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">
                          BINDING
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {ROUND_TYPE_DESCRIPTIONS[round]}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Track each student's application progress through these status stages.
                </p>
                {(Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((status) => (
                  <div key={status} className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-semibold ${statusColors[status]}`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {STATUS_DESCRIPTIONS[status]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
