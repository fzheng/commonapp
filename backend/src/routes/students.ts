import { Router } from 'express';
import { pool } from '../index';

const router = Router();

// Helper to combine first and last name
function formatStudentRow(row: Record<string, unknown>) {
  return {
    ...row,
    name: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown',
  };
}

// Helper to parse full name into first/last
function parseName(name: string): { first_name: string; last_name: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '' };
  }
  const last_name = parts.pop() || '';
  const first_name = parts.join(' ');
  return { first_name, last_name };
}

// Get all students with application counts
router.get('/', async (req, res) => {
  try {
    const { search, hs_grad_year } = req.query;

    let query = `
      SELECT
        s.*,
        COUNT(sa.id)::int as application_count,
        SUM(CASE WHEN sa.status = 'SUBMITTED' THEN 1 ELSE 0 END)::int as submitted_count,
        SUM(CASE WHEN sa.status = 'ADMITTED' THEN 1 ELSE 0 END)::int as admitted_count
      FROM students s
      LEFT JOIN student_applications sa ON s.id = sa.student_id
    `;

    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length} OR s.email ILIKE $${params.length} OR s.preferred_name ILIKE $${params.length})`);
    }

    if (hs_grad_year) {
      params.push(parseInt(hs_grad_year as string));
      conditions.push(`s.hs_grad_year = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += `
      GROUP BY s.id
      ORDER BY s.last_name, s.first_name
    `;

    const result = await pool.query(query, params);
    res.json(result.rows.map(formatStudentRow));
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get student by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(formatStudentRow(result.rows[0]));
  } catch (err) {
    console.error('Error fetching student:', err);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// Create student
router.post('/', async (req, res) => {
  try {
    // Support both {name} and {first_name, last_name} formats
    let { first_name, last_name } = req.body;
    const { name, preferred_name, email, hs_grad_year, notes } = req.body;

    // If name is provided, parse it into first/last
    if (name && !first_name) {
      const parsed = parseName(name);
      first_name = parsed.first_name;
      last_name = parsed.last_name;
    }

    if (!first_name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.query(
      `INSERT INTO students (first_name, last_name, preferred_name, email, hs_grad_year, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [first_name, last_name || '', preferred_name || null, email || null, hs_grad_year, notes || null]
    );
    res.status(201).json(formatStudentRow(result.rows[0]));
  } catch (err) {
    console.error('Error creating student:', err);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// Update student
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Support both {name} and {first_name, last_name} formats
    let { first_name, last_name } = req.body;
    const { name, preferred_name, email, hs_grad_year, notes } = req.body;

    // If name is provided, parse it into first/last
    if (name && !first_name) {
      const parsed = parseName(name);
      first_name = parsed.first_name;
      last_name = parsed.last_name;
    }

    const result = await pool.query(
      `UPDATE students
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           preferred_name = $3,
           email = $4,
           hs_grad_year = COALESCE($5, hs_grad_year),
           notes = $6
       WHERE id = $7
       RETURNING *`,
      [first_name, last_name, preferred_name, email, hs_grad_year, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(formatStudentRow(result.rows[0]));
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

export default router;
