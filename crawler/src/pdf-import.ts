import { Pool } from 'pg';
import https from 'https';
import http from 'http';
import { extractText, getDocumentProxy } from 'unpdf';

// Logger utility
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: 'crawler',
    component: 'pdf-import',
    message,
    ...data
  };
  console.log(JSON.stringify(logEntry));
}

// Common App Requirements Grid PDF URL
const REQUIREMENTS_GRID_URL = 'https://content.commonapp.org/Files/ReqGrid.pdf';

interface ParsedDeadline {
  collegeName: string;
  roundType: string;
  deadlineDate: string;
}

// Download PDF from URL
async function downloadPdf(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    log('INFO', 'Downloading PDF', { url });

    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        log('DEBUG', 'Following redirect', { to: response.headers.location });
        downloadPdf(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        log('INFO', 'PDF downloaded successfully', { sizeBytes: buffer.length });
        resolve(buffer);
      });
      response.on('error', reject);
    }).on('error', reject);
  });
}

// Extract text from PDF using unpdf (better text extraction with layout preservation)
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  try {
    // Use unpdf for better text extraction
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });

    // Join pages with clear separators for better parsing
    const fullText = (text as string[]).join('\n\n--- PAGE BREAK ---\n\n');

    log('INFO', 'PDF text extracted with unpdf', {
      pages: totalPages,
      textLength: fullText.length,
      method: 'unpdf'
    });

    return fullText;
  } catch (unpdfErr) {
    // Fallback to pdf-parse if unpdf fails
    log('WARN', 'unpdf extraction failed, falling back to pdf-parse', {
      error: (unpdfErr as Error).message
    });

    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(pdfBuffer);
    log('INFO', 'PDF text extracted with pdf-parse (fallback)', {
      pages: data.numpages,
      textLength: data.text.length,
      method: 'pdf-parse'
    });
    return data.text;
  }
}

// Parse PDF text directly using regex patterns (no LLM needed)
function parseWithRegex(pdfText: string, cycleYear: number): ParsedDeadline[] {
  log('INFO', 'Starting regex-based PDF parsing', { textLength: pdfText.length, cycleYear });

  const allDeadlines: ParsedDeadline[] = [];

  // Split into lines and process
  const lines = pdfText.split('\n');

  // Lines to skip (headers, footers, etc.)
  const skipPatterns = [
    /^Page \d+$/,
    /First Year Deadlines/,
    /^Updated:/,
    /See bottom of document/,
    /Common App Member School/,
    /^Deadlines.*App Fees/,
    /^2025-26$/,
    /^and Requirements$/,
    /^Rolling.*US.*INTL/,
    /^Personal.*Essay/,
    /^Writing.*Test Policy/,
    /^SAT\/ACT/,
    /^Tests Used/,
    /^--- PAGE BREAK ---$/,
    /^\s*$/,
    /^Website\s*$/,
    /^Website\s+\d/,
    /^or P\s*Y/,
    /^[YN]\s+[YN]\s*$/,   // Match "Y Y", "Y N", "N Y", "N N" lines
    /^[YN]\s*$/,          // Match single Y or N lines
    /^or ACT/,
    /^D or I or T/,
    /^C or D or I/,
    /^I or T/,
    /^See$/,
    /^Used INTL/,
  ];

  const shouldSkipLine = (line: string): boolean => {
    const trimmed = line.trim();
    // Skip very short lines (less than 4 chars can't be meaningful college data)
    if (trimmed.length < 4) return true;
    return skipPatterns.some(pattern => pattern.test(trimmed));
  };

  // Merge multi-line college names
  // A college entry line contains: CollegeName (Coed|Women|Men) [dates or Rolling] ...
  const collegeEntryPattern = /\s+(Coed|Women|Men)\s+/i;
  const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;

  let pendingName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (shouldSkipLine(trimmed)) {
      pendingName = '';
      continue;
    }

    // Check if this line has a college type marker (Coed/Women/Men)
    if (collegeEntryPattern.test(trimmed)) {
      // This is a complete or final line of a college entry
      const fullLine = pendingName ? pendingName + ' ' + trimmed : trimmed;
      pendingName = '';

      // Extract college name (text before Coed/Women/Men)
      const typeMatch = fullLine.match(/^(.+?)\s+(Coed|Women|Men)\s+(.+)$/i);
      if (!typeMatch) continue;

      let collegeName = typeMatch[1].trim();
      const restOfLine = typeMatch[3];

      // Clean up college name - remove common prefixes from PDF extraction noise
      // First normalize all whitespace to regular spaces for consistent matching
      collegeName = collegeName.replace(/\s+/g, ' ').trim();

      collegeName = collegeName
        // Remove PDF table noise patterns at the start
        .replace(/^(Saves Forms|Website|Forms|Saves)\s*/gi, '')
        // Remove leading Y/N markers (checkbox values from PDF table columns)
        // These appear as "Y Y", "Y N", "N Y", "N N" patterns from checkbox columns
        // Use flexible whitespace matching since PDF extraction may vary
        .replace(/^[YN]\s+[YN]\s+/g, '')    // Remove "Y Y " or "Y N " etc at start
        .replace(/^[YN]\s+/g, '')           // Remove single "Y " at start (Y is not a college name prefix)
        // Sometimes Y/N appears without space separator in PDF extraction
        .replace(/^[YN][YN]\s+/g, '')       // Remove "YY " or "YN " etc at start
        // Remove these patterns if they appear elsewhere in the name
        .replace(/\s+(Saves Forms|Website|Forms|Saves)\s+/gi, ' ')
        .replace(/\s+[YN]\s+[YN]\s+/gi, ' ')  // Remove " Y Y " or " N N " in middle
        // Remove leading non-letters (leftover spaces, numbers, symbols)
        .replace(/^[^A-Za-z]+/, '')
        .trim();

      // Skip if college name looks invalid
      if (collegeName.length < 4 || /^[\$\d]/.test(collegeName) || /^(Y|N|S|F|A)\s*$/.test(collegeName)) {
        continue;
      }

      // Extract dates from this line
      const allDates: { date: string; month: number; day: number; year: number }[] = [];
      const regex = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
      let match;

      while ((match = regex.exec(restOfLine)) !== null) {
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        const year = parseInt(match[3]);

        // Validate year
        if (year >= 2024 && year <= 2027) {
          allDates.push({ date: match[0], month, day, year });
        }
      }

      // Check for "Rolling" in the line
      const hasRolling = /Rolling/i.test(restOfLine);

      // Map dates to round types based on common patterns
      for (let j = 0; j < allDates.length; j++) {
        const { month, day, year } = allDates[j];
        const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        // Infer round type from date
        let roundType: string;

        if (month === 10 || (month === 11 && day <= 15)) {
          // Oct or early Nov = ED or EA
          roundType = j === 0 ? 'ED' : 'EA';
        } else if (month === 11 && day > 15) {
          // Late Nov = EA or ED
          roundType = j === 0 ? 'ED' : 'EA';
        } else if (month === 12) {
          // December = EA or ED2
          roundType = j === 0 ? 'EA' : 'ED2';
        } else if (month === 1 && day <= 15) {
          // Early Jan = ED2 or RD
          roundType = j === 0 ? 'ED2' : 'RD';
        } else if (month === 1 || month === 2) {
          // Late Jan or Feb = RD
          roundType = 'RD';
        } else if (month >= 3 && month <= 8) {
          // Mar-Aug with Rolling indicator
          if (hasRolling) {
            roundType = 'ROLLING';
          } else {
            roundType = 'RD';
          }
        } else {
          roundType = 'ROLLING';
        }

        allDeadlines.push({
          collegeName,
          roundType,
          deadlineDate: formattedDate
        });
      }

      // If no dates but has Rolling, add a ROLLING entry
      if (allDates.length === 0 && hasRolling) {
        allDeadlines.push({
          collegeName,
          roundType: 'ROLLING',
          deadlineDate: `${cycleYear + 1}-08-01` // Placeholder for rolling
        });
      }
    } else if (datePattern.test(trimmed)) {
      // Line has dates but no type marker - might be continuation
      // Skip it as the college name is on a previous line
      pendingName = '';
    } else {
      // No type marker and no dates - might be start of multi-line college name
      // Only accumulate if it looks like a college name (starts with letter, not too short)
      // Skip lines that are just Y/N markers from PDF checkbox columns
      const isYNMarker = /^[YN](\s+[YN])*\s*$/.test(trimmed);
      if (!isYNMarker && /^[A-Z]/.test(trimmed) && trimmed.length >= 3) {
        pendingName = pendingName ? pendingName + ' ' + trimmed : trimmed;
      }
    }
  }

  // Deduplicate by college + round type (keep first occurrence)
  const uniqueDeadlines = new Map<string, ParsedDeadline>();
  for (const deadline of allDeadlines) {
    const key = `${deadline.collegeName}|${deadline.roundType}`;
    if (!uniqueDeadlines.has(key)) {
      uniqueDeadlines.set(key, deadline);
    }
  }

  const result = Array.from(uniqueDeadlines.values());

  log('INFO', 'Regex parsing complete', {
    totalExtracted: allDeadlines.length,
    uniqueDeadlines: result.length,
    uniqueColleges: new Set(result.map(d => d.collegeName)).size,
    byRoundType: {
      ED: result.filter(d => d.roundType === 'ED').length,
      ED2: result.filter(d => d.roundType === 'ED2').length,
      EA: result.filter(d => d.roundType === 'EA').length,
      REA: result.filter(d => d.roundType === 'REA').length,
      RD: result.filter(d => d.roundType === 'RD').length,
      ROLLING: result.filter(d => d.roundType === 'ROLLING').length,
    }
  });

  return result;
}

// Match parsed college names to database colleges using fuzzy matching
async function matchColleges(
  pool: Pool,
  deadlines: ParsedDeadline[]
): Promise<Map<string, number>> {
  log('INFO', 'Matching parsed college names to database');

  const result = await pool.query('SELECT id, name, short_name FROM colleges');
  const dbColleges = result.rows;

  const matches = new Map<string, number>();
  const unmatched: string[] = [];

  const uniqueNames = [...new Set(deadlines.map(d => d.collegeName))];

  for (const parsedName of uniqueNames) {
    const normalizedParsed = parsedName.toLowerCase().trim();

    // Try exact match first
    let match = dbColleges.find(c =>
      c.name.toLowerCase() === normalizedParsed ||
      (c.short_name && c.short_name.toLowerCase() === normalizedParsed)
    );

    // Try contains match
    if (!match) {
      match = dbColleges.find(c => {
        const dbName = c.name.toLowerCase();
        return dbName.includes(normalizedParsed) || normalizedParsed.includes(dbName);
      });
    }

    // Try word-based matching (at least 2 significant words match)
    if (!match) {
      const parsedWords = normalizedParsed.split(/\s+/).filter(w => w.length > 3 && !['university', 'college', 'the', 'and', 'of'].includes(w));
      match = dbColleges.find(c => {
        const dbWords = c.name.toLowerCase().split(/\s+/);
        const matchCount = parsedWords.filter(w => dbWords.some(dw => dw.includes(w) || w.includes(dw))).length;
        return matchCount >= 2 || (parsedWords.length === 1 && matchCount === 1);
      });
    }

    if (match) {
      matches.set(parsedName, match.id);
    } else {
      unmatched.push(parsedName);
    }
  }

  log('INFO', 'College matching complete', {
    totalParsed: uniqueNames.length,
    matched: matches.size,
    unmatched: unmatched.length,
    unmatchedSample: unmatched.slice(0, 10)
  });

  return matches;
}

// Import deadlines from PDF into database
export async function importFromPdf(pool: Pool, cycle: string): Promise<{
  imported: number;
  skipped: number;
  errors: number;
}> {
  const cycleStartYear = parseInt(cycle.split('-')[0]);

  log('INFO', 'Starting PDF import', { cycle, cycleStartYear });

  try {
    // Download PDF
    const pdfBuffer = await downloadPdf(REQUIREMENTS_GRID_URL);

    // Extract text
    const pdfText = await extractPdfText(pdfBuffer);

    // Parse PDF using regex patterns
    const deadlines = parseWithRegex(pdfText, cycleStartYear);

    if (deadlines.length === 0) {
      log('WARN', 'No deadlines extracted from PDF');
      return { imported: 0, skipped: 0, errors: 0 };
    }

    // Match to database colleges
    const collegeMatches = await matchColleges(pool, deadlines);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const deadline of deadlines) {
      const collegeId = collegeMatches.get(deadline.collegeName);

      if (!collegeId) {
        skipped++;
        continue;
      }

      try {
        // Check if round already exists
        const existing = await pool.query(
          `SELECT id, deadline_date, source, admin_confirmed FROM college_rounds
           WHERE college_id = $1 AND round_type = $2 AND cycle = $3`,
          [collegeId, deadline.roundType, cycle]
        );

        if (existing.rows.length > 0) {
          const row = existing.rows[0];
          // Only update if not admin-confirmed
          if (!row.admin_confirmed) {
            await pool.query(
              `UPDATE college_rounds SET
                 deadline_date = $1,
                 source = 'CRAWLER',
                 last_crawled_at = NOW()
               WHERE id = $2`,
              [deadline.deadlineDate, row.id]
            );
            log('DEBUG', 'Updated deadline from PDF', {
              college: deadline.collegeName,
              round: deadline.roundType,
              date: deadline.deadlineDate
            });
            imported++;
          } else {
            skipped++;
          }
        } else {
          // Insert new round
          await pool.query(
            `INSERT INTO college_rounds (
               college_id, round_type, cycle, deadline_date,
               source, admin_confirmed, last_crawled_at
             ) VALUES ($1, $2, $3, $4, 'CRAWLER', false, NOW())`,
            [collegeId, deadline.roundType, cycle, deadline.deadlineDate]
          );
          log('DEBUG', 'Inserted deadline from PDF', {
            college: deadline.collegeName,
            round: deadline.roundType,
            date: deadline.deadlineDate
          });
          imported++;
        }
      } catch (err) {
        log('ERROR', 'Failed to import deadline', {
          college: deadline.collegeName,
          round: deadline.roundType,
          error: (err as Error).message
        });
        errors++;
      }
    }

    log('INFO', 'PDF import complete', { imported, skipped, errors });

    return { imported, skipped, errors };
  } catch (err) {
    log('ERROR', 'PDF import failed', { error: (err as Error).message });
    throw err;
  }
}

// Check if PDF import is needed
export async function shouldImportPdf(pool: Pool): Promise<boolean> {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM college_rounds');
    const totalDeadlines = parseInt(totalResult.rows[0].count);

    if (totalDeadlines < 50) {
      log('INFO', 'Few deadlines in database, PDF import recommended', { totalDeadlines });
      return true;
    }

    log('DEBUG', 'Sufficient deadline data exists', { totalDeadlines });
    return false;
  } catch (err) {
    log('ERROR', 'Error checking PDF import status', { error: (err as Error).message });
    return false;
  }
}
