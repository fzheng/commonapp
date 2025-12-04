import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the database pool
const mockPool = {
  query: vi.fn(),
};

// Mock the pool before importing routes
vi.mock('../index', () => ({
  pool: mockPool,
}));

// Import routes after mocking
import studentsRouter from '../routes/students';
import collegesRouter from '../routes/colleges';
import applicationsRouter from '../routes/applications';
import dashboardRouter from '../routes/dashboard';

// Create test app
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/students', studentsRouter);
  app.use('/api/colleges', collegesRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/dashboard', dashboardRouter);
  return app;
}

describe('Students API', () => {
  const app = createApp();

  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/students', () => {
    it('should return list of students', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 1, first_name: 'John', last_name: 'Doe', hs_grad_year: 2025, application_count: 3 },
          { id: 2, first_name: 'Jane', last_name: 'Smith', hs_grad_year: 2025, application_count: 5 },
        ],
      });

      const response = await request(app).get('/api/students');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('John Doe');
      expect(response.body[1].name).toBe('Jane Smith');
    });

    it('should filter students by search term', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 1, first_name: 'John', last_name: 'Doe', hs_grad_year: 2025, application_count: 3 },
        ],
      });

      const response = await request(app).get('/api/students?search=john');

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%john%'])
      );
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/api/students');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch students');
    });
  });

  describe('GET /api/students/:id', () => {
    it('should return a single student', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, first_name: 'John', last_name: 'Doe', hs_grad_year: 2025 }],
      });

      const response = await request(app).get('/api/students/1');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('John Doe');
      expect(response.body.id).toBe(1);
    });

    it('should return 404 for non-existent student', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/students/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Student not found');
    });
  });

  describe('POST /api/students', () => {
    it('should create a new student with name field', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, first_name: 'John', last_name: 'Doe', hs_grad_year: 2025 }],
      });

      const response = await request(app)
        .post('/api/students')
        .send({ name: 'John Doe', hs_grad_year: 2025 });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('John Doe');
    });

    it('should create a new student with first_name and last_name', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, first_name: 'John', last_name: 'Doe', hs_grad_year: 2025 }],
      });

      const response = await request(app)
        .post('/api/students')
        .send({ first_name: 'John', last_name: 'Doe', hs_grad_year: 2025 });

      expect(response.status).toBe(201);
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/students')
        .send({ hs_grad_year: 2025 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name is required');
    });
  });

  describe('PUT /api/students/:id', () => {
    it('should update an existing student', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, first_name: 'John', last_name: 'Updated', hs_grad_year: 2026 }],
      });

      const response = await request(app)
        .put('/api/students/1')
        .send({ name: 'John Updated', hs_grad_year: 2026 });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('John Updated');
    });

    it('should return 404 for non-existent student', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/students/999')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/students/:id', () => {
    it('should delete a student', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });

      const response = await request(app).delete('/api/students/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent student', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api/students/999');

      expect(response.status).toBe(404);
    });
  });
});

describe('Colleges API', () => {
  const app = createApp();

  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/colleges', () => {
    it('should return list of colleges with round deadlines', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'MIT',
            short_name: 'MIT',
            city: 'Cambridge',
            state: 'MA',
            usnews_rank: 2,
            round_deadlines: [{ round_type: 'EA', deadline_date: '2024-11-01' }],
          },
        ],
      });

      const response = await request(app).get('/api/colleges');

      expect(response.status).toBe(200);
      expect(response.body[0].name).toBe('MIT');
      expect(response.body[0].available_rounds).toContain('EA');
    });

    it('should filter colleges by search term', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Harvard', round_deadlines: [] },
        ],
      });

      const response = await request(app).get('/api/colleges?search=harvard');

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%harvard%'])
      );
    });
  });

  describe('GET /api/colleges/:id', () => {
    it('should return a college with its rounds', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'MIT', city: 'Cambridge', state: 'MA' }],
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, college_id: 1, round_type: 'EA', deadline_date: '2024-11-01' },
            { id: 2, college_id: 1, round_type: 'RD', deadline_date: '2025-01-01' },
          ],
        });

      const response = await request(app).get('/api/colleges/1');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('MIT');
      expect(response.body.rounds).toHaveLength(2);
    });

    it('should return 404 for non-existent college', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/colleges/999');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/colleges/:id/rounds', () => {
    it('should create a new round for a college', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, college_id: 1, round_type: 'ED', deadline_date: '2024-11-01' }],
      });

      const response = await request(app)
        .post('/api/colleges/1/rounds')
        .send({ round_type: 'ED', cycle: '2024-2025', deadline_date: '2024-11-01' });

      expect(response.status).toBe(200);
      expect(response.body.round_type).toBe('ED');
    });
  });
});

describe('Dashboard API', () => {
  const app = createApp();

  describe('GET /api/dashboard/stats', () => {
    it('should return dashboard statistics', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total_students: 50,
          total_applications: 200,
          submitted_applications: 150,
          admitted_count: 30,
          rejected_count: 10,
          deferred_count: 5,
          waitlisted_count: 3,
        }],
      });

      const response = await request(app).get('/api/dashboard/stats');

      expect(response.status).toBe(200);
      expect(response.body.total_students).toBe(50);
      expect(response.body.total_applications).toBe(200);
    });
  });

  describe('GET /api/dashboard/upcoming-deadlines', () => {
    it('should return upcoming deadlines', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            student_name: 'John Doe',
            college_name: 'MIT',
            round_type: 'EA',
            deadline_date: '2024-11-01',
          },
        ],
      });

      const response = await request(app).get('/api/dashboard/upcoming-deadlines');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].college_name).toBe('MIT');
    });
  });
});
