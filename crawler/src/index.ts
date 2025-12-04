import cron from 'node-cron';
import http from 'http';
import { Pool } from 'pg';
import { runCrawler, runCrawlerForMissingColleges } from './crawler';
import { importFromPdf, shouldImportPdf } from './pdf-import';

// Logger utility
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: 'crawler',
    message,
    ...data
  };
  console.log(JSON.stringify(logEntry));
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

let dbConnected = false;

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    log('ERROR', 'Database connection failed', { error: err.message });
    process.exit(1);
  } else {
    dbConnected = true;
    log('INFO', 'Database connection established', { serverTime: res.rows[0].now });
  }
});

// Health check server
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    if (dbConnected) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', db: 'connected' }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'unhealthy', db: 'disconnected' }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(3001, () => {
  log('INFO', 'Health check server started', { port: 3001 });
});

// Get crawl schedule from environment
const schedule = process.env.CRAWL_SCHEDULE || '0 0 * * 0'; // Default: Weekly on Sunday

// Calculate current cycle
function getCurrentCycle(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // September (8) or later = current year to next year
  // Before September = previous year to current year
  if (month >= 8) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

// Check if database has any deadline data
async function hasDeadlineData(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM college_rounds');
    const count = parseInt(result.rows[0].count);
    log('DEBUG', 'Checked existing deadline data', { count });
    return count > 0;
  } catch (err) {
    log('ERROR', 'Failed to check deadline data', { error: (err as Error).message });
    return false;
  }
}

// Clean up stale crawl logs that were never finished (zombie processes)
async function cleanupStaleCrawlLogs(): Promise<void> {
  try {
    // Mark any crawl logs older than 30 minutes without a finish time as failed
    const result = await pool.query(`
      UPDATE crawl_logs
      SET run_finished_at = NOW(),
          details = COALESCE(details::text, '{}')::jsonb || '{"error": "Stale crawl - marked as failed on startup"}'::jsonb
      WHERE run_finished_at IS NULL
        AND run_started_at < NOW() - INTERVAL '30 minutes'
      RETURNING id, run_started_at
    `);

    if (result.rowCount && result.rowCount > 0) {
      log('WARN', 'Cleaned up stale crawl logs', {
        count: result.rowCount,
        staleLogs: result.rows.map(r => ({ id: r.id, startedAt: r.run_started_at }))
      });
    }
  } catch (err) {
    log('ERROR', 'Failed to cleanup stale crawl logs', { error: (err as Error).message });
  }
}

// Global timeout wrapper for operations
const OPERATION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes max for any operation

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Run crawler with logging and timeout
async function executeCrawl(trigger: 'scheduled' | 'startup' | 'manual') {
  const currentCycle = getCurrentCycle();
  const startTime = Date.now();

  log('INFO', 'Crawl started', {
    trigger,
    currentCycle,
    startedAt: new Date().toISOString(),
    timeoutMs: OPERATION_TIMEOUT_MS
  });

  try {
    await withTimeout(runCrawler(pool), OPERATION_TIMEOUT_MS, 'Crawl operation');
    const duration = Date.now() - startTime;

    // Get summary from latest crawl log
    const summaryResult = await pool.query(
      'SELECT * FROM crawl_logs ORDER BY run_started_at DESC LIMIT 1'
    );
    const summary = summaryResult.rows[0];

    log('INFO', 'Crawl completed successfully', {
      trigger,
      currentCycle,
      durationMs: duration,
      durationSeconds: Math.round(duration / 1000),
      collegesAttempted: summary?.colleges_attempted,
      collegesSuccessful: summary?.colleges_successful,
      collegesFailed: summary?.colleges_failed
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    log('ERROR', 'Crawl failed', {
      trigger,
      currentCycle,
      durationMs: duration,
      error: (err as Error).message,
      stack: (err as Error).stack
    });
  }
}

// Run PDF import then crawl missing colleges with timeout
async function executeDataImport(trigger: 'scheduled' | 'startup' | 'manual') {
  const currentCycle = getCurrentCycle();
  const startTime = Date.now();

  log('INFO', 'Data import started', {
    trigger,
    currentCycle,
    startedAt: new Date().toISOString(),
    timeoutMs: OPERATION_TIMEOUT_MS
  });

  try {
    // Step 1: Import from Common App PDF (primary source)
    log('INFO', 'Step 1: Importing from Common App Requirements Grid PDF');
    const pdfResult = await withTimeout(
      importFromPdf(pool, currentCycle),
      OPERATION_TIMEOUT_MS,
      'PDF import'
    );

    log('INFO', 'PDF import completed', {
      imported: pdfResult.imported,
      skipped: pdfResult.skipped,
      errors: pdfResult.errors
    });

    // Step 2: Crawl missing colleges (secondary source for colleges not in PDF or with missing data)
    log('INFO', 'Step 2: Crawling missing colleges');
    await runCrawlerForMissingColleges(pool, currentCycle);

    const duration = Date.now() - startTime;
    log('INFO', 'Data import completed successfully', {
      trigger,
      currentCycle,
      durationMs: duration,
      durationSeconds: Math.round(duration / 1000)
    });

  } catch (err) {
    const duration = Date.now() - startTime;
    log('ERROR', 'Data import failed', {
      trigger,
      currentCycle,
      durationMs: duration,
      error: (err as Error).message,
      stack: (err as Error).stack
    });
  }
}

// Initialize
async function initialize() {
  log('INFO', 'Crawler service initializing', {
    schedule,
    currentCycle: getCurrentCycle(),
    nodeEnv: process.env.NODE_ENV,
    operationTimeoutMs: OPERATION_TIMEOUT_MS
  });

  // Wait for DB connection
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Clean up any stale crawl logs from previous runs that didn't finish
  await cleanupStaleCrawlLogs();

  // Check if this is first run (no deadline data)
  const hasData = await hasDeadlineData();

  if (!hasData) {
    log('INFO', 'No deadline data found - running initial import', {
      reason: 'empty_database',
      currentCycle: getCurrentCycle()
    });
    // Use PDF import + crawler for missing as primary strategy
    await executeDataImport('startup');
  } else {
    // Check if PDF import is needed (few deadlines exist)
    const needsPdfImport = await shouldImportPdf(pool);
    if (needsPdfImport) {
      log('INFO', 'Supplementing deadline data from PDF', {
        currentCycle: getCurrentCycle()
      });
      await executeDataImport('startup');
    } else {
      log('INFO', 'Existing deadline data found - skipping startup import', {
        currentCycle: getCurrentCycle()
      });
    }
  }

  // Schedule weekly update
  cron.schedule(schedule, async () => {
    log('INFO', 'Scheduled update triggered', { schedule });
    // Weekly: Do full crawl to check for updates
    await executeCrawl('scheduled');
  });

  log('INFO', 'Crawler service ready', {
    schedule,
    nextRunInfo: 'Weekly on Sunday at midnight UTC'
  });
}

// Start
initialize().catch(err => {
  log('ERROR', 'Failed to initialize crawler', { error: err.message });
  process.exit(1);
});
