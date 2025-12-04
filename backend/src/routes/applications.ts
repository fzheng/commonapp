import { Router } from 'express';
import { pool } from '../index';

const router = Router();

// Get all applications with details
router.get('/', async (req, res) => {
  try {
    const { cycle, status, round_type, college_id, student_id } = req.query;

    let query = `
      SELECT
        sa.*,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        c.name as college_name,
        c.short_name as college_short_name,
        cr.deadline_date,
        cr.decision_date,
        cr.decision_start_date,
        cr.decision_end_date
      FROM student_applications sa
      JOIN students s ON sa.student_id = s.id
      JOIN colleges c ON sa.college_id = c.id
      LEFT JOIN college_rounds cr ON
        cr.college_id = sa.college_id AND
        cr.round_type = sa.round_type AND
        cr.cycle = sa.cycle
      WHERE 1=1
    `;

    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (cycle) {
      query += ` AND sa.cycle = $${paramIndex++}`;
      params.push(cycle as string);
    }
    if (status) {
      query += ` AND sa.status = $${paramIndex++}`;
      params.push(status as string);
    }
    if (round_type) {
      query += ` AND sa.round_type = $${paramIndex++}`;
      params.push(round_type as string);
    }
    if (college_id) {
      query += ` AND sa.college_id = $${paramIndex++}`;
      params.push(parseInt(college_id as string));
    }
    if (student_id) {
      query += ` AND sa.student_id = $${paramIndex++}`;
      params.push(parseInt(student_id as string));
    }

    query += ` ORDER BY s.last_name, s.first_name, cr.deadline_date`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get applications for a student
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const result = await pool.query(`
      SELECT
        sa.*,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        c.name as college_name,
        c.short_name as college_short_name,
        cr.deadline_date,
        cr.decision_date,
        cr.decision_start_date,
        cr.decision_end_date
      FROM student_applications sa
      JOIN students s ON sa.student_id = s.id
      JOIN colleges c ON sa.college_id = c.id
      LEFT JOIN college_rounds cr ON
        cr.college_id = sa.college_id AND
        cr.round_type = sa.round_type AND
        cr.cycle = sa.cycle
      WHERE sa.student_id = $1
      ORDER BY
        CASE sa.round_type
          WHEN 'ED' THEN 1
          WHEN 'ED2' THEN 2
          WHEN 'REA' THEN 3
          WHEN 'EA' THEN 4
          WHEN 'RD' THEN 5
          WHEN 'ROLLING' THEN 6
        END,
        c.name
    `, [studentId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching student applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Create application
router.post('/', async (req, res) => {
  try {
    const {
      student_id,
      college_id,
      round_type,
      cycle,
      status,
      submitted_at,
      decision_result_date,
      notes
    } = req.body;

    const result = await pool.query(
      `INSERT INTO student_applications (
        student_id, college_id, round_type, cycle, status,
        submitted_at, decision_result_date, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        student_id, college_id, round_type, cycle, status || 'PLANNED',
        submitted_at || null, decision_result_date || null, notes || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating application:', err);
    res.status(500).json({ error: 'Failed to create application' });
  }
});

// Update application
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      round_type,
      cycle,
      status,
      submitted_at,
      decision_result_date,
      notes
    } = req.body;

    const result = await pool.query(
      `UPDATE student_applications
       SET round_type = COALESCE($1, round_type),
           cycle = COALESCE($2, cycle),
           status = COALESCE($3, status),
           submitted_at = $4,
           decision_result_date = $5,
           notes = $6
       WHERE id = $7
       RETURNING *`,
      [round_type, cycle, status, submitted_at, decision_result_date, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating application:', err);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Delete application
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM student_applications WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting application:', err);
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

export default router;
