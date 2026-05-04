# 🚀 ADMIN PANEL BLUEPRINT (PRODUCTION READY)

---

# 🧱 1. Vision

## Goal

Build a full-control admin panel to:

* Manage CR/LR roles
* Control classes and members
* Edit and fix attendance data
* Monitor sync system
* View logs and analytics

## Philosophy

* Admin should never need raw SQL
* Every critical action must be reversible or logged
* System must scale from **single class → multi-college**

---

# 🧭 2. Navigation Structure (Sidebar)

* Dashboard
* Users
* Classes
* Attendance
* Role Transfers
* Sync Monitor
* Logs
* Analytics
* Settings

---

# 🏠 3. Page-by-Page Breakdown

---

## 📊 Dashboard

### Widgets

* Total Users (`users`)
* Total Classes (`class_groups`)
* Total Members (`class_members`)
* Active Sessions Today (`attendance_sessions`)
* Pending Sync Logs (`sync_logs`)
* Pending Role Transfers (`role_transfers`)

### Charts

* Attendance trend (daily sessions)
* User growth
* Sync success vs failure

---

## 👥 Users Page

### Table

* Name
* Email
* Global Role (`role_global`)
* Class Role (`class_members.role`)
* Status

### Actions

* Promote to CR/LR
* Remove from class
* View full profile
* Disable user (future)

---

## 🏫 Classes Page

### Table

* Branch / Year / Semester / Section
* Member count
* CR / LR

### Actions

* Create class
* Edit class
* Delete / archive class
* View class details

---

## 👥 Class Details Page

### Sections

#### 1. Members

* Roll number
* Name
* Role (CR/LR/Student)
* Status

#### Actions:

* Promote/demote CR/LR
* Remove member
* Fix duplicate entries

---

#### 2. Subjects

* Subject name
* Faculty name
* Type (class/lab)

#### Actions:

* Add subject
* Edit subject
* Delete subject

---

#### 3. Attendance Summary

* Total sessions
* Average attendance %
* Low attendance students

---

## 📊 Attendance Page

### Filters

* Class
* Subject
* Date
* Batch (for labs)

### View

* Session list:

  * Subject
  * Date
  * Batch
  * Taken by
  * Edited status

### Actions

* Edit session
* Delete session
* View attendance records

---

## 👤 Attendance Details Page

### Table

* Student name
* Roll number
* Status (Present/Absent)

### Actions

* Edit individual attendance
* Bulk mark present/absent
* Restore original data (future)

---

## 🔄 Role Transfers Page

### Table

* From user
* To user
* Class
* Role (CR/LR)
* Status

### Actions

* Approve
* Reject
* Force transfer (admin override)

---

## 📡 Sync Monitor Page

### Table

* Entity type
* Entity ID
* Operation
* Status
* Created at
* Synced at

### Actions

* Retry sync
* View payload (JSON)
* Detect duplicate operations

---

## 🧾 Logs Page

### Table

* Admin ID
* Action type
* Target ID
* Description
* Timestamp

### Source

* `admin_logs`

### Future Upgrade

* Add full activity logs (all user actions)

---

## 📈 Analytics Page

### Insights

#### Student Level

* Attendance %
* Risk detection (<75%)

#### Class Level

* Average attendance
* Most bunked subject

#### System Level

* Usage trends
* Session creation patterns

### Charts

* Line (attendance trend)
* Bar (class comparison)
* Heatmap (future)

---

## ⚙️ Settings Page

### Controls

* Attendance threshold (e.g. 75%)
* Max sessions per day
* Feature toggles

### Future

* College / Department hierarchy enable

---

# 🧩 4. UI COMPONENT SYSTEM

* Sidebar (navigation)
* Topbar (search + admin profile)
* Reusable DataTable
* Filter panel
* Modal (edit / confirm actions)
* Drawer (details view)
* Charts (line, bar)
* Toast notifications

---

# 🔐 5. PERMISSION MODEL

## Current

* Admin = `users.role_global = 'admin'`

## Capabilities

* Full access to all tables
* Override any restriction

## Future

* Sub-admin roles:

  * Viewer
  * Moderator
  * Super Admin

---

# 🧠 6. DATA MAPPING (BASED ON CURRENT DB)

| Feature             | Tables Used         |
| ------------------- | ------------------- |
| Users               | users               |
| Classes             | class_groups        |
| Members             | class_members       |
| Subjects            | subjects            |
| Lab Batches         | lab_batches         |
| Attendance Sessions | attendance_sessions |
| Attendance Records  | attendance_records  |
| Role Transfers      | role_transfers      |
| Sync System         | sync_logs           |
| Logs                | admin_logs          |

---

# ⚠️ 7. SYSTEM RULES

* Only ONE CR per class (enforced via index)
* Only ONE LR per class
* Attendance tied to session_id (not direct)
* All edits should mark:

  * `is_edited = true`
  * `edited_at = now()`

---

# 🚀 8. DEVELOPMENT PHASES

## Phase 1

* Dashboard
* Users
* Classes

## Phase 2

* Attendance control
* Role transfers

## Phase 3

* Sync monitor
* Logs

## Phase 4

* Analytics
* Settings

---

# 🔥 FINAL NOTE

This admin panel is not just a tool.

It is:
👉 **Control Layer for the entire system**
👉 **Debugging engine**
👉 **Analytics engine**
👉 **Future multi-college foundation**

---
