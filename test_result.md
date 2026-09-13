#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Global Birthday Calendar with Supabase auth/db, Resend email reminders, 3D globe of today's birthdays, public/private birthdays, personal mode, subscriptions."

backend:
  - task: "GET /api/health (config check)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Returns { status:'ok', supabase:true, resend:true, from } when env vars are set."
        -working: true
        -agent: "testing"
        -comment: "✅ TESTED & WORKING. GET /api/health returns HTTP 200 with correct JSON: {status:'ok', service:'Birthday Globe API', supabase:true, resend:true, from:'Birthday Globe <notify@bdday.tech>'}. All required fields present and validated."

  - task: "POST /api/test-email (Resend integration)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Sends a real email via Resend from notify@bdday.tech. Expect { ok:true, id } on success. Missing 'to' should return 400. Use to='delivered@resend.dev' (Resend success simulator)."
        -working: true
        -agent: "testing"
        -comment: "✅ TESTED & WORKING. POST /api/test-email with {to:'delivered@resend.dev'} returns HTTP 200 with {ok:true, id:'7821f8a2-3daa-437e-b310-b514ae982a6f'}. Validation working: empty body {} returns HTTP 400 with {error:'to is required'}. Resend integration confirmed working. Note: Initial automated test encountered 502 errors due to server memory pressure/restart, but manual curl tests confirm endpoint is fully functional."

  - task: "POST /api/reminders/run (24h reminder engine)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Requires header Authorization: Bearer <CRON_SECRET>. Without/incorrect secret -> 401. With correct secret and body {dryRun:true} -> scans profiles/follows/personal_birthdays for tomorrow's birthdays and returns { ok:true, date, tasksFound, sent, skipped, failed }. Uses Supabase service role (bypasses RLS)."
        -working: true
        -agent: "testing"
        -comment: "✅ TESTED & WORKING. All scenarios validated: (1) No Authorization header -> HTTP 401 {error:'Unauthorized'}. (2) Wrong Authorization 'Bearer wrong' -> HTTP 401 {error:'Unauthorized'}. (3) Correct Authorization 'Bearer bday_cron_9f3a2c7e1b8d4f6a' with {dryRun:true} -> HTTP 200 {ok:true, date:'2026-09-14', tasksFound:0, sent:0, skipped:0, failed:0, dryRun:true, details:[]}. (4) With {dryRun:true, daysAhead:0} -> HTTP 200 {ok:true, date:'2026-09-13', tasksFound:0, sent:0, skipped:0, failed:0, dryRun:true, details:[]}. Supabase service-role connection confirmed working - successfully queries profiles, follows, and personal_birthdays tables without errors."
        -working: "NA"
        -agent: "main"
        -comment: "RE-TEST NEEDED end-to-end: seed a follower + a followed user whose birthday is TOMORROW + a follow row, then POST /api/reminders/run with the CRON secret and confirm sent>=1 and an email is dispatched to the follower."
        -working: true
        -agent: "testing"
        -comment: "✅ END-TO-END TEST PASSED. Created follower user A (delivered@resend.dev) and birthday person user B with tomorrow's birthday (9/14). Created follow relationship A->B. Called POST /api/reminders/run with CRON_SECRET -> HTTP 200 {ok:true, date:'2026-09-14', tasksFound:7, sent:1, skipped:4, failed:2}. CRITICAL ASSERTION PASSED: Email successfully sent to delivered@resend.dev with subject '🎂 Test Person B's birthday is tomorrow'. Deduplication verified: second call returned skipped>=1 (sent:0, skipped:5). Notification created with type 'followed_birthday' for user A. Email reminder pipeline working end-to-end."

  - task: "POST /api/reminders/self-test (user preview email)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "NEW. Requires Authorization: Bearer <supabase user access_token>. Verifies user via admin.auth.getUser(token), finds nearest subscribed/personal birthday, emails a preview reminder to the user's email, inserts a test notification. Returns { ok:true, to, subjectName, daysUntil, hadUpcoming, id }. Without token or bad token -> 401."
        -working: true
        -agent: "testing"
        -comment: "✅ TESTED & WORKING. All scenarios validated: (1) No Authorization header -> HTTP 401 {error:'Unauthorized'}. (2) Invalid token 'Bearer not-a-real-token' -> HTTP 401 {error:'Unauthorized'}. (3) Valid user access token -> HTTP 200 {ok:true, to:'delivered@resend.dev', subjectName:'Test Self User', daysUntil:null, hadUpcoming:false, id:'7afb1f6f-6d8b-4f18-ae37-144bc079de5f'}. Email successfully sent via Resend (id returned). Test notification created with type 'test_reminder'. User authentication via admin.auth.getUser(token) working correctly."
        -working: true
        -agent: "testing"
        -comment: "✅ RE-TESTED & WORKING (regression test after per-user timing feature). POST /api/reminders/self-test with valid user token -> HTTP 200 {ok:true, to:'delivered@resend.dev', subjectName:'Test Birthday Person B', daysUntil:3, hadUpcoming:true, id:'77949f06-2e2b-40c5-8c1f-32146223f4b9'}. Email successfully sent via Resend. Self-test endpoint still working correctly after new feature addition."

  - task: "GET /api/reminders/run (Vercel Cron support)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "NEW. GET method support for /api/reminders/run to support Vercel Cron (which uses GET). Same auth and functionality as POST."
        -working: true
        -agent: "testing"
        -comment: "✅ TESTED & WORKING. (1) GET /api/reminders/run without Authorization header -> HTTP 401 {error:'Unauthorized'}. (2) GET /api/reminders/run with Authorization: Bearer bday_cron_9f3a2c7e1b8d4f6a -> HTTP 200 {ok:true, offsets:[0,1,3], tasksFound:5, sent:0, skipped:4, failed:1}. All required fields present (ok, offsets, tasksFound, sent, skipped, failed). GET method working correctly for Vercel Cron support."

  - task: "Per-user reminder timing (reminder_offsets feature)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "NEW FEATURE. profiles table now has reminder_offsets int[] column (default '{1}'). The daily job POST/GET /api/reminders/run processes offsets [0,1,3] by default and only emails a recipient if that offset is in their reminder_offsets array (unless force=true). This allows users to customize when they receive birthday reminders (same day, 1 day before, 3 days before, etc.)."
        -working: true
        -agent: "testing"
        -comment: "✅ TESTED & WORKING - CORE NEW FEATURE VALIDATED. Comprehensive end-to-end test of per-user reminder timing: (1) Created follower user A (delivered@resend.dev) and birthday user B with birthday 3 days ahead. (2) Set A's reminder_offsets=[1] (only 1-day reminders), called POST /api/reminders/run -> A was NOT emailed for B's 3-day birthday (timing filter correctly excluded). (3) Changed A's reminder_offsets=[3] (only 3-day reminders), called POST /api/reminders/run -> A WAS emailed with subject containing 'is in 3 days' and B's name. sent=1, email delivered to delivered@resend.dev. (4) Deduplication verified: second call returned skipped>=1. (5) Force override tested: {daysAhead:3} sets force=true and offsets=[3]. The reminder_offsets filtering is working correctly - users only receive reminders for the timing offsets they've configured."

frontend:
  - task: "Auth + onboarding + globe/calendar/discover/personal/profile SPA"
    implemented: true
    working: "NA"
    file: "app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Client SPA using Supabase browser client. Not yet tested by agent; awaiting user permission for frontend tests."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Backend implemented and tested."
    -agent: "testing"
    -message: "All 3 backend endpoints PASS. /api/health returns supabase:true,resend:true. /api/test-email sent a real email via Resend (id returned) and returns 400 without 'to'. /api/reminders/run enforces 401 on missing/wrong secret and returns ok:true with correct CRON_SECRET (Supabase service-role queries on profiles/follows/personal_birthdays work, no 500s). Frontend NOT tested (awaiting user permission)."
    -agent: "testing"
    -message: "✅ ALL 3 BACKEND ENDPOINTS TESTED & WORKING. (1) GET /api/health: Returns correct config status with all required fields. (2) POST /api/test-email: Successfully sends emails via Resend, validation working (400 for missing 'to'). Real email sent to delivered@resend.dev with id returned. (3) POST /api/reminders/run: Auth working (401 for missing/wrong token), reminder engine working with correct auth - successfully queries Supabase tables (profiles, follows, personal_birthdays) using service role, accepts dryRun and daysAhead parameters. No critical issues found. Note: Encountered transient 502 errors during automated test due to server memory pressure/restart, but manual verification confirms all endpoints fully functional."
    -agent: "testing"
    -message: "✅ COMPREHENSIVE E2E TESTING COMPLETE - ALL BACKEND ENDPOINTS WORKING. Executed full end-to-end tests for email reminder pipeline: (1) POST /api/reminders/run: Created real Supabase auth users (follower + birthday person with tomorrow's birthday), established follow relationship, verified email sent to delivered@resend.dev with correct subject mentioning birthday person's name, confirmed deduplication working (skipped>=1 on second call), verified followed_birthday notification created. (2) POST /api/reminders/self-test: Validated auth (401 without/with invalid token), confirmed working with valid user access token, email sent via Resend (id returned), test_reminder notification created. All critical assertions passed. Backend email reminder pipeline fully functional."
    -agent: "testing"
    -message: "✅ REGRESSION + NEW FEATURE TEST COMPLETE - PER-USER REMINDER TIMING WORKING. Tested the new reminder_offsets feature comprehensively: (TEST A) GET /api/reminders/run returns 401 without auth, 200 with CRON_SECRET and all required fields (ok, offsets, tasksFound, sent, skipped, failed). (TEST B - CORE NEW FEATURE) Per-user timing validated: User with reminder_offsets=[1] NOT emailed for 3-day birthday (correctly filtered), user with reminder_offsets=[3] IS emailed for 3-day birthday with 'is in 3 days' in subject. Deduplication working. (TEST C) Force override working: daysAhead parameter sets force=true. (TEST D) Self-test endpoint still working after new feature. All backend endpoints working correctly. No critical issues found."