# ATTENZA — Updated Master PRD

**Version:** 1.1.0  
**Date:** May 2026  
**Status:** Ready for Development
**App Name:** Attenza  
**Platform:** React Native (Expo)  
**Backend:** Supabase

---

## Table of Contents

1. Product Vision
2. User Roles & Capabilities
3. Strict Membership Model
4. Authentication & Profile Setup
5. CR / LR First-User Rule
6. Student Rule
7. Class Initialization Flow
8. Roll Number System
9. Subject Management
10. Attendance System
11. Offline-First Behavior
12. Real-Time Sync
13. Waiting State Rules
14. Database Schema Rules
15. Validation Rules
16. Role Transfer
17. Admin Controls
18. Why This Architecture Works
19. Important App Behavior
20. Screens Map
21. Build Order & Coding Checklist
22. Future Scope

---

## 1. Product Vision

**Attenza** is a student-led attendance app where CR and LR manage attendance for their class, and students view their own attendance. The app is offline-first, roll-number based, and keeps class data strictly tied to one exact section so no one can enter the wrong class by mistake.

### Plain English
This app is made so class reps take attendance, students see their own status, and nobody gets linked to the wrong section. It should work even when internet is weak, and sync later when online.

---

## 2. User Roles & Capabilities

| Role | Capabilities |
|---|---|
| CR | Create class setup, define roll range, create subjects, take attendance, edit attendance, delete attendance, view history, share attendance, transfer CR role. |
| LR | Same permissions as CR. CR and LR share the same class data. |
| Student | View own attendance, subject-wise breakdown, history, copy summary, edit own name. |
| Admin | Manage roles, resolve conflicts, monitor classes, view logs. |

### Plain English
CR and LR are the managers of the class. Students are viewers. Admin is the super-user who can fix problems if something goes wrong.

---

## 3. Strict Membership Model

### Technical Rule
A person belongs to a class only through `class_members`. The combination of `class_id + roll_number` identifies one exact class member. The app must never decide class membership only from email.

### Constraints
- `class_groups` must be unique by `branch + year + semester + section`.
- `class_members` must be unique by `class_id + roll_number`.
- A `class_members.user_id` can only be claimed once.
- Attendance must always use `class_member_id`.

### Plain English
Each student or rep belongs to one exact roll number inside one exact class. No one should accidentally get attendance from another section.

---

## 4. Authentication & Profile Setup

### Technical Flow
1. User logs in with college email and OTP.
2. User sets password if needed.
3. User fills profile: name, roll number, mobile number, branch, year, semester, section.
4. App checks if a matching `class_groups` row exists.
5. App checks whether the roll number belongs to that exact class.
6. App claims the correct `class_members` row if it exists.
7. If not found, the app shows a waiting or error state depending on role.

### Plain English
After login, the app asks who you are and which class you belong to. Then it checks whether your class already exists and whether your roll number is inside it. If yes, you go in. If not, the app waits or tells you to contact your CR/LR.

---

## 5. CR / LR First-User Rule

### Technical Rule
If the first person from a class is CR or LR and the class does not exist yet, that person must create the class setup. After the class is created, the other rep can join the same class without making another setup.

### Plain English
The first CR or LR who comes from that class creates the class setup. The second rep just joins the same class. There should never be two separate setups for the same section.

---

## 6. Student Rule

### Technical Rule
A student should be able to log in even if the class is not yet created. If the class does not exist yet, show a waiting screen. Once CR/LR creates the class, the student gets linked automatically by roll number.

### Plain English
Students should not be blocked from logging in. They can open the app and wait until their class is ready. Once the CR/LR sets it up, the student becomes connected to that class automatically.

---

## 7. Class Initialization Flow

| User Type | If Class Exists | If Class Does Not Exist |
|---|---|---|
| CR / LR first user | Goes to roll range setup only if class is missing | Creates class setup first |
| CR / LR second user | Skips setup and joins same class | — |
| Student | Claims matching roll-number row | Shows waiting state, then auto-links later |

### Plain English
The first rep creates the class. The second rep joins it. The student just gets attached to the correct roll number when the class exists.

---

## 8. Roll Number System

### Technical Rule
CR sets `start_roll` and `end_roll`. The system generates the roll range. Only those roll numbers are valid inside that class. If a roll number is outside the range, block it.

### Plain English
The CR chooses the roll range for the class. The app then knows exactly which students belong there. Nobody outside that range should be allowed in.

---

## 9. Subject Management

### Technical Rule
Subjects belong to one class only. For labs, batch 1 and batch 2 can be defined by roll ranges inside the same class. Attendance for labs uses the proper batch mapping.

### Plain English
Subjects stay inside one class. Labs can be split into batches, but both batches still belong to the same class and section.

---

## 10. Attendance System

### Technical Rule
Attendance is stored by session. A session belongs to one class and one subject. Each student’s status is stored in `attendance_records` using `class_member_id`.

### Plain English
When attendance is taken, the app saves one attendance event and marks each student as present or absent. It never stores attendance in a loose way that can mix classes.

---

## 11. Offline-First Behavior

### Technical Rule
The app should save locally first, then sync later. UI should not wait for cloud operations. If offline, attendance can still be taken and stored in local queue.

### Plain English
The app should still work even if internet is bad. It should save the data on the phone first and upload it later. That keeps the app fast and reliable.

---

## 12. Real-Time Sync

### Technical Rule
When online, CR and LR should see the same class data. Sync should be based on local changes, timestamps, and conflict handling. The app should not re-fetch everything every time.

### Plain English
If CR edits something, LR should see it too. The app should update smoothly without constantly loading from the backend.

---

## 13. Waiting State Rules

### Technical Rule
If student logs in before class setup:
- Allow login.
- Show a waiting message.
- Do not assign attendance incorrectly.
- Once the class is created, the student’s roll number should be linked.

### Plain English
The student should still get in, but if the class is not ready, they just see a wait message. No wrong section should ever be assigned.

---

## 14. Database Schema Rules

### `users`
Stores only login identity and basic profile data.
- `id`
- `email`
- `mobile_number`
- `name`
- `role_global`
- optional `role`

### `class_groups`
Stores one section.
- `branch`
- `year`
- `semester`
- `section`
- `start_roll`
- `end_roll`

### `class_members`
Stores who belongs to that class.
- `class_id`
- `user_id`
- `roll_number`
- `name`
- `role`
- `status`

### Plain English
The user account is separate from class membership. The class group defines the section. The class members table says exactly who belongs there.

---

## 15. Validation Rules

### Technical Rule
- Roll number must match the class range.
- One CR per class.
- One LR per class.
- No duplicate roll numbers inside a class.
- No attendance outside the class.
- If membership belongs to another class, block it.

### Plain English
The app should be strict. No one can join the wrong class, no one can duplicate a role, and no one can get attendance from another section.

---

## 16. Role Transfer

### Technical Rule
CR or LR can transfer role to another user using a pending transfer flow. The current user must confirm, and the new user must accept before the old role is revoked.

### Plain English
Role transfer should not happen instantly without permission. The old rep stays until the new one accepts.

---

## 17. Admin Controls

### Technical Rule
Admin can correct roles, fix wrong class mappings, and resolve conflicts. Admin actions should be logged.

### Plain English
If something is wrong in the system, admin can fix it and the app should keep a record of what was changed.

---

## 18. Why This Architecture Works

### Technical Summary
This is not a full redesign. It is a stricter version of the same model:
- `users` = identity
- `class_groups` = exact section
- `class_members` = exact person in that section
- `attendance_records` = attendance per class member

### Plain English
This structure keeps everything in the right place. It stops users from jumping into the wrong section and makes attendance accurate.

---

## 19. Important App Behavior

### Technical Rule
- Do not use email alone to determine class.
- Do not use `users.role` as the only truth.
- Do not let the app choose a class without checking `class_id` and roll number.
- Do not block login just because class setup is not done.

### Plain English
The app should always know exactly which class the person belongs to. But login itself should still work even if the class is not ready yet.

---

## 20. Screens Map

### Auth
- LoginScreen
- OTPScreen
- PasswordSetupScreen
- ProfileSetupScreen

### CR / LR
- RollRangeSetupScreen
- StudentNamingScreen
- HomeScreen
- CreateSubjectScreen
- AttendanceScreen
- AttendanceSummaryScreen
- AttendanceShareScreen
- HistoryScreen
- ProfileScreen
- SettingsScreen

### Student
- StudentHomeScreen
- StudentHistoryScreen

### Admin
- AdminDashboardScreen
- AdminUsersScreen
- AdminClassesScreen
- AdminResolveScreen

---

## 21. Build Order & Coding Checklist

### Phase 1 — Foundation
- Expo project setup
- Supabase schema migration
- Local DB schema
- Supabase client and env setup

### Phase 2 — Auth
- LoginScreen + OTP
- Password setup
- Profile setup
- Role detection
- Auth persistence

### Phase 3 — CR/LR Core
- Roll range setup
- Student naming
- HomeScreen
- Subject creation

### Phase 4 — Attendance
- Attendance screen
- Summary screen
- Share screen
- Save to local DB + sync queue

### Phase 5 — Offline Engine
- Sync queue
- Sync engine
- Connectivity watcher
- Pull sync
- Conflict resolver

### Phase 6 — History & Student
- History screen
- Student home screen
- Student history screen
- Auto-link student by roll number

### Phase 7 — Role Transfer
- Transfer flow
- Accept/reject flow

### Phase 8 — Admin
- Admin auth redirect
- Admin dashboard
- Admin users
- Admin classes
- Admin resolve
- Admin logs

### Phase 9 — Polish
- Error handling
- Empty states
- Offline banner
- App icon and splash screen

---

## 22. Future Scope

- Push notifications
- Absentee alerts
- Faculty dashboard
- Attendance export
- AI attendance insights
- Multi-college support
- Dark mode

---

## Architecture Summary

REACT NATIVE (Expo + TypeScript)  
Auth → Profile → Role Detection  
CR/LR Home ←→ Student Home ←→ Admin Home  
↓  
WatermelonDB (Local DB)  
[Users | Classes | Subjects | Attendance | SyncQueue]  
↓  
Sync Engine (background)  
SyncQueue → POST /sync/upload  
GET /sync/download → Local DB  
↓ REST + JWT  
SUPABASE  
[Auth OTP | PostgreSQL | Realtime | RLS]

---

*Document: ATTENZA_PRD_UPDATED.md*  
*Version: 1.1.0 | May 2026*  
*Status: Ready to Code*
