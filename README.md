# BudgetBud

A personal finance budgeting application built with Next.js, TypeScript, and Supabase.

## Features

- PIN-based authentication
- Budget category management
- Paycheck tracking with immutable snapshots
- Real-time spending analytics
- Transaction tracking
- Mobile-first responsive design

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Fill in your Supabase credentials
   ```

4. Set up Supabase:
   ```bash
   npx supabase init
   npx supabase start
   ```

5. Run database migrations (see Epic 1 documentation)

6. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

- `app/` - Next.js App Router pages
- `components/` - Reusable UI components
- `lib/` - Utilities and configurations
- `supabase/` - Database migrations and edge functions

## Documentation

See the `_bmad-output/` directory for detailed implementation documentation for each epic.

