# Frontend Pages and the API Calls Behind Them

Every screen of the Angular app, grouped by user type, with the exact API calls each one makes.
Read `FRONTEND_GUIDE.md` in the API repository first ([IFRAS_api/docs/FRONTEND_GUIDE.md](https://github.com/kamalmistry6/IFRAS_api/blob/main/docs/FRONTEND_GUIDE.md)) for tokens, error formats, pagination and ids. All paths are relative to `/api/v1`.

**How to read a page entry**

- **Route** is a suggested Angular route.
- **On load** are the calls made when the page opens. **Actions** are calls made by buttons and forms.
- `{publicId}` means the `public_id` (UUID) in the URL. A body field such as `"program": 3` takes the integer `id`.
- `G1`, `G2` and so on point to the numbered gaps in section 6 of the guide.

Pages are numbered by user type: **C** common, **T** teacher, **A** admin, **ST** student.

**Where each user lands after login** (from `GET /auth/me/`): Teacher to `/teacher/today`, Admin, Super admin and Head of department (HOD) to `/admin/dashboard`, Student to `/student/attendance`.

**Build status (2026-10-31).** Where the app differs from the suggestions below: forms are **dialogs** on their list page (not separate `/new` routes) except the student's own page, and A10 is one page with a tab per resource.

| Page | Route in the app | Status |
|---|---|---|
| C1 Login | `/login` | built |
| C2 Shell, C3 error pages | (every signed-in page) | built |
| C4 Change password | `/account/password` (opened from My profile for students and teachers; from the user menu for administrators until they have a profile page) | built. A user whose `must_change_password` is true can open only this page until they change it |
| T1 Today (with T3 extra lecture as a dialog) | `/teacher/today` | built |
| T2 Take attendance | `/teacher/sessions/:id` | built |
| T4 My sessions | `/teacher/sessions` | built |
| T5 My timetable | `/teacher/timetable` | built |
| T6 My profile | `/teacher/profile` (from the user menu) | built |
| Teacher dashboard | `/teacher/dashboard` shows "coming soon" | not built |
| A1 Dashboard (admin, super admin, HOD) | `/admin/dashboard` | built. For an HOD the numbers are their department's; students and enrollments are read-only for them; the sidebar has "My teaching" and "Department" groups |
| A2, A3, A4 Students (list, add dialog, detail page) | `/admin/students`, `/admin/students/:id` | built |
| A5 Enrollments | `/admin/enrollments` | built |
| A6 Teachers | `/admin/teachers` | built |
| A7 Subject assignments | `/admin/assignments` | built |
| A8 Timetable manager | `/admin/timetable` | built |
| A9 Sessions of the college | `/admin/sessions`, `/admin/sessions/:id` | built (starting a lecture for a teacher is not) |
| A10 Academic setup | `/admin/academics` (tabs) | built (no "add the next level" prompt) |
| Reports: subject attendance, defaulters | `/admin/reports` (tabs), `/teacher/reports` (subject attendance only) | built, with Excel and CSV downloads |
| ST1 My attendance | `/student/attendance` | built |
| ST2 Lectures of one subject | `/student/attendance/:offering` | built |
| ST3 My profile | `/student/profile` | built |

---

## Part 1: Pages every user sees

### C1. Login

| | |
|---|---|
| Route | `/login` |
| Who | anyone not signed in |
| Purpose | Sign in and choose the landing page |

| When | Call | Used for |
|---|---|---|
| Submit | `POST /auth/login/` | Get `access` and `refresh` |
| Right after | `GET /auth/me/` | Role, college and profile ids. Store them in app state |

Show "Wrong username or password" for a 401 (the same message covers a deleted or inactive account). There is no "forgot password" link: a user who cannot log in asks an administrator to reset the password. If the user was sent here because of `password_changed` or `user_deleted` (see the guide, 2.3), show that reason above the form.

### C2. App shell (header and menu)

| | |
|---|---|
| Route | wraps every page after login |
| Purpose | Show the user's name and role, a menu by role, and a Logout button |

| When | Call | Used for |
|---|---|---|
| App start, if a refresh token exists | `POST /auth/refresh/` then `GET /auth/me/` | Restore the session after a page reload |
| Every API call | the interceptor | Attach the token, refresh on 401, send the user to login on `user_deleted` or `password_changed` |

Logout only clears the tokens on the client (no server endpoint). The user menu has **My account**, which opens C4.

### C3. Error pages

`403` page (not allowed), `404` page (not found, or belongs to someone else), and a generic "something went wrong" for 5xx and network failures.

### C4. Change password

| | |
|---|---|
| Route | `/account/password` |
| Who | every signed-in user |
| Purpose | Let users replace the password an administrator gave them |

| When | Call | Used for |
|---|---|---|
| **Save** | `POST /auth/change-password/` body `{"old_password": "...", "new_password": "..."}` | Change the password. The response is a **new** `{access, refresh}` pair |

On success, **replace both stored tokens with the new pair** (the old ones stop working, here and on every other device), then show "Password changed". The user stays signed in.

Fields and messages:

| Field | Server message to show next to it |
|---|---|
| Current password | "The current password is incorrect." |
| New password | The list of rule failures: at least 8 characters, not too common, not all digits, not too similar to the username or name, no space at the start or end, different from the current one |
| Confirm new password | Checked in the browser only (the API has no such field) |

Show the rules under the field before the user types. Do not trim the input; let the server report a leading or trailing space.

---

## Part 2: Teacher pages

A teacher sees only their own lectures, sessions and timetable.

### T1. Today's lectures

| | |
|---|---|
| Route | `/teacher/today` |
| Purpose | The daily starting point: today's lectures and one tap to begin attendance |

| When | Call | Used for |
|---|---|---|
| On load | `GET /attendance/today/` | The lecture list for today |
| Date picker changes | `GET /attendance/today/?date=YYYY-MM-DD` | Another day (read only for a teacher, see the start rule below) |
| Tap **Start** | `POST /attendance/timetable/{slotPublicId}/start/` (optional body `{"date": "..."}`) | Create the session, then open T2 |

Each lecture shows `subject_name`, `subject_code`, time, `room` and a badge for `state`:

| `state` | Button | Goes to |
|---|---|---|
| `NOT_STARTED` | **Start attendance** | the `start/` call above, then T2 |
| `OPEN` | **Continue** | T2 with `session.public_id` |
| `SUBMITTED` | **View** | T2 (read only) |
| `CANCELLED` | none, show "Cancelled" | |

**Start rule.** A teacher can start a lecture from 10 minutes before it begins until the end of that day. An earlier day can only be started by a college administrator, and a future day by nobody. Each lecture carries `can_start` and `start_message`: while `can_start` is false, show the Start button disabled with `start_message` under it (for example "You can start this lecture from 9:50 AM (10 minutes before it begins)."). The server enforces the same rule on `POST .../start/` and `POST /attendance/sessions/` (400 with the message), so the screen never has to trust the browser clock. Continuing a session that is already open is never blocked by time. Administrators have no window.

Lectures with `slot: null` are extra lectures created by hand. They have a session, so they use Continue or View. Show a "+ Extra lecture" button that opens T3. Empty list: "No lectures scheduled for this day".

### T2. Take attendance (and view a submitted session)

| | |
|---|---|
| Route | `/teacher/sessions/:sessionPublicId` |
| Purpose | Tick students, submit, cancel, and correct afterwards. One page whose controls depend on `status` |

| When | Call | Used for |
|---|---|---|
| On load | `GET /attendance/sessions/{id}/` | Header, counts and the student list (`records`, already sorted by roll number) |
| Tick or untick (or **Save**) | `PATCH /attendance/sessions/{id}/records/` body `{"records":[{"public_id":"<record>","status":"PRESENT"}]}` | Save changes. Send only the changed students. The response is the updated session |
| **Mark all present** | the same `PATCH` with every record set to `PRESENT` | Resending an unchanged status is harmless |
| **Submit** (confirm first, show the counts) | `POST /attendance/sessions/{id}/submit/` | Lock the session |
| **Cancel lecture** (dialog with a required reason) | `POST /attendance/sessions/{id}/cancel/` body `{"reason":"..."}` | Mark the lecture as not held |
| **Correct** on a student (submitted session) | `POST /attendance/sessions/{id}/corrections/` body `{"record":"<record>","status":"ABSENT","reason":"..."}` | Fix a mistake after submitting |
| Open the history panel | `GET /attendance/sessions/{id}/corrections/` | Old status, new status, reason, who, when |

What to show by `status`:

| Session `status` | Page |
|---|---|
| `OPEN` | Checkbox per student, **Mark all**, **Submit**, **Cancel lecture**. Header counts update from every response |
| `SUBMITTED` | Read-only list with `marked_by_name` and `marked_at`. A **Correct** button per student, and the correction history. After 7 days from the session `date`, tell the teacher to ask an admin (the server enforces it with a 403) |
| `CANCELLED` | Read-only list, plus `cancellation_reason`, `cancelled_by` and `cancelled_at` |

Errors: 400 "no longer open" means someone else submitted or cancelled meanwhile, so reload the page. A 403 on a correction after 7 days shows the message from `detail`.

### T3. Start an extra lecture

| | |
|---|---|
| Route | `/teacher/sessions/new` (or a dialog opened from T1) |
| Purpose | Create a session that is not in the timetable (an extra or rescheduled lecture) |

| When | Call | Used for |
|---|---|---|
| Subject dropdown | `GET /attendance/my-assignments/?is_active=true` | The teacher's own subjects for the current academic year. Label: `subject_name` (`subject_code`), `subject_type`. Send the item's `id` as `teacher_assignment` |
| **Start** | `POST /attendance/sessions/` body `{"teacher_assignment": 4, "date": "2026-10-28", "start_time": "14:00", "end_time": "15:00"}` | Create the session, then open T2 |

Defaults: today's date. The date must not be in the future and must be inside the academic year. Show server messages for an overlap with another lecture, a duplicate start time, or "No active students are enrolled for this subject".

### T4. My sessions (history)

| | |
|---|---|
| Route | `/teacher/sessions` |
| Purpose | Find any earlier session, check its counts, and open it to correct it |

| When | Call | Used for |
|---|---|---|
| On load and on every filter change | `GET /attendance/sessions/?page=1&date__gte=&date__lte=&status=&teacher_assignment=` | The table, newest first |
| Click a row | navigate to T2 | |

Columns: date, time, subject, `status`, `present_count` / `total_students`. Filters: date range, status, and subject. Fill the subject filter from `GET /attendance/my-assignments/` (add `?academic_year={id}` for a past year) and send the chosen item's `id` as `teacher_assignment`.

### T5. My timetable

| | |
|---|---|
| Route | `/teacher/timetable` |
| Purpose | Read-only weekly grid of the teacher's lectures |

| When | Call | Used for |
|---|---|---|
| On load | `GET /attendance/timetable/?is_active=true&page_size=100` | All slots |

Group by `day_of_week` (1 Monday to 7 Sunday) and sort by `start_time`. Show `subject_name`, time, `room` and the validity period (`valid_from` to `valid_to`). Teachers cannot edit; changes are requested from an admin.

### T6. My profile

| | |
|---|---|
| Route | `/teacher/profile` |
| Purpose | Show the teacher's own details and let them correct their own name |

| When | Call | Used for |
|---|---|---|
| On load | `GET /teachers/me/` | Name, username, email, employee id, phone, date of joining, college |
| **Save** | `PATCH /teachers/me/` body `{"first_name": "Amit", "last_name": "Patil"}` | Change the name. The response is the updated profile |

- **Editable:** first name and last name only (1 to 150 characters, not blank; the server shows an error under the field otherwise). Send JSON; an empty string is rejected.
- **Read only (show as plain text):** username, email, employee id, phone, date of joining, active status and college. Add a note: "To change these, ask an administrator." The server ignores any other field you send, so nothing can be changed by mistake.
- After a successful save, update the name in the header: `GET /auth/me/` returns the new name, or copy `first_name` and `last_name` from the response.
- Add a link to C4 (change password) on this page.

---

## Part 3: College admin pages

An `ADMIN` sees and changes only their own college (`college.id` from `/auth/me/`). Records of another college return 404.

### A1. Dashboard

| | |
|---|---|
| Route | `/admin/dashboard` |
| Purpose | Today at a glance |

| When | Call | Used for |
|---|---|---|
| On load | `GET /reports/dashboard/` | Totals, today's lectures by state, this month's attendance and defaulters, the 10 latest sessions. The scope (college, platform or department) follows the user. `?month=YYYY-MM` (the month box) changes the attendance numbers. Drawn with Chart.js (`app-chart`, in the admin module only): a line chart of attendance by day against the limit, a ring for the month, a ring for today's lectures and bars for the lowest subjects. Cards: totals, needs attention today, teachers behind (last 7 days), today's lectures, attendance of the month against the month before, lowest subjects, latest sessions |

### A2. Students list

| | |
|---|---|
| Route | `/admin/students` |

| When | Call | Used for |
|---|---|---|
| On load, paging, and every change of the search box or a filter | `GET /students/?page=1&search=&academic_year=&program=&year_of_study=&enrollment_status=&college=` | Table: name, username, phone, college |
| Click a row | navigate to A4 | |
| **Add student** | navigate to A3 | |

- **Search box** (`search`): matches the name, username, phone, or the roll number of any of the student's enrollments. Several words must all match (`rahul sharma`). Debounce about 300 ms and go back to page 1 when the text changes.
- **Filters:** academic year and program (dropdowns from `GET /academics/academic-years/` and `GET /academics/programs/`), year of study (1 to the program's `duration_years`), and enrollment status. The four are matched against **one** enrollment together, so "2026-2027, year 2" only lists students who are in year 2 *in 2026-2027*.
- `college` is for a super admin only; an `ADMIN` already sees only their own college.
- A bad value (for example `academic_year=abc`) returns 400.

### A3. Add student

| | |
|---|---|
| Route | `/admin/students/new` |

| When | Call | Used for |
|---|---|---|
| Super admin only: on load | `GET /academics/colleges/` | College dropdown. An `ADMIN` sends their own `college.id` as a hidden field |
| **Save** | `POST /students/` body `{"username","password","first_name","last_name","email","college","date_of_birth","phone","address"}` | Create the login and profile. Keep `id` from the `201` response |

Required: `username`, `password`, `first_name`, `last_name`, `college`. Show password rule errors from the server (minimum length 8, not too common, not only digits, not too similar to the username or name). After saving, offer **Enrol this student now**, which opens A5 with the new student's `id`.

### A4. Student details and edit

| | |
|---|---|
| Route | `/admin/students/:publicId` |

| When | Call | Used for |
|---|---|---|
| On load | `GET /students/{publicId}/` | Profile |
| On load | `GET /students/enrollments/?student={id}` | The student's enrollments (`id` is the integer id from the profile response) |
| **Save** | `PATCH /students/{publicId}/` body with any of `first_name`, `last_name`, `date_of_birth`, `phone`, `address` | An administrator can correct the student's name here. **Email and username are shown but cannot be changed** (display them as plain text). Names must be 1 to 150 characters and not blank. Students cannot change their own name |
| Edit an enrollment | `PATCH /students/enrollments/{enrollmentPublicId}/` | Change `status` (for example `WITHDRAWN`) or `roll_number` |

### A5. Enrollments

| | |
|---|---|
| Route | `/admin/enrollments` |

| When | Call | Used for |
|---|---|---|
| On load, paging, and every change of the search box or a filter | `GET /students/enrollments/?page=1&search=&academic_year=&program=&year_of_study=&status=` | Table: `student_name`, `academic_year_name`, `program_name`, `year_of_study`, `roll_number`, `status`. `search` matches the student's name or username and the roll number |
| Student field in the form (type-ahead) | `GET /students/?search={typed text}&page_size=20` | Show `full_name` and `username`; send the chosen student's `id`. Search on every pause in typing instead of loading all students |
| Open the form | `GET /academics/academic-years/` | Academic year dropdown |
| Open the form | `GET /academics/programs/` | Program dropdown. Keep `duration_years` |
| **Save** (new) | `POST /students/enrollments/` body `{"student","academic_year","program","year_of_study","roll_number","status"}` | Enrol. `status` is optional and defaults to `ACTIVE` |
| **Save** (edit) | `PATCH /students/enrollments/{publicId}/` | |

`year_of_study` options are 1 up to the chosen program's `duration_years`. Server messages to show next to the fields: roll number already used in this college and year (`roll_number`), program outside the student's college (`program`), student already enrolled this year, year of study out of range (`year_of_study`).

### A6. Teachers list and form

| | |
|---|---|
| Routes | `/admin/teachers`, `/admin/teachers/new`, `/admin/teachers/:publicId` |

| When | Call | Used for |
|---|---|---|
| List, search and filters | `GET /teachers/?page=1&search=&is_active=&college=` | Table: name, `employee_id`, phone, `is_active`. `search` matches the name, username, employee id and phone. Add an "Active / Inactive / All" filter using `is_active=true` or `false` (leave it out for all) |
| Open a teacher | `GET /teachers/{publicId}/` | Profile |
| **Add** | `POST /teachers/` body `{"username","password","first_name","last_name","email","college","employee_id","phone","date_of_joining","is_active"}` | Create. Super admin picks the college from `GET /academics/colleges/` |
| **Save** | `PATCH /teachers/{publicId}/` with any of `first_name`, `last_name`, `employee_id`, `phone`, `date_of_joining`, `is_active` | Setting `is_active` to false is how a teacher is deactivated. An inactive teacher cannot open sessions or get new slots. Email and username are read-only. Teachers can also change their own name on T6 |

### A7. Subject assignments (who teaches what)

| | |
|---|---|
| Route | `/admin/assignments` |

| When | Call | Used for |
|---|---|---|
| On load, paging, and every change of the search box or a filter | `GET /teachers/subject-assignments/?page=1&search=&teacher=&academic_year=&program=&subject_offering=` | Table: `teacher_name`, `subject_name`, `academic_year_name`. `search` matches the teacher's name, username or employee id and the subject's name or code |
| Teacher field in the form (type-ahead) | `GET /teachers/?search={typed text}&is_active=true&page_size=20` | Send the chosen teacher's `id` |
| Open the form | `GET /academics/academic-years/` and `GET /academics/programs/` | Narrow down the offerings |
| After choosing year and program | `GET /academics/subject-offerings/?academic_year={id}&subject__semester__program={id}` | Offering dropdown. Label: `subject_name`, semester `semester_number`, `subject_type`. Value: `id` |
| **Assign** | `POST /teachers/subject-assignments/` body `{"teacher": id, "subject_offering": id}` | Create |
| **Remove** | `DELETE /teachers/subject-assignments/{publicId}/` | `204` on success. `409` with a message if the assignment already has timetable slots or sessions: show it, and suggest deactivating the slots |

The server rejects a teacher and an offering from different colleges and a deleted teacher.

### A8. Timetable manager

| | |
|---|---|
| Route | `/admin/timetable` |

| When | Call | Used for |
|---|---|---|
| On load | `GET /attendance/timetable/?is_active=true&page_size=100` | Weekly grid, grouped by `day_of_week` |
| Filters | add `teacher_assignment__teacher={teacherId}` or `teacher_assignment__subject_offering={offeringId}` | Narrow to one teacher or subject. Use these when a college has over 100 slots |
| Open the form | `GET /teachers/subject-assignments/?academic_year={id}&search={typed text}&page_size=20` | Assignment dropdown or type-ahead. Label: `teacher_name` and `subject_name`. Value: `id`. Use the academic year the slot is for, and search by teacher or subject |
| Open the form | `GET /academics/academic-years/` | Default `valid_from` and `valid_to` to the academic year's dates |
| **Add** | `POST /attendance/timetable/` body `{"teacher_assignment","day_of_week","start_time","end_time","room","valid_from","valid_to"}` | `day_of_week` is 1 (Monday) to 7 (Sunday) |
| **Edit** | `PATCH /attendance/timetable/{publicId}/` | The assignment cannot be changed, so the field is read-only when editing |
| **Deactivate / Activate** | `PATCH /attendance/timetable/{publicId}/` body `{"is_active": false}` | There is no delete. Reactivating may fail with a clash message |

Messages to show: the teacher already has a lecture at this time (`non_field_errors`), dates outside the academic year (`valid_from`, `valid_to`), end before start (`end_time`), inactive teacher (`teacher_assignment`).

### A9. Sessions (all lectures of the college)

| | |
|---|---|
| Routes | `/admin/sessions` and `/admin/sessions/:sessionPublicId` |

| When | Call | Used for |
|---|---|---|
| List | `GET /attendance/sessions/?page=1&date__gte=&date__lte=&status=&teacher_assignment=&teacher_assignment__subject_offering=` | Table of every session in the college, newest first |
| Open one | `GET /attendance/sessions/{id}/` | Same screen as T2 |
| Fix attendance | `POST /attendance/sessions/{id}/corrections/` and `GET .../corrections/` | An admin has **no time limit** on corrections |
| Also allowed | `PATCH .../records/`, `POST .../submit/`, `POST .../cancel/` | For example, submitting on behalf of a teacher. The admin is stored as `submitted_by` |
| Start a lecture for a teacher | `POST /attendance/timetable/{slot}/start/` | Allowed for any slot in the college |

Filtering by teacher name, subject name or academic year is not supported yet (G7). Filter by `teacher_assignment` (id) for now.

### A10. Academic setup (departments, programs, semesters, subjects, years, offerings)

| | |
|---|---|
| Route | `/admin/academics` with one tab per resource |
| Who | College admin (own college) and super admin. Colleges and academic years are **super admin only**; a college admin sees those tabs read-only |
| Purpose | Build and maintain the structure that enrollments, teaching and attendance depend on |

Every tab follows the same pattern, using the resource path `/academics/<resource>/` (details in the guide, section 7.2):

| When | Call | Used for |
|---|---|---|
| On load, paging, search and filters | `GET /academics/<resource>/?page=1&search=&<filters>` | The table, with a **search box** and the filters in the table below |
| Click **Add** | open a form | |
| **Save** (new) | `POST /academics/<resource>/` | Create. `201` returns the new record with its `id` |
| Click a row, then **Save** | `PATCH /academics/<resource>/{publicId}/` | Edit |
| **Deactivate / Activate** | `PATCH .../{publicId}/` body `{"is_active": false}` | There is **no delete**. Show inactive rows greyed out, and let the user filter with `is_active` |

| Tab | Create form fields | Filters | Parent dropdown loads |
|---|---|---|---|
| Departments | `name`, `code`, `description`, `college` (hidden for a college admin) | `is_active`; `college` (super admin) | `GET /academics/colleges/` (super admin) |
| Programs | `department`, `name`, `code`, `duration_years` (1 to 10), `description` | `department`, `is_active` | `GET /academics/departments/` |
| Semesters | `program`, `semester_number`, `name` (optional) | `program`, `is_active` | `GET /academics/programs/` |
| Subjects | `semester`, `name`, `code`, `subject_type`, `credits` | `semester`, `semester__program`, `subject_type`, `is_active` | `GET /academics/programs/` then `GET /academics/semesters/?program={id}` |
| Subject offerings | `academic_year`, `subject` | `academic_year`, `subject__semester__program`, `is_active` | `GET /academics/academic-years/`, and subjects from `GET /academics/subjects/?semester__program={id}&is_active=true` |
| Academic years (super admin) | `name`, `start_date`, `end_date`, `is_active` | `is_active` | none |
| Colleges (super admin) | `name`, `code`, `address`, `email`, `phone`, `is_active` | `is_active` | none |

Form behaviour that follows from the server rules:

- **After creating a parent, offer to add the next level** (a new program, then its semesters, then subjects, then offerings). This is the normal setup order for a new college or a new year.
- **Edit forms:** show the parent link (department's college, program's department, semester's program and number, subject's semester, offering's year and subject) as **plain text, not editable**. The server rejects changes to them. To "move" something, add a new one and deactivate the old one.
- **Semester number:** offer 1 to `duration_years × 2` of the chosen program (two semesters per year), and skip numbers that already exist.
- **Academic year name:** hint "2026-2027" and use a normal hyphen. A different dash, or years that are not consecutive, are rejected. Dates must not overlap another year (a year may start the day after another ends).
- **Active academic year:** activating a year switches the others off automatically. Show a short note before saving ("This becomes the current year").
- **Shortening a program** or **moving a year's dates** can be refused because students, semesters, sessions or slots already depend on them. Show the message from the server.
- **Messages to show next to the field:** duplicate `code` or `name` inside the parent, an inactive parent ("Programs cannot be added to an inactive department"), a parent from another college.

---

## Part 4: Super admin (platform administrator)

A super admin uses the same pages as a college admin (A1 to A10), with these differences:

| Area | Difference |
|---|---|
| Lists (students, teachers, enrollments, assignments, sessions, timetable, today) | Show **all colleges** together. Student and teacher rows carry a `college` id: look up the name from `GET /academics/colleges/` and show it as a column |
| Create student or teacher (A3, A6) | Show a **college dropdown** from `GET /academics/colleges/` (an `ADMIN` gets a hidden field). Only active colleges are accepted |
| Academic setup (A10) | Also sees the **Colleges** and **Academic years** tabs as editable (a college admin sees them read-only), and gets a college filter on departments (`?college={id}`). A super admin can create a department, program, semester, subject or offering in **any** college |
| Cross-college data | The API never mixes colleges inside one record. For example, a teacher and a subject offering from different colleges are rejected |

Notes:
- Departments, programs, semesters, subjects, academic years and offerings (and colleges) can now be created in the app (A10). **Django admin is still needed** to create administrator accounts and roles.
- Make sure every platform administrator has the `SUPER_ADMIN` role, not only the Django "superuser" flag. Student, teacher, enrollment and assignment endpoints require the role, so a superuser without a role gets 403 there.

---

## Part 5: Student pages

A student sees only their own data. Students get **403** on every teacher and admin endpoint.

### ST1. My attendance (summary)

| | |
|---|---|
| Route | `/student/attendance` |
| Purpose | Attendance percentage overall and per subject |

| When | Call | Used for |
|---|---|---|
| On load | `GET /attendance/my/` | The summary (not paginated) |
| Year switcher (optional) | `GET /attendance/my/?academic_year={id}` | Another year. Offer the years from `GET /academics/academic-years/`. A `404` means "not enrolled that year" (G6) |

Response parts to show:

| Field | Shown as |
|---|---|
| `academic_year.name`, `enrollment.program_name`, `enrollment.roll_number`, `enrollment.year_of_study` | Header |
| `overall` (`present`, `absent`, `total`, `percentage`) | A large percentage and the counts |
| `subjects[]` (`subject_name`, `subject_code`, `subject_type`, `present`, `total`, `percentage`) | One row or card per subject. Flag a subject under 75 % in a warning colour (a UI constant for now). Each row links to ST2 with `subject_offering` |

Empty states: `enrollment` is `null` means "You are not enrolled yet". `subjects` is empty means "No lectures recorded yet". A `percentage` of `null` is shown as "-". Only **submitted** lectures count; cancelled lectures and drafts never appear. Corrections are already included.

### ST2. Lectures of one subject

| | |
|---|---|
| Route | `/student/attendance/:subjectOfferingId` |
| Purpose | Every lecture of the subject with present or absent |

| When | Call | Used for |
|---|---|---|
| On load, paging, filters | `GET /attendance/my/records/?subject_offering={id}&page=1&date__gte=&date__lte=&status=&academic_year=` | Table, newest first |

Columns: `date`, `start_time` to `end_time`, `teacher_name`, `status` as a green or red badge. Filters: date range and status (`PRESENT`, `ABSENT`). Pass the same `academic_year` as ST1 when a year was chosen. Without `subject_offering` the same endpoint lists every lecture across all subjects.

### ST3. My profile

| | |
|---|---|
| Route | `/student/profile` |

| When | Call | Used for |
|---|---|---|
| On load | `GET /students/{student_profile_public_id}/` | Name, phone, date of birth, address. Use the id from `GET /auth/me/` |

Read only, including the name and the email: a student's `PATCH` returns 403. Show "To correct your name or contact details, ask your college administrator." Students change their own password on C4 (`/account/password`); link to it from this page.

---

## Part 6: One-glance matrix, page to API

`R` read, `C` create, `U` update, `D` delete. Paths are under `/api/v1`.

| Page | Endpoints used |
|---|---|
| C1 Login | `POST /auth/login/` (C), `GET /auth/me/` (R) |
| C2 App shell | `POST /auth/refresh/`, `GET /auth/me/` |
| C4 Change password | `POST /auth/change-password/` (returns a new token pair) |
| T1 Today | `GET /attendance/today/`, `POST /attendance/timetable/{id}/start/` |
| T2 Take attendance | `GET /attendance/sessions/{id}/`, `PATCH .../records/`, `POST .../submit/`, `POST .../cancel/`, `GET` and `POST .../corrections/` |
| T3 Extra lecture | `GET /attendance/my-assignments/`, `POST /attendance/sessions/` |
| T4 My sessions | `GET /attendance/sessions/` |
| T5 My timetable | `GET /attendance/timetable/` |
| T6 My profile | `GET /teachers/me/`, `PATCH /teachers/me/` |
| A1 Dashboard | `GET /attendance/today/`, `GET /students/`, `GET /teachers/`, `GET /attendance/sessions/` |
| A2 to A4 Students | `GET /students/` (with `search` and filters), `POST /students/`, `GET` and `PATCH /students/{id}/`, `GET /students/enrollments/?student={id}`, `GET /academics/colleges/` (super admin) |
| A5 Enrollments | `GET` (with `search` and filters), `POST` `/students/enrollments/`, `PATCH /students/enrollments/{id}/`, `GET /students/?search=` (type-ahead), `GET /academics/academic-years/`, `GET /academics/programs/` |
| A6 Teachers | `GET` (with `search`, `is_active`), `POST /teachers/`, `GET`, `PATCH /teachers/{id}/` (names included) |
| A7 Assignments | `GET` (with `search` and filters), `POST /teachers/subject-assignments/`, `DELETE .../{id}/`, `GET /teachers/?search=` (type-ahead), `GET /academics/subject-offerings/`, `GET /academics/academic-years/`, `GET /academics/programs/` |
| A8 Timetable manager | `GET`, `POST /attendance/timetable/`, `PATCH /attendance/timetable/{id}/`, `GET /teachers/subject-assignments/?academic_year=&search=`, `GET /academics/academic-years/` |
| A9 Sessions | `GET /attendance/sessions/`, `GET /attendance/sessions/{id}/`, the T2 actions, `POST /attendance/timetable/{id}/start/` |
| A10 Academic setup | `GET`, `POST /academics/<resource>/` and `GET`, `PATCH /academics/<resource>/{id}/` for `colleges`, `departments`, `programs`, `semesters`, `subjects`, `academic-years`, `subject-offerings` |
| ST1 My attendance | `GET /attendance/my/`, `GET /academics/academic-years/` |
| ST2 Subject lectures | `GET /attendance/my/records/` |
| ST3 My profile | `GET /students/{id}/`, `GET /auth/me/` |

### Definition of done for a page

- Loading, empty and error states exist (a spinner, "nothing yet", and a readable message for 400, 403 and 404).
- 400 messages appear next to the right field, and `non_field_errors` at the top of the form.
- Buttons are disabled while their request is running.
- A role that is not allowed cannot open the route, and the menu hides it.
- The page was tried against `/docs/` first, and the response shape matches the types used.

