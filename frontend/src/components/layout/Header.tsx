import React from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/students': 'Students',
  '/colleges': 'Colleges',
  '/admin': 'Admin',
  '/settings': 'Settings',
};

export default function Header() {
  const location = useLocation();
  const { currentCycle } = useApp();

  const basePath = '/' + location.pathname.split('/')[1];
  const title = pageTitles[basePath] || 'College App Manager';

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            Cycle: <span className="font-medium text-gray-700">{currentCycle}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
