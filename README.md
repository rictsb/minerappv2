# BTC Miner Valuation Terminal v10

A comprehensive web application for valuing Bitcoin mining companies using Sum-of-the-Parts (SOTP) methodology.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (or use Docker)
- npm or yarn

### Local Development with Docker

```bash
# Clone the repository
git clone <your-repo-url>
cd btc-miner-terminal

# Start PostgreSQL with Docker
docker-compose up postgres -d

# Install backend dependencies
cd backend
npm install
cp .env.example .env

# Generate Prisma client and run migrations
npm run db:generate
npm run db:push

# Start backend dev server
npm run dev
```

In a new terminal:
```bash
# Install frontend dependencies
cd frontend
npm install
cp .env.example .env

# Start frontend dev server
npm run dev
```

Open http://localhost:5173 in your browser.

### Local Development without Docker

1. Install PostgreSQL locally
2. Create a database: `createdb btc_miner_terminal`
3. Update `backend/.env` with your connection string
4. Follow the same steps above for backend and frontend

## 📦 Project Structure

```
btc-miner-terminal/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   ├── src/
│   │   └── index.ts         # Express API entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── App.tsx          # Main app with routing
│   │   └── main.tsx         # Entry point
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml       # Local development
├── render.yaml              # Render.com deployment
└── README.md
```

## 🌐 Deploy to Render.com

1. Push this repo to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New" → "Blueprint"
4. Connect your GitHub repo
5. Render will auto-detect `render.yaml` and create:
   - PostgreSQL database
   - Backend API service
   - Frontend static site

### Environment Variables

The `render.yaml` blueprint handles most environment variables automatically. If you need to add API keys:

1. Go to your backend service in Render
2. Add environment variables:
   - `ALPHA_VANTAGE_API_KEY` (optional, for live stock prices)

## 🔧 Development

### Backend Commands

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations (production)
npm run db:seed      # Seed sample data
```

### Frontend Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## 📖 Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Company valuations overview with SOTP breakdown |
| **Projects** | Site/phase/tenancy management with split/merge |
| **Factors** | Hierarchical factors (Global → Company → Site) |
| **Data Quality** | Validation tests and monitoring alerts |
| **Map** | Geographic visualization of mining sites |
| **Settings** | Import/export, monitoring config, API settings |

## 📋 Database Schema

Core entities:
- **Company**: Ticker, BTC holdings, market data
- **Site**: Location, power capacity, ownership
- **Phase**: Operational status, MW capacity, timeline
- **Tenancy**: Lease terms, mining/HPC details

See `backend/prisma/schema.prisma` for full schema.

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/companies` | List all companies |
| GET | `/api/v1/companies/:ticker` | Get company details |
| GET | `/api/v1/global-factors` | Get global factors |
| GET | `/api/v1/data-quality` | Get data quality issues |
| GET | `/health` | Health check |

More endpoints will be added as implementation progresses.

## 📚 Documentation

- [PRD v10](./BTC_Miner_Valuation_Terminal_PRD_v10.md) - Full product requirements
- [Implementation Guide](./BTC_Miner_Valuation_Terminal_PRD_v10.md#appendix-d-implementation-guide-for-claude) - Session-by-session breakdown

## 🛠 Tech Stack

**Backend:**
- Node.js + Express
- PostgreSQL + Prisma ORM
- Socket.IO (real-time updates)
- TypeScript

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- React Query (data fetching)
- React Router (navigation)
- Zustand (state management)
- Recharts (charts)
- Leaflet (maps)

## 📄 License

Private - All rights reserved
