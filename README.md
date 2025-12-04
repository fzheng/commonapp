# College Application Management System

A web-based application for college advisors to manage student college applications, track deadlines, and generate reports.

## Architecture

This application uses Docker containers for isolation and easy deployment:

- **db** - PostgreSQL 16 database
- **backend** - Node.js/Express REST API
- **frontend** - React + Vite + Tailwind CSS
- **crawler** - Automated deadline crawler service

## Prerequisites

- Docker Desktop installed and running
- Git (for cloning the repository)

## Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd commonapp
```

2. Start all services:
```bash
npm run docker:up
# or
docker-compose up --build
```

3. Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Database: localhost:5432

## Available Commands

```bash
# Start all containers
npm run docker:up

# Stop all containers
npm run docker:down

# View logs
npm run docker:logs

# Reset database and restart
npm run docker:reset

# Run backend tests
cd backend && npm test

# Run frontend tests
cd frontend && npm test
```

## Features

### Student Management
- Add, edit, and delete student profiles
- Track graduation year and notes
- View all applications per student
- Search students by name or email

### College Database
- Pre-seeded with **212 US colleges** (Top 200 from US News rankings)
- Manage admission deadlines per round (ED, ED2, EA, REA, RD, Rolling)
- Track deadline sources and confirmations
- Search colleges by name or location

### Application Tracking
- Link students to colleges with specific rounds
- Smart round selection based on college's available deadline data
- Track application status (Planned → Submitted → Admitted/Rejected)
- View deadline countdown
- Shows deadline dates in round dropdown for informed decisions

### Dashboard
- Overview statistics (total students, applications, outcomes)
- Upcoming deadlines widget
- Filter by cycle and time window

### Terminology Glossary
- Built-in glossary explaining admission round types (ED, ED2, EA, REA, RD, Rolling)
- Application status definitions
- Accessible from sidebar for quick reference

### Deadline Crawler
- Automated PDF import from Common App Requirements Grid
- Parses deadline data for 189+ colleges
- Scheduled weekly runs
- Manual trigger available
- Change detection and logging

### Admin Features
- Crawler management and logs
- Data export (CSV/JSON)
- System settings

## Project Structure

```
commonapp/
├── docker-compose.yml     # Container orchestration
├── package.json           # Root scripts
├── db/
│   └── init/              # Database initialization scripts
│       ├── 01_schema.sql  # PostgreSQL schema
│       └── 02_seed_colleges.sql
├── backend/               # Express API
│   ├── Dockerfile
│   └── src/
│       ├── index.ts
│       └── routes/
├── frontend/              # React SPA
│   ├── Dockerfile
│   └── src/
│       ├── api/
│       ├── components/
│       ├── context/
│       └── pages/
└── crawler/               # Crawler service
    ├── Dockerfile
    └── src/
```

## API Endpoints

### Students
- `GET /api/students` - List students
- `POST /api/students` - Create student
- `GET /api/students/:id` - Get student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Colleges
- `GET /api/colleges` - List colleges
- `GET /api/colleges/:id` - Get college with rounds
- `PUT /api/colleges/:id` - Update college
- `POST /api/colleges/:id/rounds` - Add deadline round
- `PUT /api/colleges/:id/rounds/:roundId` - Update round
- `DELETE /api/colleges/:id/rounds/:roundId` - Delete round

### Applications
- `GET /api/applications` - List applications (with filters)
- `POST /api/applications` - Create application
- `PUT /api/applications/:id` - Update application
- `DELETE /api/applications/:id` - Delete application

### Dashboard
- `GET /api/dashboard/stats` - Get statistics
- `GET /api/dashboard/upcoming-deadlines` - Get upcoming deadlines

### Settings
- `GET /api/settings` - Get system settings
- `PUT /api/settings` - Update settings
- `GET /api/settings/export` - Export all data

### Crawler
- `POST /api/crawler/run` - Trigger crawler
- `GET /api/crawler/status` - Get crawler status
- `GET /api/crawler/logs` - Get crawl history

## Development

For development with hot reload, the docker-compose mounts source directories:
- Backend changes: Automatically restarted with ts-node-dev
- Frontend changes: Vite HMR

## Application Cycle Logic

The system automatically determines the current admission cycle:
- September through December: Current year to next year (e.g., 2025-2026)
- January through August: Previous year to current year

Entry year is the second year of the cycle (e.g., 2025-2026 means Fall 2026 entry).

## License

MIT
