import React, { useState, useEffect } from 'react';
import { api, CrawlLog } from '../api/client';
import Button from '../components/common/Button';

export default function AdminPage() {
  const [crawlerStatus, setCrawlerStatus] = useState<{ isRunning: boolean; lastRun: CrawlLog | null }>({ isRunning: false, lastRun: null });
  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [status, logs] = await Promise.all([
        api.crawler.getStatus(),
        api.crawler.getLogs(10),
      ]);
      setCrawlerStatus(status);
      setCrawlLogs(logs);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunCrawler = async () => {
    setIsRunning(true);
    try {
      await api.crawler.run();
      loadData();
    } catch (error) {
      console.error('Failed to run crawler:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleExport = async () => {
    try {
      const result = await api.settings.export(exportFormat);
      // Create download
      const blob = new Blob([result.data], { type: exportFormat === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-6"><div className="bg-white rounded-lg p-6 h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Crawler Control */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Deadline Crawler</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Status: <span className={crawlerStatus.isRunning ? 'text-yellow-600' : 'text-green-600'}>
                  {crawlerStatus.isRunning ? 'Running' : 'Idle'}
                </span>
              </p>
              {crawlerStatus.lastRun && (
                <p className="text-sm text-gray-500">
                  Last run: {new Date(crawlerStatus.lastRun.run_started_at).toLocaleString()}
                </p>
              )}
            </div>
            <Button
              onClick={handleRunCrawler}
              isLoading={isRunning || crawlerStatus.isRunning}
              disabled={crawlerStatus.isRunning}
            >
              Run Crawler Now
            </Button>
          </div>
          {crawlerStatus.lastRun && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">Last Run Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Attempted</p>
                  <p className="font-semibold">{crawlerStatus.lastRun.colleges_attempted}</p>
                </div>
                <div>
                  <p className="text-gray-500">Successful</p>
                  <p className="font-semibold text-green-600">{crawlerStatus.lastRun.colleges_successful}</p>
                </div>
                <div>
                  <p className="text-gray-500">Failed</p>
                  <p className="font-semibold text-red-600">{crawlerStatus.lastRun.colleges_failed}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Crawl History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Crawl History</h3>
        </div>
        {crawlLogs.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No crawl logs yet</div>
        ) : (
          <div className="divide-y">
            {crawlLogs.map((log) => (
              <div key={log.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(log.run_started_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      {log.run_finished_at
                        ? `Completed in ${Math.round((new Date(log.run_finished_at).getTime() - new Date(log.run_started_at).getTime()) / 1000)}s`
                        : 'In progress...'}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p><span className="text-green-600">{log.colleges_successful}</span> / {log.colleges_attempted} successful</p>
                    {log.colleges_failed > 0 && <p className="text-red-600">{log.colleges_failed} failed</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Export */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Data Export</h3>
        <div className="flex items-center space-x-4">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <Button variant="secondary" onClick={handleExport}>
            Export All Data
          </Button>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Export all students, applications, and deadlines
        </p>
      </div>
    </div>
  );
}
