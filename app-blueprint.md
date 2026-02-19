# Project Specification: WLM Sri Lanka Management Platform

## 1. Project Overview
**WLM Sri Lanka** is a specialized photo editing agency for Weightlifting and Powerlifting competitions. This web application serves as a centralized management hub for assigning editing tasks, tracking employee attendance, and syncing competition schedules.

### Tech Stack (Free Tier Optimized)
* **Frontend:** React (Vite) + TypeScript
* **Styling:** Tailwind CSS (Critical for specific color-coding)
* **Backend/Database:** Supabase (PostgreSQL + Auth)
* **Hosting:** Vercel (Frontend)
* **Integration:** Google Sheets API (for reading competition data)

---

## 2. Authentication & User Roles
The system supports three user types.

### A. The Single Admin Constraint
* **Rule:** There can be only **ONE** Admin account in the entire system.
* **Capabilities:** Full access to all dashboards, settings, approvals, and personnel data.

### B. Worker Registration Flow
* **Sign Up:** New users create an account by entering:
    * Full Name
    * Email & Password
    * Phone Number
    * Profile Bio/Skills
* **Role Selection:** During sign-up, the user **MUST** select their employment type using a toggle/switch:
    * Option A: **Full-Time Employee**
    * Option B: **Freelancer**
* **Post-Registration:** New accounts are created but may require Admin activation (optional security step).

---

## 3. Feature: Production Pipeline (The 5 Parts)
Every "Project" represents a Competition. A project is marked **"Done"** *only* when all 5 parts are marked complete.

### The 5 Workflow Stages:
1.  **Sorting**
2.  **Selection**
3.  **Cropping**
4.  **Coloring**
5.  **Upload to Pixieset**

### Operational Logic:
* **Multi-Assignment:** The Admin can assign a single part (e.g., "Coloring") to **multiple workers** (e.g., User A and User B).
* **Assignment Notes:** When assigning a task, the Admin must have a text field to add **"Work Details/Notes"** (e.g., "Use the high-contrast preset"). This note must be visible to the worker on their dashboard.
* **Progress Tracking:** Workers update their progress. When a stage is finished, they mark it as "Completed."
* **Project Completion:** The system automatically tags the Project as "Completed" once all 5 stages are done.

---

## 4. Feature: Attendance & Leave Tracker
A visual calendar dashboard for logging work and time off.

### A. Full-Time Employee Calendar
Employees can mark days with the following specific color codes:
* 🟢 **Green:** Office Work
* 🟠 **Orange:** Weekend Work
* 🔵 **Blue:** Weekend (Off)
* 🟡 **Yellow:** Holiday
* 🟢 **Light Green:** Time in Lieu (TIL)

### B. Freelancer Calendar
* 🟢 **Green:** Working Day
* **Requirement:** When a freelancer marks a day as Green, they **must** enter a text note explaining what work was done (e.g., "Edited 500 photos for Colombo Cup").

### C. Leave Management
* **Request:** Both Full-time and Freelancers can request "Leave." They select a date range and provide a reason.
* **Approval:** These requests appear on the Admin Dashboard.
* **Action:** Admin clicks "Approve" or "Reject."
* **Result:** Approved leave automatically updates the user's calendar view.

---

## 5. Feature: Admin Dashboard & Employee Profiles
The Admin has a "Command Center" view.

### Employee Profile View
Clicking on an employee shows:
* **Personal Details:** Contact info & Bio.
* **Attendance Heatmap:** A visual view of their color-coded calendar.
* **Leave History:** Past leaves and current leave balance.
* **Current Load:** List of currently active tasks + Admin Notes sent to them.
* **Work History:** A log of all previous competitions they have worked on.

### Project Archives
* Filterable list showing "Active Projects" vs. "Completed Projects" (History).

---

## 6. Feature: Google Sheets Sync (Upcoming Competitions)
The system must automatically fetch "Upcoming Competitions" from an external Google Sheet.

* **Source URL:** `https://docs.google.com/spreadsheets/d/17jvpRRomAzUQjJiBZN-Li4hMiw0UP4p3nB6V1X6khrc/edit?gid=1971502591#gid=1971502591`
* **Requirement:**
    * The app must read the competition names and dates from this sheet.
    * **Live Sync:** If rows are added or changed in the Google Sheet, the Web App must reflect these changes in the "Upcoming Competitions" list.

---

## 7. Database Schema (Supabase)
* **`profiles`**: `id` (uuid), `email`, `full_name`, `role` (enum: 'admin', 'fulltime', 'freelancer'), `phone`, `bio`.
* **`projects`**: `id`, `name`, `date`, `status` (default: 'pending'), `google_sheet_id` (if applicable).
* **`project_tasks`**: `id`, `project_id`, `stage_name` (Sorting/Selection/etc.), `assigned_users` (array of profile_ids), `admin_note`, `is_complete`.
* **`attendance_logs`**: `id`, `user_id`, `date`, `status_type` (office/weekend_work/etc.), `work_note` (text), `is_leave_request`, `leave_status` (pending/approved/rejected).