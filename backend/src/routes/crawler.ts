import { Router } from 'express';
import { pool } from '../index';

const router = Router();

let isRunning = false;

// Trigger crawler run (the actual crawling happens in the crawler container)
router.post('/run', async (req, res) => {
  try {
    if (isRunning) {
      return res.status(400).json({ error: 'Crawler is already running' });
    }

    isRunning = true;

    // Create a crawl log entry to trigger the crawler
    const startTime = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO crawl_logs (run_started_at, colleges_attempted, colleges_successful, colleges_failed)
       VALUES ($1, 0, 0, 0) RETURNING *`,
      [startTime]
    );

    // In a real implementation, you would signal the crawler container to run
    // For now, we just create the log entry

    isRunning = false;
    res.json(result.rows[0]);
  } catch (error) {
    isRunning = false;
    console.error('Failed to run crawler:', error);
    res.status(500).json({ error: 'Failed to run crawler' });
  }
});

// Get crawler status
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM crawl_logs ORDER BY run_started_at DESC LIMIT 1`
    );

    res.json({
      isRunning,
      lastRun: result.rows[0] || null,
    });
  } catch (error) {
    console.error('Failed to get crawler status:', error);
    res.status(500).json({ error: 'Failed to get crawler status' });
  }
});

// Get crawl logs
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await pool.query(
      `SELECT * FROM crawl_logs ORDER BY run_started_at DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to get crawl logs:', error);
    res.status(500).json({ error: 'Failed to get crawl logs' });
  }
});

export default router;
