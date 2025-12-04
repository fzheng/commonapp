import { Router } from 'express';
import { pool } from '../index';

const router = Router();

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    let { cycle } = req.query;

    // Get current cycle from settings if not provided
    if (!cycle) {
      const settingsResult = await pool.query(
        'SELECT current_cycle FROM system_settings WHERE id = 1'
      );
      cycle = settingsResult.rows[0]?.current_cycle;
    }

    // Total students
    const studentCountResult = await pool.query('SELECT COUNT(*) as count FROM students');

    // Total applications
    let appCountQuery = 'SELECT COUNT(*) as count FROM student_applications';
    const appCountParams: string[] = [];
    if (cycle) {
      appCountQuery += ' WHERE cycle = $1';
      appCountParams.push(cycle as string);
    }
    const appCountResult = await pool.query(appCountQuery, appCountParams);

    // Applications by status
    let statusQuery = 'SELECT status, COUNT(*)::int as count FROM student_applications';
    if (cycle) {
      statusQuery += ' WHERE cycle = $1';
    }
    statusQuery += ' GROUP BY status';
    const statusResult = await pool.query(statusQuery, cycle ? [cycle] : []);

    const applicationsByStatus: Record<string, number> = {
      PLANNED: 0,
      IN_PROGRESS: 0,
      SUBMITTED: 0,
      ADMITTED: 0,
      DENIED: 0,
      DEFERRED: 0,
      WAITLISTED: 0,
    };
    for (const row of statusResult.rows) {
      applicationsByStatus[row.status] = row.count;
    }

    // Applications by round
    let roundQuery = 'SELECT round_type, COUNT(*)::int as count FROM student_applications';
    if (cycle) {
      roundQuery += ' WHERE cycle = $1';
    }
    roundQuery += ' GROUP BY round_type';
    const roundResult = await pool.query(roundQuery, cycle ? [cycle] : []);

    const applicationsByRound: Record<string, number> = {
      ED: 0,
      ED2: 0,
      EA: 0,
      REA: 0,
      RD: 0,
      ROLLING: 0,
    };
    for (const row of roundResult.rows) {
      applicationsByRound[row.round_type] = row.count;
    }

    res.json({
      totalStudents: parseInt(studentCountResult.rows[0].count),
      totalApplications: parseInt(appCountResult.rows[0].count),
      applicationsByStatus,
      applicationsByRound,
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get upcoming deadlines
router.get('/upcoming-deadlines', async (req, res) => {
  try {
    let { days, cycle, includeOverdue } = req.query;
    const daysNum = parseInt(days as string) || 30;
    const includeOverdueFlag = includeOverdue !== 'false';

    // Get current cycle from settings if not provided
    if (!cycle) {
      const settingsResult = await pool.query(
        'SELECT current_cycle FROM system_settings WHERE id = 1'
      );
      cycle = settingsResult.rows[0]?.current_cycle;
    }

    let query = `
      SELECT
        sa.student_id,
        s.first_name || ' ' || s.last_name as student_name,
        sa.college_id,
        c.name as college_name,
        sa.round_type,
        cr.deadline_date,
        sa.status,
        (cr.deadline_date - CURRENT_DATE) as days_until
      FROM student_applications sa
      JOIN students s ON sa.student_id = s.id
      JOIN colleges c ON sa.college_id = c.id
      JOIN college_rounds cr ON
        cr.college_id = sa.college_id AND
        cr.round_type = sa.round_type AND
        cr.cycle = sa.cycle
      WHERE sa.status IN ('PLANNED', 'IN_PROGRESS')
        AND cr.deadline_date IS NOT NULL
    `;

    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (cycle) {
      query += ` AND sa.cycle = $${paramIndex++}`;
      params.push(cycle as string);
    }

    if (includeOverdueFlag) {
      query += ` AND cr.deadline_date <= CURRENT_DATE + ($${paramIndex++} || ' days')::interval`;
    } else {
      query += ` AND cr.deadline_date >= CURRENT_DATE AND cr.deadline_date <= CURRENT_DATE + ($${paramIndex++} || ' days')::interval`;
    }
    params.push(daysNum.toString());

    query += ` ORDER BY cr.deadline_date ASC, s.last_name, s.first_name`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching upcoming deadlines:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming deadlines' });
  }
});

export default router;
