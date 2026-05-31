# 247 Labs HR Recruiting Automation - TODO

## Database & Schema
- [x] Add jobTemplates table (id, title, category, description, requirements, salaryRange, version, isActive, createdBy, timestamps)
- [x] Add jobRequests table (id, userId, title, status, conversationHistory JSON, finalDescription, templateId, timestamps)
- [x] Add jobPostings table (id, jobRequestId, title, description, status, fulfilledAt, postedAt, timestamps)
- [x] Add postingSources table (id, name, platform, isActive, credentials encrypted JSON, timestamps)
- [x] Add jobPostingLogs table (id, jobPostingId, sourceId, status, externalJobId, errorMessage, attemptCount, timestamps)
- [x] Extend users table with role (hiring_manager | hr_admin)
- [x] Run db:push migration

## Backend tRPC Routers
- [x] jobTemplates router: list, create, update, delete, getById
- [x] jobRequests router: list, create, sendMessage (AI chat), finalize
- [x] jobPostings router: list, getById, markFulfilled, getMyPostings
- [x] postingSources router: list, create, update, toggle (admin only)
- [x] jobPostingLogs router: list by posting, retry
- [x] distribution router: distributeJob (mock LinkedIn, Upwork, Indeed)
- [x] dashboard router: getKPIs, getHRBoard
- [x] seed router: run (templates + sources)

## Frontend Layout & Branding
- [x] Apply 247 Labs color tokens in index.css (#8B5CF6, #10B981, #EF4444, #1F2937, #F9FAFB)
- [x] Build DashboardLayout with role-based sidebar navigation
- [x] Hiring Manager nav: New Hire Request, My Requests, My Job Postings
- [x] HR Admin nav: all above + Job Templates, Posting Sources, HR Dashboard, Job Posting Logs
- [x] 247 Labs logo/branding in sidebar header
- [x] User role badge in sidebar

## Conversational Hiring Interface
- [x] Chat UI component with streaming-style messages
- [x] tRPC procedure to handle AI conversation (Manus AI / invokeLLM)
- [x] System prompt for HR assistant with template suggestions
- [x] Template suggestion flow (AI detects existing templates)
- [x] Finalize job description and create JobRequest + JobPosting records
- [x] Trigger job distribution after finalization

## Job Template Management (HR Admin)
- [x] Job Templates list page
- [x] Create/Edit template form (title, category, description, requirements, salary range)
- [x] Template versioning (v1, v2, etc.)
- [x] Delete/deactivate template

## Posting Sources Management (HR Admin)
- [x] Posting Sources list page with platform toggle
- [x] Create/Edit source form with credential fields (password-masked)
- [x] Platform status indicators (active/inactive)
- [x] Mock credential placeholders for LinkedIn, Upwork, Indeed
- [x] Mock/Live mode toggle per source

## Job Distribution (Mock/Sandbox)
- [x] LinkedInService mock (returns fake job ID, simulates success/failure)
- [x] UpworkService mock (returns fake job ID, simulates success/failure)
- [x] IndeedService mock (XML feed + fake registration)
- [x] Orchestrator: distribute to all active sources, log results
- [x] Retry logic for failed postings

## HR Metrics Dashboard (HR Admin)
- [x] KPI cards: Total Open Jobs, Avg Time to Fill, Total Fulfilled, Total Posted
- [x] HR Board table: job title, date posted, platforms, status, time-to-fill
- [x] Platform icons (LinkedIn/Upwork/Indeed)
- [x] Mark Fulfilled action
- [x] Monthly bar chart and platform pie chart
- [x] Seed Demo Data button

## Job Posting Logs (HR Admin)
- [x] Logs list page with per-platform breakdown
- [x] Status badges (success/failed/retrying)
- [x] Error message display
- [x] Retry button for failed postings
- [x] Attempt count indicator
- [x] Summary stats (total/success/failed)

## My Requests & My Job Postings (Hiring Manager)
- [x] My Requests page: list of own job requests with status
- [x] My Job Postings page: postings from own requests with platform status

## Testing
- [x] Unit tests for role-based access control (14 tests passing)
- [x] Unit tests for auth logout
- [x] Unit tests for dashboard KPIs access
- [x] Unit tests for posting sources access
- [x] Unit tests for job posting logs access

## Seed Data
- [x] Seed 5 job templates (Frontend Dev v1/v2, Backend Dev, UI/UX Designer, DevOps Engineer)
- [x] Seed 3 posting sources (LinkedIn, Upwork, Indeed) with mock credentials
- [x] Seed button on HR Dashboard for demo data

## Post-Delivery Improvements
- [x] Scrape 247 Labs careers page (17 real job postings)
- [x] Replace placeholder seed templates with all 17 real 247 Labs job postings
- [x] Fix Review & Post modal auto-fill: server now extracts structured JSON (title, requirements, salaryRange) from AI response
- [x] Frontend uses structured fields for reliable pre-population of modal fields
- [x] Auto-seed templates and posting sources on server startup if DB is empty\n
- [x] Auto-save job to templates when posted via AI conversation
- [x] Add "Post Job" button directly on each template card in Templates page
- [x] Add delete action on My Requests rows
- [x] Add update status action on My Requests rows
- [x] BUG: Delete request not working on My Requests page (fixed: cascade-delete child postings/logs before deleting request)
- [x] BUG: Update status not working on My Requests page (fixed: adminProcedure → protectedProcedure with ownership check)
- [x] BUG: Mark fulfilled / update status not working on My Job Postings page (fixed: protectedProcedure with ownership check, full actions UI added)
- [x] AI suggestion chips: backend returns quick-pick options with each clarifying question
- [x] AI suggestion chips: frontend renders clickable chips below AI messages
- [x] Save as Draft: add "Save as Draft" button to Review & Post modal (saves JD without distributing)
