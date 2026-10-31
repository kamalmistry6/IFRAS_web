import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { StudentImportResult } from 'src/app/api/models';
import { StudentsService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { AdminModule } from '../admin.module';
import { StudentImportDialogComponent } from './student-import-dialog.component';

const result = (overrides: Partial<StudentImportResult> = {}): StudentImportResult => ({
  dry_run: true,
  total: 4,
  created: 2,
  skipped: 1,
  failed: 1,
  rows: [
    { row: 2, username: '101', name: 'Asha Rao', status: 'ready', message: '' },
    { row: 3, username: '102', name: 'Ravi Kumar', status: 'ready', message: '' },
    {
      row: 4,
      username: 'student_a',
      name: 'Old Name',
      status: 'skipped',
      message: 'The username already exists.',
    },
    {
      row: 5,
      username: '104',
      name: 'Bad Mail',
      status: 'error',
      message: 'email: Enter a valid email address.',
    },
  ],
  ...overrides,
});

const pick = (name: string, size = 1000): Event => {
  const file = new File(['x'], name);
  Object.defineProperty(file, 'size', { value: size });
  const input = document.createElement('input');
  Object.defineProperty(input, 'files', { value: { item: () => file } });
  return { target: input } as unknown as Event;
};

describe('StudentImportDialogComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  function create(mustChooseCollege = false) {
    api = {
      importStudents: vi.fn().mockReturnValue(of(result())),
      importTemplate: vi.fn().mockReturnValue(of(new Blob(['x']))),
    };
    TestBed.configureTestingModule({
      imports: [AdminModule],
      providers: [{ provide: StudentsService, useValue: api }],
    });
    const fixture = TestBed.createComponent(StudentImportDialogComponent);
    const component = fixture.componentInstance;
    component.mustChooseCollege = mustChooseCollege;
    component.colleges = [{ id: 5, name: 'College Five' } as never];
    fixture.detectChanges();
    return { fixture, component, element: fixture.nativeElement as HTMLElement };
  }

  describe('choosing the file', () => {
    it('accepts Excel and csv files and enables the check', () => {
      const { component } = create();
      expect(component.canCheck).toBe(false);

      for (const name of ['a.xlsx', 'b.XLS', 'c.csv']) {
        component.choose(pick(name));
        expect(component.file?.name).toBe(name);
        expect(component.error).toBe('');
      }
      expect(component.canCheck).toBe(true);
    });

    it('refuses other files and files over 2 MB', () => {
      const { component } = create();

      component.choose(pick('notes.pdf'));
      expect(component.file).toBeNull();
      expect(component.error).toContain('Excel file');

      component.choose(pick('big.xlsx', 3 * 1024 * 1024));
      expect(component.file).toBeNull();
      expect(component.error).toContain('2 MB');
    });

    it('makes a platform administrator choose the college first', () => {
      const { component } = create(true);
      component.choose(pick('a.csv'));
      expect(component.canCheck).toBe(false);

      component.college = 5;

      expect(component.canCheck).toBe(true);
    });
  });

  describe('checking and importing', () => {
    it('checks without creating, then lists only the rows that need attention', () => {
      const { fixture, component, element } = create();
      component.choose(pick('students.csv'));

      component.check();
      fixture.detectChanges();

      expect(api['importStudents']).toHaveBeenCalledWith(component.file, true, null);
      expect(component.step).toBe('checked');
      expect(component.problems.map((row) => row.row)).toEqual([4, 5]);
      const text = element.textContent ?? '';
      expect(text).toContain('2 ready');
      expect(text).toContain('1 skipped');
      expect(text).toContain('The username already exists.');
      expect(text).toContain('Import 2 students');
    });

    it('imports after the check, tells the page, and shows the outcome', () => {
      const { fixture, component, element } = create(true);
      const imported = vi.fn();
      component.imported.subscribe(imported);
      component.college = 5;
      component.choose(pick('students.csv'));
      component.check();
      api['importStudents'].mockReturnValue(of(result({ dry_run: false })));

      component.confirm();
      fixture.detectChanges();

      expect(api['importStudents']).toHaveBeenLastCalledWith(component.file, false, 5);
      expect(component.step).toBe('done');
      expect(imported).toHaveBeenCalledTimes(1);
      expect(element.textContent).toContain('2 students were created');
    });

    it('does not tell the page when nothing was created', () => {
      const { component } = create();
      const imported = vi.fn();
      component.imported.subscribe(imported);
      component.choose(pick('students.csv'));
      api['importStudents'].mockReturnValue(of(result({ dry_run: false, created: 0, skipped: 4 })));

      component.confirm();

      expect(imported).not.toHaveBeenCalled();
    });

    it('cannot import when the check found nothing to create', () => {
      const { fixture, component, element } = create();
      component.choose(pick('students.csv'));
      api['importStudents'].mockReturnValue(of(result({ created: 0, skipped: 4, failed: 0 })));

      component.check();
      fixture.detectChanges();

      const confirm = [...element.querySelectorAll('.modal-footer button')].find((button) =>
        button.textContent?.includes('Import'),
      ) as HTMLButtonElement;
      expect(confirm.disabled).toBe(true);
      expect(element.textContent).toContain('No student can be created');
    });

    it('shows what the server refused and stays on the same step', () => {
      const { component } = create();
      component.choose(pick('students.csv'));
      api['importStudents'].mockReturnValue(
        throwError(
          () =>
            new GlobalException({
              status: 400,
              message: 'The first row must have these columns.',
              fieldErrors: { file: ['The first row must have these columns.'] },
            }),
        ),
      );

      component.check();

      expect(component.error).toBe('The first row must have these columns.');
      expect(component.step).toBe('choose');
      expect(component.working).toBe(false);
    });

    it('sends nothing twice while it is working', () => {
      const { component } = create();
      component.choose(pick('students.csv'));
      component.working = true;

      component.check();

      expect(api['importStudents']).not.toHaveBeenCalled();
    });

    it('goes back to choosing another file', () => {
      const { component } = create();
      component.choose(pick('students.csv'));
      component.check();

      component.again();

      expect(component.step).toBe('choose');
      expect(component.file).toBeNull();
      expect(component.result).toBeNull();
    });
  });

  describe('the template', () => {
    it('downloads the Excel template as a file', () => {
      const { component } = create();
      const create$ = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
      const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);

      component.downloadTemplate();

      expect(api['importTemplate']).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(revoke).toHaveBeenCalledWith('blob:x');
      expect(component.downloading).toBe(false);

      create$.mockRestore();
      revoke.mockRestore();
      click.mockRestore();
    });

    it('says so when the template cannot be downloaded', () => {
      const { component } = create();
      api['importTemplate'].mockReturnValue(
        throwError(() => new GlobalException({ status: 500, message: 'Server error.' })),
      );

      component.downloadTemplate();

      expect(component.error).toBe('Server error.');
      expect(component.downloading).toBe(false);
    });
  });

  it('closes from the Close button and from Escape, but not while working', () => {
    const { component } = create();
    const closed = vi.fn();
    component.closed.subscribe(closed);

    component.close();
    component.closeOnEscape();
    expect(closed).toHaveBeenCalledTimes(2);

    component.working = true;
    component.close();
    expect(closed).toHaveBeenCalledTimes(2);
  });
});
