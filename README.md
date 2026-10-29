# IFRAS web

The Angular web app for the Face Recognition Attendance system. It talks to the Django API
([`IFRAS_api`](https://github.com/kamalmistry6/IFRAS_api)) at `environment.apiBaseUrl`
(`/api/v1`). The face recognition service is in
[`IFRAS_service`](https://github.com/kamalmistry6/IFRAS_service).

Angular 22, NgModules (`standalone: false`), SCSS, Vitest. No UI library: styling is global CSS
classes. Light theme only.

```bash
npm install
ng serve            # http://localhost:4200  (the API must be running on http://127.0.0.1:8000)
ng test --no-watch  # unit tests
ng build            # production build
```

## What is built

Login with the redirect by role; the teacher's Today, Take attendance, My sessions and My timetable;
and for administrators Academic setup, Sessions, Students, Enrollments, Teachers, Subject
assignments and the Timetable manager. Still to build: the student pages, the profile and change
password pages, and the dashboards. The full list with the API calls of each page is
`docs/FRONTEND_PAGES.md` (see its "Build status" table).

## Structure

```
src/app/
  api/         ApiClient (the one HTTP wrapper), typed models, and one service per area
  auth/        login, AuthService, token storage, guards, interceptor, AppPermission and UserType
  core/        toasts, confirm dialog, progress bar, loading and error interceptors, GlobalException
  layout/      shell, top bar, collapsible sidebar, nav.config.ts, 404 and forbidden pages
  main/
    attendance/  screens a teacher and an administrator share: sessions list, take attendance
    teacher/     Today, My timetable
    admin/       Academic setup, Students, Enrollments, Teachers, Assignments, Timetable manager
    student/     (landing page only so far)
  shared/      SharedModule: forms and router modules, formError pipe, app-time-select, utils
src/styles/    the design system: tokens, buttons, forms, icons, cards, tables, timetable ...
```

## Rules

- **Styling is global classes, not wrapper components**: `btn btn-primary`, `form-field`,
  `input-group`, `card`, `badge`, `chips`, `modal`, `page-banner`, `icon icon-user`. Colours and
  sizes come from the tokens in `styles/_tokens.scss`.
- **Every component sets `changeDetection: ChangeDetectionStrategy.Eager`** (Angular 22 defaults to
  OnPush, and this code style changes properties inside `subscribe`). A test host component needs it too.
- Components are declared in an NgModule; test them through that module (`imports: [AdminModule]`).
  A host component used only in a test goes in a small NgModule of its own.
- Role areas load lazily (`canMatch`), so a user never downloads a section they cannot open.
- Permissions are derived from the role in `auth/enums/permission.enum.ts`. Routes, menu items and
  buttons ask for a permission or a role, never a role name in a template. The server enforces
  every rule; the screen only decides what to show.
- The sidebar is data-driven: add an entry to `layout/nav.config.ts` and it is filtered for each user.
- Forms are dialogs (`modal-backdrop` and `modal`). Server errors go under their field through
  `applyServerErrors`; messages that belong to no field appear in an alert in the dialog.
- Lists load through a `Subject` and `switchMap`, so a slow answer to an old filter never replaces a
  newer one; the search box waits 300 ms, drop-downs act at once.
- **Academic setup is configuration-driven**: one table-and-form component reads
  `main/admin/academics/academics.config.ts`. A new resource is one more entry there.

## Sign-in flow

`/login` then `AuthService.login` (access token in memory, refresh token in sessionStorage, or
localStorage when "Keep me signed in") then the home page of the role: teacher `/teacher/today`,
admin `/admin/dashboard`, student `/student/attendance`. A 401 refreshes the token once; if that
fails the user is sent to `/login?reason=expired`.

## Adding a page

1. Create the component in the right area and declare it in that area's module.
2. Add a route in the module, with `title` and `data: { permissions: [...] }` behind the `AuthGuard`.
3. Add a menu item in `layout/nav.config.ts`.
4. Fetch data through the service for that area in `api/services`; errors arrive as `GlobalException`.
5. Write a spec next to it, and check the real endpoint before relying on its shape.
