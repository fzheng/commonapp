import { Pool } from 'pg';
import * as cheerio from 'cheerio';
import https from 'https';
import http from 'http';

// Logger utility
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: 'crawler',
    component: 'parser',
    message,
    ...data
  };
  console.log(JSON.stringify(logEntry));
}

interface DeadlineData {
  deadline_date: string | null;
  decision_date: string | null;
}

type RoundType = 'ED' | 'ED2' | 'EA' | 'REA' | 'RD' | 'ROLLING';
type ParsedDeadlines = Partial<Record<RoundType, DeadlineData>>;

// Common date patterns
const DATE_PATTERNS = [
  /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
  /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/gi,
  /\d{1,2}\/\d{1,2}\/\d{4}/g,
  /\d{4}-\d{2}-\d{2}/g,
];

const ROUND_KEYWORDS: Record<RoundType, string[]> = {
  ED: ['early decision', 'ed deadline', 'ed i ', 'ed1'],
  ED2: ['early decision ii', 'early decision 2', 'ed ii', 'ed2', 'ed 2'],
  EA: ['early action', 'ea deadline'],
  REA: ['restrictive early action', 'single-choice early action', 'rea'],
  RD: ['regular decision', 'rd deadline', 'regular deadline'],
  ROLLING: ['rolling admission', 'rolling deadline'],
};

function fetchPage(url: string, redirectCount = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects'));
      return;
    }

    const protocol = url.startsWith('https') ? https : http;
    const timeout = 30000;

    log('DEBUG', 'Fetching page', { url, redirectCount });

    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout,
    }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        log('DEBUG', 'Following redirect', { from: url, to: response.headers.location, statusCode: response.statusCode });
        fetchPage(response.headers.location, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        log('DEBUG', 'Page fetched successfully', { url, contentLength: data.length });
        resolve(data);
      });
      response.on('error', reject);
    });

    request.on('error', (err) => {
      log('ERROR', 'Request error', { url, error: err.message });
      reject(err);
    });
    request.on('timeout', () => {
      request.destroy();
      log('WARN', 'Request timeout', { url, timeoutMs: timeout });
      reject(new Error('Request timeout'));
    });
  });
}

function parseDate(dateStr: string, cycleStartYear: number): string | null {
  try {
    let date: Date | null = null;

    // Full date with year: "November 1, 2025"
    const fullMatch = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (fullMatch) {
      date = new Date(`${fullMatch[1]} ${fullMatch[2]}, ${fullMatch[3]}`);
      log('DEBUG', 'Parsed full date', { input: dateStr, parsed: date.toISOString() });
    }

    // Partial date without year: "November 1" - need to infer year from cycle
    if (!date || isNaN(date.getTime())) {
      const partialMatch = dateStr.match(/(\w+)\s+(\d{1,2})/);
      if (partialMatch) {
        const month = new Date(`${partialMatch[1]} 1`).getMonth();
        // Sept-Dec deadlines are in the first year of cycle (e.g., 2025 for 2025-2026)
        // Jan-Aug deadlines are in the second year of cycle (e.g., 2026 for 2025-2026)
        const year = month >= 8 ? cycleStartYear : cycleStartYear + 1;
        date = new Date(`${partialMatch[1]} ${partialMatch[2]}, ${year}`);
        log('DEBUG', 'Parsed partial date with inferred year', {
          input: dateStr,
          inferredYear: year,
          month: partialMatch[1],
          parsed: date.toISOString()
        });
      }
    }

    // MM/DD/YYYY format
    if (!date || isNaN(date.getTime())) {
      const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (slashMatch) {
        date = new Date(`${slashMatch[1]}/${slashMatch[2]}/${slashMatch[3]}`);
      }
    }

    // YYYY-MM-DD format
    if (!date || isNaN(date.getTime())) {
      const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        date = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
      }
    }

    if (date && !isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (err) {
    log('WARN', 'Failed to parse date', { input: dateStr, error: (err as Error).message });
  }
  return null;
}

function findNearbyDate(text: string, cycleStartYear: number): string | null {
  for (const pattern of DATE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const parsed = parseDate(matches[0], cycleStartYear);
      if (parsed) return parsed;
    }
  }
  return null;
}

async function parseAdmissionsPage(url: string, cycle: string, collegeName: string): Promise<ParsedDeadlines> {
  const results: ParsedDeadlines = {};
  const cycleStartYear = parseInt(cycle.split('-')[0]);

  log('INFO', 'Parsing admissions page', { college: collegeName, url, cycle, cycleStartYear });

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const textContent = $('body').text().toLowerCase();

    for (const [roundType, keywords] of Object.entries(ROUND_KEYWORDS)) {
      for (const keyword of keywords) {
        if (textContent.includes(keyword)) {
          const keywordIndex = textContent.indexOf(keyword);
          const context = textContent.substring(
            Math.max(0, keywordIndex - 100),
            Math.min(textContent.length, keywordIndex + 200)
          );

          const deadlineDate = findNearbyDate(context, cycleStartYear);
          if (deadlineDate) {
            results[roundType as RoundType] = {
              deadline_date: deadlineDate,
              decision_date: null,
            };
            log('INFO', 'Found deadline', {
              college: collegeName,
              roundType,
              keyword,
              deadlineDate,
              cycle
            });
            break;
          }
        }
      }
    }

    log('INFO', 'Page parsing complete', {
      college: collegeName,
      roundsFound: Object.keys(results).length,
      rounds: Object.keys(results)
    });

    return results;
  } catch (error) {
    log('ERROR', 'Failed to parse admissions page', {
      college: collegeName,
      url,
      error: (error as Error).message
    });
    throw error;
  }
}

// Calculate current cycle
function getCurrentCycle(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 8) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

// Process a single college and save results to database
async function processCollege(
  pool: Pool,
  college: { id: number; name: string; admissions_url: string },
  currentCycle: string,
  workerId: number
): Promise<{ success: boolean; college: string; rounds: string[]; error?: string }> {
  const workerTag = `worker-${workerId}`;

  log('INFO', 'Worker processing college', {
    worker: workerTag,
    collegeId: college.id,
    collegeName: college.name,
    url: college.admissions_url
  });

  try {
    const deadlines = await parseAdmissionsPage(college.admissions_url, currentCycle, college.name);
    const roundsFound = Object.keys(deadlines);

    if (roundsFound.length > 0) {
      for (const [roundType, data] of Object.entries(deadlines)) {
        if (data.deadline_date) {
          // Check if round exists
          const existingResult = await pool.query(
            `SELECT id, deadline_date, admin_confirmed FROM college_rounds
             WHERE college_id = $1 AND round_type = $2 AND cycle = $3`,
            [college.id, roundType, currentCycle]
          );

          if (existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];
            // Only update if not admin-confirmed and date changed
            if (!existing.admin_confirmed && existing.deadline_date !== data.deadline_date) {
              await pool.query(
                `UPDATE college_rounds SET
                   deadline_date = $1,
                   source = 'CRAWLER',
                   admin_confirmed = false,
                   last_crawled_at = NOW()
                 WHERE id = $2`,
                [data.deadline_date, existing.id]
              );
              log('INFO', 'Updated deadline', {
                worker: workerTag,
                college: college.name,
                roundType,
                oldDate: existing.deadline_date,
                newDate: data.deadline_date,
                cycle: currentCycle
              });
            } else if (existing.admin_confirmed) {
              log('DEBUG', 'Skipped admin-confirmed deadline', {
                worker: workerTag,
                college: college.name,
                roundType,
                existingDate: existing.deadline_date
              });
            } else {
              // Just update last_crawled_at
              await pool.query(
                `UPDATE college_rounds SET last_crawled_at = NOW() WHERE id = $1`,
                [existing.id]
              );
            }
          } else {
            // Insert new round
            await pool.query(
              `INSERT INTO college_rounds (
                 college_id, round_type, cycle, deadline_date,
                 source, admin_confirmed, last_crawled_at
               ) VALUES ($1, $2, $3, $4, 'CRAWLER', false, NOW())`,
              [college.id, roundType, currentCycle, data.deadline_date]
            );
            log('INFO', 'Inserted new deadline', {
              worker: workerTag,
              college: college.name,
              roundType,
              deadlineDate: data.deadline_date,
              cycle: currentCycle
            });
          }
        }
      }
    }

    return { success: true, college: college.name, rounds: roundsFound };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log('ERROR', 'Worker failed to crawl college', {
      worker: workerTag,
      college: college.name,
      error: errorMsg
    });
    return { success: false, college: college.name, rounds: [], error: errorMsg };
  }
}

// Worker pool configuration
const CONCURRENCY = 10; // Number of parallel workers
const CRAWL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minute global timeout for entire crawl

// Helper to wrap a promise with a timeout
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
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

export async function runCrawler(pool: Pool): Promise<void> {
  const startTime = new Date().toISOString();
  let logId: number | null = null;
  let completed = 0;
  let successful = 0;
  let failed = 0;

  log('INFO', 'Crawler run starting', { startTime, concurrency: CONCURRENCY, timeoutMs: CRAWL_TIMEOUT_MS });

  // Create crawl log entry first (outside try-catch so we always have a log)
  try {
    const logResult = await pool.query(
      `INSERT INTO crawl_logs (run_started_at, colleges_attempted, colleges_successful, colleges_failed)
       VALUES ($1, 0, 0, 0) RETURNING id`,
      [startTime]
    );
    logId = logResult.rows[0].id;
  } catch (err) {
    log('ERROR', 'Failed to create crawl log entry', { error: (err as Error).message });
    throw err;
  }

  // Helper to finalize the crawl log
  const finalizeCrawlLog = async (error?: string) => {
    if (logId === null) return;
    try {
      const details = error
        ? { error, completed, successful, failed }
        : { completed, successful, failed };
      await pool.query(
        `UPDATE crawl_logs SET
           run_finished_at = NOW(),
           colleges_attempted = $1,
           colleges_successful = $2,
           colleges_failed = $3,
           details = $4
         WHERE id = $5`,
        [completed, successful, failed, JSON.stringify(details), logId]
      );
      log('INFO', 'Crawl log finalized', { logId, completed, successful, failed, error: error || null });
    } catch (finalizeErr) {
      log('ERROR', 'Failed to finalize crawl log', { error: (finalizeErr as Error).message });
    }
  };

  try {
    // Get current cycle from settings or calculate it
    let currentCycle: string;
    const settingsResult = await pool.query(
      'SELECT current_cycle FROM system_settings WHERE id = 1'
    );

    if (settingsResult.rows.length > 0 && settingsResult.rows[0].current_cycle) {
      currentCycle = settingsResult.rows[0].current_cycle;
    } else {
      currentCycle = getCurrentCycle();
      // Initialize settings if not exists
      await pool.query(
        `INSERT INTO system_settings (id, current_cycle, crawl_frequency, dashboard_deadline_window_days)
         VALUES (1, $1, 'weekly', 30)
         ON CONFLICT (id) DO UPDATE SET current_cycle = $1`,
        [currentCycle]
      );
      log('INFO', 'Initialized system settings', { currentCycle });
    }

    log('INFO', 'Using cycle for crawl', { currentCycle });

    // Get colleges with URLs
    const collegesResult = await pool.query(
      `SELECT id, name, admissions_url FROM colleges
       WHERE admissions_url IS NOT NULL AND admissions_url != ''
       ORDER BY usnews_rank ASC NULLS LAST`
    );

    const colleges = collegesResult.rows;
    const totalColleges = colleges.length;
    log('INFO', 'Found colleges to crawl', { totalColleges, concurrency: CONCURRENCY });

    const errors: { college: string; error: string }[] = [];
    const foundDeadlines: { college: string; rounds: string[] }[] = [];

    // Process colleges in parallel batches
    const processBatch = async (batch: typeof colleges, batchIndex: number) => {
      const results = await Promise.all(
        batch.map((college, idx) =>
          processCollege(pool, college, currentCycle, batchIndex * CONCURRENCY + idx + 1)
        )
      );
      return results;
    };

    // Split colleges into batches
    for (let i = 0; i < colleges.length; i += CONCURRENCY) {
      const batch = colleges.slice(i, i + CONCURRENCY);
      const batchIndex = Math.floor(i / CONCURRENCY);

      log('INFO', 'Processing batch', {
        batchNumber: batchIndex + 1,
        totalBatches: Math.ceil(colleges.length / CONCURRENCY),
        collegesInBatch: batch.length,
        startIndex: i + 1,
        endIndex: Math.min(i + CONCURRENCY, colleges.length)
      });

      const results = await processBatch(batch, batchIndex);

      // Aggregate results
      for (const result of results) {
        completed++;
        if (result.success) {
          successful++;
          if (result.rounds.length > 0) {
            foundDeadlines.push({ college: result.college, rounds: result.rounds });
          }
        } else {
          failed++;
          if (result.error) {
            errors.push({ college: result.college, error: result.error });
          }
        }
      }

      // Update progress after each batch
      await pool.query(
        `UPDATE crawl_logs SET
           colleges_attempted = $1,
           colleges_successful = $2,
           colleges_failed = $3
         WHERE id = $4`,
        [completed, successful, failed, logId]
      );

      log('INFO', 'Batch completed', {
        batchNumber: batchIndex + 1,
        progress: `${completed}/${totalColleges}`,
        successful,
        failed,
        roundsFoundSoFar: foundDeadlines.reduce((acc, d) => acc + d.rounds.length, 0)
      });

      // Small delay between batches to be respectful to the network
      if (i + CONCURRENCY < colleges.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Finalize
    const durationMs = Date.now() - new Date(startTime).getTime();
    const details = {
      errors: errors.length > 0 ? errors : undefined,
      deadlinesFound: foundDeadlines,
      cycle: currentCycle,
      concurrency: CONCURRENCY,
      summary: {
        totalColleges,
        attempted: completed,
        successful,
        failed,
        roundsFound: foundDeadlines.reduce((acc, d) => acc + d.rounds.length, 0),
        durationSeconds: Math.round(durationMs / 1000)
      }
    };

    // Finalize with success
    await finalizeCrawlLog();

    log('INFO', 'Crawl completed', {
      duration: `${Math.round(durationMs / 1000)}s`,
      concurrency: CONCURRENCY,
      ...details.summary
    });

  } catch (err) {
    const errorMsg = (err as Error).message;
    log('ERROR', 'Crawler fatal error', { error: errorMsg, stack: (err as Error).stack });
    await finalizeCrawlLog(errorMsg);
    throw err;
  }
}

// Crawl only colleges that are missing deadline data for the current cycle
export async function runCrawlerForMissingColleges(pool: Pool, cycle: string): Promise<void> {
  const startTime = new Date().toISOString();

  log('INFO', 'Starting crawler for missing colleges', { startTime, cycle });

  try {
    // Find colleges without any deadline data for this cycle
    const missingResult = await pool.query(
      `SELECT c.id, c.name, c.admissions_url
       FROM colleges c
       WHERE c.admissions_url IS NOT NULL
         AND c.admissions_url != ''
         AND NOT EXISTS (
           SELECT 1 FROM college_rounds cr
           WHERE cr.college_id = c.id AND cr.cycle = $1
         )
       ORDER BY c.usnews_rank ASC NULLS LAST`,
      [cycle]
    );

    const colleges = missingResult.rows;
    const totalMissing = colleges.length;

    if (totalMissing === 0) {
      log('INFO', 'No colleges missing deadline data', { cycle });
      return;
    }

    log('INFO', 'Found colleges missing deadline data', {
      totalMissing,
      cycle,
      concurrency: CONCURRENCY
    });

    let completed = 0;
    let successful = 0;
    let failed = 0;
    const foundDeadlines: { college: string; rounds: string[] }[] = [];

    // Process in parallel batches
    for (let i = 0; i < colleges.length; i += CONCURRENCY) {
      const batch = colleges.slice(i, i + CONCURRENCY);
      const batchIndex = Math.floor(i / CONCURRENCY);

      log('INFO', 'Processing missing colleges batch', {
        batchNumber: batchIndex + 1,
        totalBatches: Math.ceil(colleges.length / CONCURRENCY),
        collegesInBatch: batch.length
      });

      const results = await Promise.all(
        batch.map((college, idx) =>
          processCollege(pool, college, cycle, batchIndex * CONCURRENCY + idx + 1)
        )
      );

      for (const result of results) {
        completed++;
        if (result.success) {
          successful++;
          if (result.rounds.length > 0) {
            foundDeadlines.push({ college: result.college, rounds: result.rounds });
          }
        } else {
          failed++;
        }
      }

      log('INFO', 'Missing colleges batch completed', {
        batchNumber: batchIndex + 1,
        progress: `${completed}/${totalMissing}`,
        successful,
        failed,
        roundsFoundSoFar: foundDeadlines.reduce((acc, d) => acc + d.rounds.length, 0)
      });

      // Small delay between batches
      if (i + CONCURRENCY < colleges.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const durationMs = Date.now() - new Date(startTime).getTime();

    log('INFO', 'Missing colleges crawl completed', {
      duration: `${Math.round(durationMs / 1000)}s`,
      totalMissing,
      successful,
      failed,
      roundsFound: foundDeadlines.reduce((acc, d) => acc + d.rounds.length, 0)
    });

  } catch (err) {
    log('ERROR', 'Missing colleges crawler error', {
      error: (err as Error).message,
      stack: (err as Error).stack
    });
    throw err;
  }
}
