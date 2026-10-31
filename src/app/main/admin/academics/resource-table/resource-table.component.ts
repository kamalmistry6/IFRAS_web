import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  EMPTY,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  filter,
  merge,
  switchMap,
  tap,
} from 'rxjs';
import { ListQuery } from 'src/app/api/models';
import { AcademicsService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ConfirmService, ToastService } from 'src/app/core/services';
import { PAGE_SIZE, PageRange, applyServerErrors, pageRange } from 'src/app/shared/utils';
import {
  FieldConfig,
  FilterConfig,
  LOOKUPS,
  LookupName,
  Option,
  ResourceConfig,
  Row,
} from '../academics.config';

/**
 * One tab of the academic setup: a searchable, filterable, paged table of one resource,
 * with an add / edit dialog and Deactivate / Activate. Everything that differs between
 * departments, programs, semesters ... comes from the ResourceConfig it is given.
 *
 *   <app-resource-table [config]="config" [platform]="isSuperAdmin" [canWrite]="true" [collegeId]="1">
 */
@Component({
  selector: 'app-resource-table',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './resource-table.component.html',
  styleUrls: ['./resource-table.component.scss'],
})
export class ResourceTableComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) config!: ResourceConfig;
  /** A platform administrator (sees the college field and filter). */
  @Input() platform = false;
  /** False for a tab the user may only read (colleges and academic years for a college administrator). */
  @Input() canWrite = true;
  /** A college administrator's own college, sent when adding a department. */
  @Input() collegeId: number | null = null;

  // The list, its filters and its pages
  rows: Row[] = [];
  count = 0;
  page = 1;
  filters: FormGroup = new FormGroup({});
  loading = false;
  loaded = false;
  error = '';

  /** Choices for filters and form fields, by lookup name. */
  lookups: Partial<Record<LookupName, Option[]>> = {};

  // The add and edit dialog
  showForm = false;
  /** The row being edited, or null when adding. */
  editing: Row | null = null;
  form: FormGroup = new FormGroup({});
  formErrors: string[] = [];
  saving = false;
  /** The choices of each select field in the dialog, which can change as other fields change. */
  fieldOptions: Record<string, Option[]> = {};

  private readonly reload$ = new Subject<void>();
  private readonly subscription = new Subscription();
  private formSubscription = new Subscription();

  constructor(
    private fb: FormBuilder,
    private academics: AcademicsService,
    private confirm: ConfirmService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.reload$
        .pipe(
          tap(() => {
            this.loading = true;
            this.error = '';
          }),
          switchMap(() =>
            this.academics.list<Row>(this.config.resource, this.query()).pipe(
              catchError((error: GlobalException) => {
                this.loading = false;
                this.error = error.message;
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((page) => {
          this.rows = page.results;
          this.count = page.count;
          this.loading = false;
          this.loaded = true;
        }),
    );

    this.setUpFilters();
    this.reload$.next();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // The parent recreates this component for each tab, so a new config never arrives later.
    if (changes['config'] && !changes['config'].firstChange) {
      this.setUpFilters();
      this.page = 1;
      this.reload$.next();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.formSubscription.unsubscribe();
  }

  // ---- The list --------------------------------------------------------------------

  get visibleFilters(): FilterConfig[] {
    return this.config.filters.filter((item) => this.platform || !item.platformOnly);
  }

  get range(): PageRange {
    return pageRange(this.count, this.page, PAGE_SIZE);
  }

  get hasFilters(): boolean {
    return Object.values(this.filters.getRawValue()).some((value) => !!value);
  }

  get searchable(): boolean {
    return !!this.config.searchPlaceholder;
  }

  get showStatus(): boolean {
    return !this.config.hideStatus;
  }

  filterOptions(item: FilterConfig): Option[] {
    return item.choices ?? this.lookups[item.lookup as LookupName] ?? [];
  }

  clearFilters(): void {
    const empty = Object.fromEntries(Object.keys(this.filters.controls).map((key) => [key, '']));
    this.filters.reset(empty);
  }

  goTo(page: number): void {
    if (page < 1 || page > this.range.totalPages || page === this.page) return;
    this.page = page;
    this.reload$.next();
  }

  retry(): void {
    this.reload$.next();
  }

  // ---- Deactivate and activate -----------------------------------------------------

  toggleActive(row: Row): void {
    const activating = !row.is_active;
    const name = this.rowName(row);

    const apply = () =>
      this.academics
        .update(this.config.resource, row.public_id, { is_active: activating })
        .subscribe({
          next: () => {
            this.toast.success(activating ? `${name} activated` : `${name} deactivated`);
            this.reload$.next();
          },
          error: (error: GlobalException) =>
            this.toast.error(
              `Could not ${activating ? 'activate' : 'deactivate'} it`,
              error.message,
            ),
        });

    if (activating && !this.config.activateNote) {
      apply();
      return;
    }

    this.confirm
      .confirm({
        title: activating
          ? `Activate this ${this.config.singular}?`
          : `Deactivate this ${this.config.singular}?`,
        message: activating
          ? this.config.activateNote
          : `${name} stays in the records but can no longer be chosen for anything new.`,
        confirmText: activating ? 'Activate' : 'Deactivate',
        danger: !activating,
      })
      .pipe(filter(Boolean))
      .subscribe(apply);
  }

  // ---- The dialog ------------------------------------------------------------------

  /** The fields this user fills in: a college administrator does not choose the college. */
  get fields(): FieldConfig[] {
    return this.config.fields.filter((field) => {
      if (field.platformOnly && !this.platform) return false;
      if (this.editing && field.helper) return false;
      return true;
    });
  }

  /** On the edit form a parent link is plain text, because the server rejects changing it. */
  isFixed(field: FieldConfig): boolean {
    return !!this.editing && !!field.parent;
  }

  fixedText(field: FieldConfig): string {
    if (field.display && this.editing) return field.display(this.editing);

    const value = this.editing?.[field.name];
    const option = (this.lookups[field.lookup as LookupName] ?? []).find(
      (item) => item.value === value,
    );
    return option?.label ?? String(value ?? '');
  }

  openAdd(): void {
    this.editing = null;
    this.openForm();
  }

  openEdit(row: Row): void {
    this.editing = row;
    this.openForm();
  }

  /** Escape closes the dialog. */
  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.showForm) this.closeForm();
  }

  closeForm(): void {
    this.showForm = false;
    this.editing = null;
    this.formErrors = [];
    this.formSubscription.unsubscribe();
  }

  /** The note under a ticked box, for example "This becomes the current year". */
  note(field: FieldConfig): string {
    return field.kind === 'checkbox' && this.form.value[field.name]
      ? (field.noteWhenChecked ?? '')
      : '';
  }

  save(): void {
    if (this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const body = this.body();

    this.saving = true;
    this.formErrors = [];

    const request = this.editing
      ? this.academics.update<Row>(this.config.resource, this.editing.public_id, body)
      : this.academics.create<Row>(this.config.resource, body);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.toast.success(this.editing ? `${this.capital()} updated` : `${this.capital()} added`);
        this.closeForm();
        this.reload$.next();
      },
      error: (error: GlobalException) => {
        this.saving = false;
        this.formErrors = applyServerErrors(this.form, error);
      },
    });
  }

  // ---- Helpers ---------------------------------------------------------------------

  /** A short name for a row in messages ("Computer Science"). */
  rowName(row: Row): string {
    return row.name ?? row.subject_name ?? row.program_name ?? `This ${this.config.singular}`;
  }

  private capital(): string {
    const word = this.config.singular;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  private setUpFilters(): void {
    const controls: Record<string, FormControl<string>> = {};
    if (this.searchable) controls['search'] = new FormControl('', { nonNullable: true });
    for (const item of this.visibleFilters) {
      controls[item.name] = new FormControl('', { nonNullable: true });
    }
    this.filters = new FormGroup(controls);

    // Typing in the search box waits for a pause; the drop-downs act at once.
    const changes = Object.entries(controls).map(([name, control]) =>
      name === 'search' ? control.valueChanges.pipe(debounceTime(300)) : control.valueChanges,
    );
    this.subscription.add(
      merge(...changes).subscribe(() => {
        this.page = 1;
        this.reload$.next();
      }),
    );

    for (const item of this.visibleFilters) {
      if (item.lookup) this.loadLookup(item.lookup);
    }
  }

  private query(): ListQuery {
    const values = this.filters.getRawValue() as Record<string, string>;
    const query: ListQuery = { page: this.page, search: (values['search'] ?? '').trim() };

    for (const item of this.visibleFilters) query[item.param] = values[item.name];

    return query;
  }

  /** Loads the rows of a lookup once, as choices for filters and form fields. */
  private loadLookup(
    name: LookupName,
    query: ListQuery = {},
    then?: (options: Option[]) => void,
  ): void {
    const lookup = LOOKUPS[name];

    this.academics.list<Row>(lookup.resource, { page_size: 100, ...query }).subscribe((page) => {
      const options = page.results.map((row) => ({ value: row.id, label: lookup.label(row), row }));

      if (then) then(options);
      else this.lookups[name] = options;
    });
  }

  private openForm(): void {
    const controls: Record<string, FormControl> = {};

    for (const field of this.fields) {
      const validators = [];
      if (field.required) validators.push(Validators.required);
      if (field.kind === 'number') {
        if (field.min !== undefined) validators.push(Validators.min(field.min));
        if (field.max !== undefined) validators.push(Validators.max(field.max));
      }
      if (field.kind === 'email') validators.push(Validators.email);

      controls[field.name] = new FormControl(this.startValue(field), { validators });
    }

    this.form = this.fb.group(controls);
    this.formErrors = [];
    this.fieldOptions = {};
    this.formSubscription.unsubscribe();
    this.formSubscription = new Subscription();
    this.showForm = true;

    // Fields that other fields narrow listen for changes; the rest load once.
    for (const field of this.fields) {
      if (this.isFixed(field) || field.kind !== 'select') continue;

      this.loadFieldOptions(field);

      for (const source of field.reloadOn ?? []) {
        this.formSubscription.add(
          this.form.controls[source]?.valueChanges.subscribe(() => {
            this.form.controls[field.name].setValue(null);
            this.loadFieldOptions(field);
          }),
        );
      }
    }
  }

  private startValue(field: FieldConfig): unknown {
    if (this.editing) {
      const value = this.editing[field.name];
      return value ?? (field.kind === 'checkbox' ? false : '');
    }

    if (field.default !== undefined) return field.default;
    if (field.kind === 'checkbox') return false;
    return field.kind === 'select' ? null : '';
  }

  /** Fills the choices of one select field: fixed choices, a lookup, or the free semester numbers. */
  private loadFieldOptions(field: FieldConfig): void {
    if (field.choices) {
      this.fieldOptions[field.name] = field.choices;
      return;
    }

    if (field.special === 'semesterNumber') {
      this.loadSemesterNumbers(field);
      return;
    }

    if (!field.lookup) return;

    const values = this.form.getRawValue() as Record<string, unknown>;
    const query = field.lookupQuery ? field.lookupQuery(values) : {};

    if (query === null) {
      this.fieldOptions[field.name] = [];
      return;
    }

    const lookup = field.lookup;
    const exclude = field.exclude;
    const load = (skip: Set<unknown>) =>
      this.loadLookup(
        lookup,
        query,
        (options) => (this.fieldOptions[field.name] = options.filter((o) => !skip.has(o.value))),
      );

    if (!exclude) {
      load(new Set());
      return;
    }

    this.academics
      .list<Row>(exclude.resource, { page_size: 100, ...exclude.query(values) })
      .subscribe((page) => load(new Set(page.results.map(exclude.id))));
  }

  /** 1 to twice the program's years, without the numbers the program already has. */
  private loadSemesterNumbers(field: FieldConfig): void {
    const programId = Number(this.form.getRawValue()['program']);
    const program = (this.fieldOptions['program'] ?? this.lookups['programs'] ?? []).find(
      (item) => item.value === programId,
    );

    if (!programId) {
      this.fieldOptions[field.name] = [];
      return;
    }

    this.academics
      .list<Row>('semesters', { program: programId, page_size: 100 })
      .subscribe((page) => {
        const used = new Set(page.results.map((row) => row.semester_number));
        const years = program?.row?.duration_years ?? 5;

        this.fieldOptions[field.name] = Array.from({ length: years * 2 }, (_, index) => index + 1)
          .filter((number) => !used.has(number))
          .map((number) => ({ value: number, label: `Semester ${number}` }));
      });
  }

  /** What goes to the server: no helper fields, and on an edit no parent links. */
  private body(): Record<string, unknown> {
    const raw = this.form.getRawValue() as Record<string, unknown>;
    const body: Record<string, unknown> = {};

    for (const field of this.fields) {
      if (field.helper || this.isFixed(field)) continue;

      const value = raw[field.name];

      if (field.kind === 'number')
        body[field.name] = value === '' || value === null ? null : Number(value);
      else if (typeof value === 'string') body[field.name] = value.trim();
      else body[field.name] = value;
    }

    // A college administrator does not choose the college: their own is used.
    if (!this.editing && !this.platform && this.config.key === 'departments') {
      body['college'] = this.collegeId;
    }

    return body;
  }
}
