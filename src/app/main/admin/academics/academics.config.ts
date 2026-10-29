import { ListQuery } from 'src/app/api/models';

/**
 * What the academic setup page shows for each resource (docs/FRONTEND_PAGES.md, A10).
 *
 * The page is driven by this configuration: one generic table and one generic form
 * read it, so a new resource is one more entry here instead of a new component.
 */

/** A row from the API. Each resource has its own fields, so rows are read through the config. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;

export interface Option {
  value: number | string;
  label: string;
  /** The whole row the option was made from (for example a program's duration_years). */
  row?: Row;
}

/** A list the form or a filter draws its choices from. */
export type LookupName =
  'colleges' | 'departments' | 'programs' | 'academicYears' | 'semesters' | 'subjects';

export const LOOKUPS: Record<LookupName, { resource: string; label: (row: Row) => string }> = {
  colleges: { resource: 'colleges', label: (row) => row.name },
  departments: { resource: 'departments', label: (row) => row.name },
  programs: { resource: 'programs', label: (row) => row.name },
  academicYears: { resource: 'academic-years', label: (row) => row.name },
  semesters: {
    resource: 'semesters',
    label: (row) => `Semester ${row.semester_number}${row.name ? ' - ' + row.name : ''}`,
  },
  subjects: { resource: 'subjects', label: (row) => `${row.name} (${row.code})` },
};

export interface FieldConfig {
  name: string;
  label: string;
  kind: 'text' | 'textarea' | 'number' | 'date' | 'email' | 'select' | 'checkbox';
  required?: boolean;
  hint?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  default?: unknown;
  /** A select filled from a lookup, or from fixed choices. */
  lookup?: LookupName;
  choices?: Option[];
  /** The lookup's query, from the other fields' values (a cascade). Null means "nothing to list yet". */
  lookupQuery?: (values: Record<string, unknown>) => ListQuery | null;
  /** Load the choices again when one of these fields changes. */
  reloadOn?: string[];
  /** A select of semester numbers 1 to twice the program's years, without the ones already used. */
  special?: 'semesterNumber';
  /** Only helps to pick another field (the program that narrows the subjects). Never sent. */
  helper?: boolean;
  /** Chosen when adding, then fixed: shown as plain text when editing, as the server requires. */
  parent?: boolean;
  /** Only a platform administrator chooses it. A college administrator's own college is used. */
  platformOnly?: boolean;
  /** A note shown when the box is ticked. */
  noteWhenChecked?: string;
  /** The text shown for a parent field when editing (it cannot be changed). Defaults to the lookup's label. */
  display?: (row: Row) => string;
}

export interface FilterConfig {
  name: string;
  /** The query parameter the server expects. */
  param: string;
  label: string;
  lookup?: LookupName;
  choices?: Option[];
  platformOnly?: boolean;
}

export interface ColumnConfig {
  header: string;
  value: (row: Row) => string;
  /** 'badge' shows the value as a coloured pill; the default is plain text. */
  kind?: 'text' | 'badge';
  /** The badge colour class (see styles/_ui.scss). */
  badge?: (row: Row) => string;
}

export interface ResourceConfig {
  key: string;
  /** The tab's name. */
  label: string;
  /** The word for one of them ("department"), for buttons and messages. */
  singular: string;
  resource: string;
  searchPlaceholder?: string;
  columns: ColumnConfig[];
  filters: FilterConfig[];
  fields: FieldConfig[];
  /** True for colleges and academic years: only a platform administrator can change them. */
  platformOnly?: boolean;
  emptyHint: string;
  /** Leave out the Active / Inactive column (the academic year already shows "Current"). */
  hideStatus?: boolean;
  /** Asked before activating a row, for example "This becomes the current year". */
  activateNote?: string;
}

const ACTIVE_FILTER: FilterConfig = {
  name: 'active',
  param: 'is_active',
  label: 'Status',
  choices: [
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ],
};

const SUBJECT_TYPES: Option[] = [
  { value: 'THEORY', label: 'Theory' },
  { value: 'PRACTICAL', label: 'Practical' },
];

export const RESOURCES: ResourceConfig[] = [
  {
    key: 'departments',
    label: 'Departments',
    singular: 'department',
    resource: 'departments',
    searchPlaceholder: 'Search name or code',
    emptyHint: 'Add a department, then its programs.',
    columns: [
      { header: 'Department', value: (row) => row.name },
      { header: 'Code', value: (row) => row.code },
      { header: 'Description', value: (row) => row.description || '-' },
    ],
    filters: [
      {
        name: 'college',
        param: 'college',
        label: 'College',
        lookup: 'colleges',
        platformOnly: true,
      },
      ACTIVE_FILTER,
    ],
    fields: [
      {
        name: 'college',
        label: 'College',
        kind: 'select',
        lookup: 'colleges',
        required: true,
        parent: true,
        platformOnly: true,
      },
      { name: 'name', label: 'Name', kind: 'text', required: true },
      { name: 'code', label: 'Code', kind: 'text', required: true },
      { name: 'description', label: 'Description (optional)', kind: 'textarea' },
    ],
  },
  {
    key: 'programs',
    label: 'Programs',
    singular: 'program',
    resource: 'programs',
    searchPlaceholder: 'Search name or code',
    emptyHint: 'Add a program (a course such as BSc Computer Science), then its semesters.',
    columns: [
      { header: 'Program', value: (row) => row.name },
      { header: 'Code', value: (row) => row.code },
      { header: 'Department', value: (row) => row.department_name },
      { header: 'Length', value: (row) => `${row.duration_years} years` },
    ],
    filters: [
      { name: 'department', param: 'department', label: 'Department', lookup: 'departments' },
      ACTIVE_FILTER,
    ],
    fields: [
      {
        name: 'department',
        label: 'Department',
        kind: 'select',
        lookup: 'departments',
        required: true,
        parent: true,
        display: (row) => row.department_name,
      },
      { name: 'name', label: 'Name', kind: 'text', required: true },
      { name: 'code', label: 'Code', kind: 'text', required: true },
      {
        name: 'duration_years',
        label: 'Length in years',
        kind: 'number',
        required: true,
        min: 1,
        max: 10,
        default: 3,
      },
      { name: 'description', label: 'Description (optional)', kind: 'textarea' },
    ],
  },
  {
    key: 'semesters',
    label: 'Semesters',
    singular: 'semester',
    resource: 'semesters',
    searchPlaceholder: 'Search name',
    emptyHint: 'Add the semesters of a program, then their subjects.',
    columns: [
      { header: 'Program', value: (row) => row.program_name },
      { header: 'Semester', value: (row) => `Semester ${row.semester_number}` },
      { header: 'Name', value: (row) => row.name || '-' },
    ],
    filters: [
      { name: 'program', param: 'program', label: 'Program', lookup: 'programs' },
      ACTIVE_FILTER,
    ],
    fields: [
      {
        name: 'program',
        label: 'Program',
        kind: 'select',
        lookup: 'programs',
        required: true,
        parent: true,
        display: (row) => row.program_name,
      },
      {
        name: 'semester_number',
        label: 'Semester number',
        kind: 'select',
        special: 'semesterNumber',
        required: true,
        parent: true,
        reloadOn: ['program'],
        display: (row) => `Semester ${row.semester_number}`,
        hint: 'Two semesters a year. Numbers already added are not offered.',
      },
      { name: 'name', label: 'Name (optional)', kind: 'text', placeholder: 'For example: Autumn' },
    ],
  },
  {
    key: 'subjects',
    label: 'Subjects',
    singular: 'subject',
    resource: 'subjects',
    searchPlaceholder: 'Search name or code',
    emptyHint: 'Add the subjects of a semester, then offer them in an academic year.',
    columns: [
      { header: 'Subject', value: (row) => row.name },
      { header: 'Code', value: (row) => row.code },
      { header: 'Semester', value: (row) => `Semester ${row.semester_number}` },
      {
        header: 'Type',
        kind: 'badge',
        value: (row) => (row.subject_type === 'PRACTICAL' ? 'Practical' : 'Theory'),
        badge: (row) => (row.subject_type === 'PRACTICAL' ? 'badge-info' : 'badge-primary'),
      },
      { header: 'Credits', value: (row) => String(row.credits ?? '-') },
    ],
    filters: [
      { name: 'program', param: 'semester__program', label: 'Program', lookup: 'programs' },
      { name: 'type', param: 'subject_type', label: 'Type', choices: SUBJECT_TYPES },
      ACTIVE_FILTER,
    ],
    fields: [
      {
        name: 'program',
        label: 'Program',
        kind: 'select',
        lookup: 'programs',
        required: true,
        helper: true,
        hint: 'Narrows the semesters below.',
      },
      {
        name: 'semester',
        label: 'Semester',
        kind: 'select',
        lookup: 'semesters',
        required: true,
        parent: true,
        reloadOn: ['program'],
        display: (row) => `Semester ${row.semester_number}`,
        lookupQuery: (values) =>
          values['program'] ? { program: values['program'] as number } : null,
      },
      { name: 'name', label: 'Name', kind: 'text', required: true },
      { name: 'code', label: 'Code', kind: 'text', required: true },
      {
        name: 'subject_type',
        label: 'Type',
        kind: 'select',
        choices: SUBJECT_TYPES,
        required: true,
        default: 'THEORY',
      },
      { name: 'credits', label: 'Credits', kind: 'number', min: 0, max: 30, default: 3 },
    ],
  },
  {
    key: 'subject-offerings',
    label: 'Subject offerings',
    singular: 'offering',
    resource: 'subject-offerings',
    searchPlaceholder: 'Search subject name or code',
    emptyHint: 'Offer a subject in an academic year so a teacher can be assigned to it.',
    columns: [
      { header: 'Subject', value: (row) => `${row.subject_name} (${row.subject_code})` },
      { header: 'Program', value: (row) => row.program_name },
      { header: 'Semester', value: (row) => `Semester ${row.semester_number}` },
      {
        header: 'Academic year',
        kind: 'badge',
        value: (row) => row.academic_year_name,
        badge: () => 'badge-primary',
      },
    ],
    filters: [
      { name: 'year', param: 'academic_year', label: 'Academic year', lookup: 'academicYears' },
      {
        name: 'program',
        param: 'subject__semester__program',
        label: 'Program',
        lookup: 'programs',
      },
      ACTIVE_FILTER,
    ],
    fields: [
      {
        name: 'academic_year',
        label: 'Academic year',
        kind: 'select',
        lookup: 'academicYears',
        required: true,
        parent: true,
        display: (row) => row.academic_year_name,
      },
      {
        name: 'program',
        label: 'Program',
        kind: 'select',
        lookup: 'programs',
        required: true,
        helper: true,
        hint: 'Narrows the subjects below.',
      },
      {
        name: 'subject',
        label: 'Subject',
        kind: 'select',
        lookup: 'subjects',
        required: true,
        parent: true,
        reloadOn: ['program'],
        display: (row) => `${row.subject_name} (${row.subject_code})`,
        lookupQuery: (values) =>
          values['program']
            ? { semester__program: values['program'] as number, is_active: true }
            : null,
      },
    ],
  },
  {
    key: 'academic-years',
    label: 'Academic years',
    singular: 'academic year',
    resource: 'academic-years',
    searchPlaceholder: 'Search name',
    platformOnly: true,
    hideStatus: true,
    activateNote: 'This becomes the current academic year. The other years stop being current.',
    emptyHint: 'Add the academic year, for example 2026-2027.',
    columns: [
      {
        header: 'Year',
        value: (row) => row.name,
      },
      { header: 'Starts', value: (row) => row.start_date },
      { header: 'Ends', value: (row) => row.end_date },
      {
        header: 'Current',
        kind: 'badge',
        value: (row) => (row.is_active ? 'Current year' : '-'),
        badge: (row) => (row.is_active ? 'badge-success' : ''),
      },
    ],
    filters: [ACTIVE_FILTER],
    fields: [
      {
        name: 'name',
        label: 'Name',
        kind: 'text',
        required: true,
        placeholder: '2026-2027',
        hint: 'Two consecutive years with a normal hyphen.',
      },
      { name: 'start_date', label: 'Starts', kind: 'date', required: true },
      { name: 'end_date', label: 'Ends', kind: 'date', required: true },
      {
        name: 'is_active',
        label: 'This is the current academic year',
        kind: 'checkbox',
        default: false,
        noteWhenChecked: 'This becomes the current year. The other years stop being current.',
      },
    ],
  },
  {
    key: 'colleges',
    label: 'Colleges',
    singular: 'college',
    resource: 'colleges',
    searchPlaceholder: 'Search name or code',
    platformOnly: true,
    emptyHint: 'Add the first college.',
    columns: [
      { header: 'College', value: (row) => row.name },
      { header: 'Code', value: (row) => row.code },
      { header: 'Email', value: (row) => row.email || '-' },
      { header: 'Phone', value: (row) => row.phone || '-' },
    ],
    filters: [ACTIVE_FILTER],
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true },
      { name: 'code', label: 'Code', kind: 'text', required: true },
      { name: 'address', label: 'Address (optional)', kind: 'textarea' },
      { name: 'email', label: 'Email (optional)', kind: 'email' },
      { name: 'phone', label: 'Phone (optional)', kind: 'text' },
      { name: 'is_active', label: 'Active', kind: 'checkbox', default: true },
    ],
  },
];
