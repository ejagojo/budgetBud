# BudgetBud Project Breakdown

## Project Overview

BudgetBud is a 2-user budgeting webapp (Mobile-first + Desktop) that enables couples to manage shared household finances through PIN-based authentication, custom budget breakdowns, and paycheck history with immutable snapshots.

**Core Logic:** 2 users, isolated data via PIN login (no shared email/pass), custom budget breakdowns, paycheck history with "snapshots" of allocations.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind, Supabase (DB + Edge Functions).

## Epic Structure

### Epic 1: Foundation (MVP)
*Setup Supabase, PIN Authentication, and Core Infrastructure*

### Epic 2: Budget Management (MVP)
*Category CRUD, Budget Assignment, Dashboard Overview*

### Epic 3: Paycheck Logic & History (V1)
*Paycheck Creation with Snapshots, History Views, Advanced Features*

---

## Epic 1: Foundation (MVP)

### Story 1.1: PIN-Based Authentication Setup
**As a** user, **I want to** authenticate using a 4-digit PIN **so that** I can securely access my budgeting data without email/password complexity.

**Acceptance Criteria:**
- [ ] PIN entry interface accepts 4 digits only
- [ ] PIN is hashed before storage/transmission
- [ ] Invalid PIN shows clear error message
- [ ] Successful PIN login creates authenticated session
- [ ] Session persists across app reloads
- [ ] Two users can authenticate with different PINs
- [ ] PIN authentication works on mobile and desktop

**Technical Notes:**
- Edge function validates PIN hash against database
- Returns Supabase session token on success
- RLS policies: `user_id = auth.uid()` for all tables
- PIN hash stored in `user_profiles` table
- Session management via Supabase Auth

**UI/UX States:**
- **Empty State:** Clean PIN entry form with numeric keypad
- **Loading State:** PIN validation spinner with "Verifying..." text
- **Error State:** Shake animation with "Invalid PIN" message, retry option
- **Mobile-first:** Large touch targets, portrait orientation optimized

### Story 1.2: Supabase Database Setup
**As a** developer, **I want to** establish the core database schema **so that** user data is properly structured and secured.

**Acceptance Criteria:**
- [ ] `user_profiles` table with PIN hash and user metadata
- [ ] `categories` table with user_id, name, percentage
- [ ] `budget_versions` table for category snapshots
- [ ] `paychecks` table with amount, date, frequency
- [ ] `allocations` table linking paychecks to category amounts
- [ ] RLS policies enforce user_id = auth.uid()
- [ ] Database migrations are version controlled

**Technical Notes:**
- All tables include `user_id` UUID foreign key to auth.users
- RLS enabled on all tables with `user_id = auth.uid()` policy
- `budget_versions` stores immutable snapshots of category percentages
- Composite indexes on frequently queried relationships
- Edge functions handle PIN validation logic

**UI/UX States:**
- **Empty State:** Schema validation confirmation
- **Loading State:** Migration progress indicator
- **Error State:** Clear error messages for schema issues
- **Mobile-first:** N/A (developer-focused setup)

---

## Epic 2: Budget Management (MVP)

### Story 2.1: Dashboard Overview
**As a** user, **I want to** see my current pay period at a glance **so that** I can quickly understand my budget status.

**Acceptance Criteria:**
- [ ] Shows current pay period dates
- [ ] Displays total budget amount
- [ ] Lists all active categories with percentages
- [ ] Shows spent vs budgeted for current period
- [ ] Quick action buttons for common tasks
- [ ] Refreshes data on app focus
- [ ] Works offline with cached data

**Technical Notes:**
- Dashboard queries current budget_version
- Calculates spent amounts from allocations
- Real-time subscription to budget changes
- Progressive Web App capabilities for offline
- Service worker caches dashboard data

**UI/UX States:**
- **Empty State:** Welcome message with "Create your first category" CTA
- **Loading State:** Skeleton loaders for budget cards
- **Error State:** Retry button with "Unable to load budget" message
- **Mobile-first:** Swipe gestures for quick actions, thumb-friendly button placement

### Story 2.2: Category Management
**As a** user, **I want to** create and manage budget categories **so that** I can organize my spending allocations.

**Acceptance Criteria:**
- [ ] Create new category with name and percentage
- [ ] Edit existing category name and percentage
- [ ] Delete category (with confirmation)
- [ ] Percentage validation: total must equal 100%
- [ ] Visual feedback for percentage distribution
- [ ] Categories persist across sessions
- [ ] Undo capability for accidental deletions

**Technical Notes:**
- Categories stored with user_id RLS
- Percentage validation on client and server
- Optimistic UI updates with rollback on error
- Real-time sync across devices
- Category changes trigger new budget_version creation

**UI/UX States:**
- **Empty State:** Illustration showing category creation flow
- **Loading State:** Spinner during category save operations
- **Error State:** Highlight invalid percentages, clear error messaging
- **Mobile-first:** Drag-to-reorder categories, swipe-to-delete gestures

### Story 2.3: Theme Settings
**As a** user, **I want to** customize my app theme **so that** the interface matches my preferences.

**Acceptance Criteria:**
- [ ] Choose from Light, Dark, and Accent color themes
- [ ] Theme persists across sessions
- [ ] Theme applies immediately without reload
- [ ] Theme preference stored per user
- [ ] System theme detection option
- [ ] Accessible color contrast ratios

**Technical Notes:**
- Theme stored in user_profiles table
- CSS custom properties for dynamic theming
- Local storage fallback for instant theme switching
- Theme syncs across user sessions/devices

**UI/UX States:**
- **Empty State:** Theme selector with preview cards
- **Loading State:** Brief flash during theme application
- **Error State:** Fallback to default theme with retry option
- **Mobile-first:** Large theme preview cards, easy touch selection

---

## Epic 3: Paycheck Logic & History (V1)

### Story 3.1: Paycheck Creation with Snapshot
**As a** user, **I want to** record a paycheck **so that** my budget allocations are permanently recorded.

**Acceptance Criteria:**
- [ ] Enter paycheck amount, date, and frequency
- [ ] Automatically creates budget snapshot on save
- [ ] Snapshot preserves current category percentages
- [ ] Paycheck appears in history immediately
- [ ] Amount validation (positive numbers only)
- [ ] Date validation (not future dates)
- [ ] Frequency options: weekly, bi-weekly, monthly

**Technical Notes:**
- Paycheck creation triggers budget_version insert
- Snapshot copies all current category percentages
- Database transaction ensures data consistency
- Paycheck amount distributed across categories
- Historical allocations remain immutable

**UI/UX States:**
- **Empty State:** Form with helpful placeholder text
- **Loading State:** "Creating paycheck..." with progress
- **Error State:** Field-specific validation messages
- **Mobile-first:** Numeric keypad for amounts, date picker optimized

### Story 3.2: Paycheck History List View
**As a** user, **I want to** browse my paycheck history **so that** I can review past budget allocations.

**Acceptance Criteria:**
- [ ] Chronological list of all paychecks
- [ ] Shows date, amount, and frequency
- [ ] Infinite scroll or pagination
- [ ] Search by date range or amount
- [ ] Sort by date (newest first) or amount
- [ ] Quick preview of category allocations
- [ ] Export options (CSV/PDF)

**Technical Notes:**
- Paginated queries with date-based indexing
- Full-text search on amounts and dates
- Pre-computed allocation summaries
- Efficient queries with proper indexing
- Real-time updates for new paychecks

**UI/UX States:**
- **Empty State:** "No paychecks yet" with illustration
- **Loading State:** Skeleton list items during fetch
- **Error State:** Retry button for failed loads
- **Mobile-first:** Swipe-to-preview details, pull-to-refresh

### Story 3.3: Paycheck Detail View
**As a** user, **I want to** view detailed paycheck information **so that** I can understand how my budget was allocated.

**Acceptance Criteria:**
- [ ] Shows paycheck metadata (date, amount, frequency)
- [ ] Displays snapshot of category percentages at time of creation
- [ ] Shows actual allocated amounts per category
- [ ] Visual breakdown with charts/graphs
- [ ] Edit capability for paycheck details
- [ ] Delete paycheck with confirmation
- [ ] Links to related budget versions

**Technical Notes:**
- Joins paycheck with budget_version and allocations
- Immutable snapshot data prevents historical changes
- Chart rendering from allocation data
- Optimistic updates for metadata changes
- Cascade delete protection for allocations

**UI/UX States:**
- **Empty State:** Detailed breakdown placeholder
- **Loading State:** Chart skeleton during data fetch
- **Error State:** Fallback table view for chart failures
- **Mobile-first:** Swipe between chart and table views, expandable sections

### Story 3.4: Advanced History Filters
**As a** user, **I want to** filter paycheck history **so that** I can find specific transactions quickly.

**Acceptance Criteria:**
- [ ] Filter by date range (calendar picker)
- [ ] Filter by amount range (sliders)
- [ ] Filter by frequency type
- [ ] Filter by category allocations
- [ ] Saved filter presets
- [ ] Clear all filters option
- [ ] Filter state persists in URL

**Technical Notes:**
- Dynamic query building with multiple WHERE clauses
- Indexed columns for efficient filtering
- Filter state serialization for bookmarks
- Pre-computed aggregates for range filters
- Query optimization for complex filter combinations

**UI/UX States:**
- **Empty State:** All filters available, no active filters
- **Loading State:** Filter application spinner
- **Error State:** Clear filters button on filter errors
- **Mobile-first:** Collapsible filter panel, touch-friendly controls

