import { Router } from 'express';
import { pool } from '../index';

const router = Router();

// Get settings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_settings WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
router.put('/', async (req, res) => {
  try {
    const {
      current_cycle,
      crawl_frequency,
      dashboard_deadline_window_days,
      default_export_folder
    } = req.body;

    const result = await pool.query(
      `UPDATE system_settings
       SET current_cycle = COALESCE($1, current_cycle),
           crawl_frequency = COALESCE($2, crawl_frequency),
           dashboard_deadline_window_days = COALESCE($3, dashboard_deadline_window_days),
           default_export_folder = $4
       WHERE id = 1
       RETURNING *`,
      [current_cycle, crawl_frequency, dashboard_deadline_window_days, default_export_folder]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get crawl logs
router.get('/crawl-logs', async (req, res) => {
  try {
    const { limit } = req.query;
    const limitNum = parseInt(limit as string) || 10;

    const result = await pool.query(
      `SELECT * FROM crawl_logs
       ORDER BY run_started_at DESC
       LIMIT $1`,
      [limitNum]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching crawl logs:', err);
    res.status(500).json({ error: 'Failed to fetch crawl logs' });
  }
});

// Export data
router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const data: Record<string, unknown> = {};

    if (type === 'students' || type === 'all') {
      const result = await pool.query('SELECT * FROM students');
      data.students = result.rows;
    }

    if (type === 'colleges' || type === 'all') {
      const collegesResult = await pool.query('SELECT * FROM colleges');
      const roundsResult = await pool.query('SELECT * FROM college_rounds');
      data.colleges = collegesResult.rows;
      data.college_rounds = roundsResult.rows;
    }

    if (type === 'applications' || type === 'all') {
      const result = await pool.query('SELECT * FROM student_applications');
      data.applications = result.rows;
    }

    if (type === 'all') {
      const settingsResult = await pool.query('SELECT * FROM system_settings WHERE id = 1');
      data.settings = settingsResult.rows[0];
    }

    res.json(data);
  } catch (err) {
    console.error('Error exporting data:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;
