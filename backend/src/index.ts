import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';

// Routes
import studentsRouter from './routes/students';
import collegesRouter from './routes/colleges';
import applicationsRouter from './routes/applications';
import dashboardRouter from './routes/dashboard';
import settingsRouter from './routes/settings';
import crawlerRouter from './routes/crawler';

const app = express();
const port = process.env.PORT || 3000;

// Database connection
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected:', res.rows[0].now);
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/students', studentsRouter);
app.use('/api/colleges', collegesRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/crawler', crawlerRouter);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(port, () => {
  console.log(`Backend API running on port ${port}`);
});
