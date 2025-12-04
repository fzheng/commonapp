import React, { useState, useEffect } from 'react';
import { api, SystemSettings } from '../api/client';
import { useApp } from '../context/AppContext';
import { getCycleOptions, DEADLINE_WINDOW_OPTIONS, CRAWL_FREQUENCY_OPTIONS, CrawlFrequency } from '../types';
import Button from '../components/common/Button';
import Select from '../components/common/Select';

export default function SettingsPage() {
  const { refreshSettings } = useApp();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await api.settings.get();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await api.settings.update({
        current_cycle: settings.current_cycle,
        crawl_frequency: settings.crawl_frequency,
        dashboard_deadline_window_days: settings.dashboard_deadline_window_days,
      });
      await refreshSettings();
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="bg-white rounded-lg p-6 h-64" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load settings
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Application Cycle */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Application Cycle</h3>
        <div className="space-y-4">
          <Select
            label="Current Admission Cycle"
            value={settings.current_cycle}
            onChange={(e) => updateSetting('current_cycle', e.target.value)}
            options={getCycleOptions()}
            helperText="This determines the default cycle for new applications and deadline lookups"
          />
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-800">
              The current cycle is automatically calculated based on the date. Override only if needed.
            </p>
          </div>
        </div>
      </div>

      {/* Dashboard Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Dashboard Settings</h3>
        <div className="space-y-4">
          <Select
            label="Upcoming Deadline Window"
            value={settings.dashboard_deadline_window_days}
            onChange={(e) => updateSetting('dashboard_deadline_window_days', parseInt(e.target.value))}
            options={DEADLINE_WINDOW_OPTIONS}
            helperText="Show deadlines within this many days on the dashboard"
          />
        </div>
      </div>

      {/* Crawler Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Crawler Settings</h3>
        <div className="space-y-4">
          <Select
            label="Crawl Frequency"
            value={settings.crawl_frequency}
            onChange={(e) => updateSetting('crawl_frequency', e.target.value as CrawlFrequency)}
            options={CRAWL_FREQUENCY_OPTIONS}
            helperText="How often the crawler runs automatically"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          isLoading={isSaving}
          disabled={!hasChanges}
        >
          Save Settings
        </Button>
      </div>

      {/* App Info */}
      <div className="bg-gray-50 rounded-lg p-6 text-center text-sm text-gray-500">
        <p className="font-medium text-gray-700">College App Manager</p>
        <p>Version 1.0.0</p>
        <p className="mt-2">For college advisors to manage student applications</p>
      </div>
    </div>
  );
}
