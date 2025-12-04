import { Router } from 'express';
import { pool } from '../index';

const router = Router();

// Get all colleges with available round types and deadlines
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT
        c.*,
        COALESCE(
          json_agg(
            json_build_object('round_type', cr.round_type::text, 'deadline_date', cr.deadline_date)
            ORDER BY cr.round_type::text
          )
          FILTER (WHERE cr.round_type IS NOT NULL),
          '[]'::json
        ) as round_deadlines
      FROM colleges c
      LEFT JOIN college_rounds cr ON c.id = cr.college_id
    `;

    const params: string[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      query += ` WHERE (c.name ILIKE $1 OR c.short_name ILIKE $1 OR c.city ILIKE $1)`;
      params.push(`%${search.trim()}%`);
    }

    query += `
      GROUP BY c.id
      ORDER BY c.usnews_rank ASC NULLS LAST, c.name ASC
    `;

    const result = await pool.query(query, params);

    // Transform to include both available_rounds array and round_deadlines
    const transformed = result.rows.map(row => ({
      ...row,
      available_rounds: row.round_deadlines.map((r: { round_type: string }) => r.round_type),
    }));

    res.json(transformed);
  } catch (err) {
    console.error('Error fetching colleges:', err);
    res.status(500).json({ error: 'Failed to fetch colleges' });
  }
});

// Get college by ID with rounds
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const collegeResult = await pool.query('SELECT * FROM colleges WHERE id = $1', [id]);
    if (collegeResult.rows.length === 0) {
      return res.status(404).json({ error: 'College not found' });
    }

    // Get rounds for this college
    const roundsResult = await pool.query(`
      SELECT * FROM college_rounds
      WHERE college_id = $1
      ORDER BY
        CASE round_type
          WHEN 'ED' THEN 1
          WHEN 'ED2' THEN 2
          WHEN 'REA' THEN 3
          WHEN 'EA' THEN 4
          WHEN 'RD' THEN 5
          WHEN 'ROLLING' THEN 6
        END
    `, [id]);

    res.json({
      ...collegeResult.rows[0],
      rounds: roundsResult.rows
    });
  } catch (err) {
    console.error('Error fetching college:', err);
    res.status(500).json({ error: 'Failed to fetch college' });
  }
});

// Update college
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, short_name, city, state, timezone, usnews_rank, admissions_url } = req.body;

    const result = await pool.query(
      `UPDATE colleges
       SET name = COALESCE($1, name),
           short_name = $2,
           city = $3,
           state = $4,
           timezone = $5,
           usnews_rank = $6,
           admissions_url = $7
       WHERE id = $8
       RETURNING *`,
      [name, short_name, city, state, timezone, usnews_rank, admissions_url, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'College not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating college:', err);
    res.status(500).json({ error: 'Failed to update college' });
  }
});

// Get college rounds
router.get('/:id/rounds', async (req, res) => {
  try {
    const { id } = req.params;
    const { cycle } = req.query;

    let query = `
      SELECT * FROM college_rounds
      WHERE college_id = $1
    `;
    const params: (string | number)[] = [id];

    if (cycle) {
      query += ` AND cycle = $2`;
      params.push(cycle as string);
    }

    query += ` ORDER BY
      CASE round_type
        WHEN 'ED' THEN 1
        WHEN 'ED2' THEN 2
        WHEN 'REA' THEN 3
        WHEN 'EA' THEN 4
        WHEN 'RD' THEN 5
        WHEN 'ROLLING' THEN 6
      END`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching college rounds:', err);
    res.status(500).json({ error: 'Failed to fetch college rounds' });
  }
});

// Upsert college round
router.post('/:id/rounds', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      round_type,
      cycle,
      deadline_date,
      deadline_time,
      decision_date,
      decision_start_date,
      decision_end_date,
      decision_notes,
      admin_confirmed
    } = req.body;

    const result = await pool.query(
      `INSERT INTO college_rounds (
        college_id, round_type, cycle, deadline_date, deadline_time,
        decision_date, decision_start_date, decision_end_date,
        decision_notes, source, admin_confirmed
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ADMIN', $10)
      ON CONFLICT (college_id, round_type, cycle)
      DO UPDATE SET
        deadline_date = EXCLUDED.deadline_date,
        deadline_time = EXCLUDED.deadline_time,
        decision_date = EXCLUDED.decision_date,
        decision_start_date = EXCLUDED.decision_start_date,
        decision_end_date = EXCLUDED.decision_end_date,
        decision_notes = EXCLUDED.decision_notes,
        source = 'ADMIN',
        admin_confirmed = EXCLUDED.admin_confirmed
      RETURNING *`,
      [
        id, round_type, cycle, deadline_date || null, deadline_time || null,
        decision_date || null, decision_start_date || null, decision_end_date || null,
        decision_notes || null, admin_confirmed ?? true
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error upserting college round:', err);
    res.status(500).json({ error: 'Failed to save college round' });
  }
});

// Update college round
router.put('/:id/rounds/:roundId', async (req, res) => {
  try {
    const { roundId } = req.params;
    const { deadline_date, decision_date, admin_confirmed } = req.body;

    const result = await pool.query(
      `UPDATE college_rounds
       SET deadline_date = $1,
           decision_date = $2,
           admin_confirmed = COALESCE($3, admin_confirmed),
           source = 'ADMIN'
       WHERE id = $4
       RETURNING *`,
      [deadline_date || null, decision_date || null, admin_confirmed, roundId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Round not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating college round:', err);
    res.status(500).json({ error: 'Failed to update college round' });
  }
});

// Delete college round
router.delete('/:id/rounds/:roundId', async (req, res) => {
  try {
    const { roundId } = req.params;
    const result = await pool.query(
      'DELETE FROM college_rounds WHERE id = $1 RETURNING *',
      [roundId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Round not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting college round:', err);
    res.status(500).json({ error: 'Failed to delete college round' });
  }
});

// Get pending review rounds
router.get('/rounds/pending-review', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cr.*, c.name as college_name
      FROM college_rounds cr
      JOIN colleges c ON cr.college_id = c.id
      WHERE cr.source = 'CRAWLER' AND cr.admin_confirmed = false
      ORDER BY c.name, cr.round_type
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending reviews:', err);
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});

// Confirm a round
router.post('/rounds/:roundId/confirm', async (req, res) => {
  try {
    const { roundId } = req.params;
    const result = await pool.query(
      `UPDATE college_rounds
       SET admin_confirmed = true, source = 'ADMIN'
       WHERE id = $1
       RETURNING *`,
      [roundId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Round not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error confirming round:', err);
    res.status(500).json({ error: 'Failed to confirm round' });
  }
});

export default router;
