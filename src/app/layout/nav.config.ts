import { AppPermission, UserType } from 'src/app/auth/enums';

export interface NavItem {
  label: string;
  /** Where the item goes. A parent that only holds `items` has no route. */
  route?: string;
  /** The icon's class suffix: 'calendar' shows  class="icon icon-calendar"  (see styles/_icons.scss). */
  icon: string;
  /** Shown only to users holding ANY of these. Leave out to allow everyone who may see the area. */
  permissions?: AppPermission[];
  /** Shown only to these user types. */
  roles?: UserType[];
  /** Sub-menu. A parent is shown only while at least one of its items is. */
  items?: NavItem[];
}

/**
 * The sidebar menu, in order. To add a screen to the menu, add an entry here;
 * the sidebar filters the list for each user with the same rule the routes and
 * buttons use (roles and permissions). The routes themselves live in each
 * feature module; the menu only decides what to SHOW.
 *
 * Only each area's landing page is listed for now. The rest of the screens
 * are in docs/FRONTEND_PAGES.md.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    route: '/teacher/dashboard',
    icon: 'grid',
    roles: [UserType.TEACHER],
  },
  {
    label: 'Today',
    route: '/teacher/today',
    icon: 'calendar',
    roles: [UserType.TEACHER],
    permissions: [AppPermission.LECTURES_TODAY],
  },
  {
    label: 'My timetable',
    route: '/teacher/timetable',
    icon: 'clock',
    roles: [UserType.TEACHER],
    permissions: [AppPermission.TIMETABLE_VIEW],
  },
  {
    label: 'My sessions',
    route: '/teacher/sessions',
    icon: 'clipboard',
    roles: [UserType.TEACHER],
    permissions: [AppPermission.ATTENDANCE_SESSIONS_VIEW],
  },
  {
    label: 'Dashboard',
    route: '/admin/dashboard',
    icon: 'grid',
    roles: [UserType.ADMIN, UserType.SUPER_ADMIN],
  },
  {
    label: 'Academic setup',
    route: '/admin/academics',
    icon: 'book',
    roles: [UserType.ADMIN, UserType.SUPER_ADMIN],
    permissions: [AppPermission.ACADEMICS_VIEW],
  },
  {
    label: 'Sessions',
    route: '/admin/sessions',
    icon: 'clipboard',
    roles: [UserType.ADMIN, UserType.SUPER_ADMIN],
    permissions: [AppPermission.ATTENDANCE_SESSIONS_VIEW],
  },
  {
    label: 'Students',
    route: '/admin/students',
    icon: 'users',
    roles: [UserType.ADMIN, UserType.SUPER_ADMIN],
    permissions: [AppPermission.STUDENTS_MANAGE],
  },
  {
    label: 'Enrollments',
    route: '/admin/enrollments',
    icon: 'layers',
    roles: [UserType.ADMIN, UserType.SUPER_ADMIN],
    permissions: [AppPermission.ENROLLMENTS_MANAGE],
  },
  {
    label: 'Teachers',
    route: '/admin/teachers',
    icon: 'user',
    roles: [UserType.ADMIN, UserType.SUPER_ADMIN],
    permissions: [AppPermission.TEACHERS_MANAGE],
  },
  {
    label: 'Assignments',
    route: '/admin/assignments',
    icon: 'list',
    roles: [UserType.ADMIN, UserType.SUPER_ADMIN],
    permissions: [AppPermission.ASSIGNMENTS_MANAGE],
  },
  {
    label: 'Timetable',
    route: '/admin/timetable',
    icon: 'calendar',
    roles: [UserType.ADMIN, UserType.SUPER_ADMIN],
    permissions: [AppPermission.TIMETABLE_MANAGE],
  },
  {
    label: 'My attendance',
    route: '/student/attendance',
    icon: 'check-circle',
    roles: [UserType.STUDENT],
    permissions: [AppPermission.MY_ATTENDANCE_VIEW],
  },
];
