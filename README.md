# Face Attendance — Angular frontend

Angular 22, NgModules (`standalone: false`), SCSS, Vitest. Talks to the Django API at
`environment.apiBaseUrl` (`/api/v1`). Built so far: login and the role redirect.

```bash
npm install
ng serve            # http://localhost:4200
ng test --no-watch  # unit tests
ng build            # production build
```

## Structure

```
src/app/
  api/       ApiClient (the one HTTP wrapper) and typed backend models
  auth/      login, AuthService, token storage, guards, interceptor, AppPermission/UserType, appAuthorize
  core/      toast, confirm dialog, progress bar, loading + error interceptors, GlobalException, error handler
  layout/    shell, topbar, sidebar, nav.config.ts, 404 / forbidden pages
  main/      lazy feature modules per role: teacher/, admin/, student/
  shared/    SharedModule: common Angular modules, formError pipe, form utils
src/styles/  global design system: tokens, buttons, forms, icons, cards, tables, utilities
```

## Rules

- **Styling is global classes, not wrapper components**: `btn btn-primary`, `form-field`,
  `input-group`, `card`, `alert`, `badge`, `icon icon-user`. Add colours and sizes through the
  tokens in `styles/_tokens.scss`. Light theme only.
- **Every component sets `changeDetection: ChangeDetectionStrategy.Eager`** (Angular 22 defaults to
  OnPush, and this code style mutates properties in `subscribe`).
- Components are declared in an NgModule; test them through that module (`imports: [LoginModule]`).
- Role areas load lazily (`canMatch`), so a user never downloads a section they cannot open.
- Permissions are derived from the role in `auth/enums/permission.enum.ts`; routes and menus ask
  for a permission, not a role name.

## Sign-in flow

`/login` → `AuthService.login` (access token in memory, refresh token in sessionStorage, or
localStorage when "Keep me signed in") → role home: teacher `/teacher/today`, admin
`/admin/dashboard`, student `/student/attendance`. A 401 refreshes the token once; if that fails
the user is sent to `/login?reason=expired`.

## Adding a page

1. Create the component in `main/<role>/` and declare it in that role's module.
2. Add a route in the module (with `data: { title, roles/permissions }`).
3. Add a menu item in `layout/nav.config.ts`.
4. Fetch data through `ApiClient`; errors arrive as `GlobalException`.
