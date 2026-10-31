import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { College, StudentImportResult, StudentImportRow } from 'src/app/api/models';
import { StudentsService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';

/** The largest file the server takes, and the most students in one file. Keep in step with the API. */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 100;

type Step = 'choose' | 'checked' | 'done';

/**
 * Adds many students from a spreadsheet: choose the file, check it, then import.
 *
 *   <app-student-import-dialog [colleges]="colleges" [mustChooseCollege]="true"
 *     (imported)="reload()" (closed)="showImport = false"></app-student-import-dialog>
 *
 * Students only are created (nobody is enrolled), and the first password is the roll number.
 */
@Component({
  selector: 'app-student-import-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './student-import-dialog.component.html',
  styleUrls: ['./student-import-dialog.component.scss'],
})
export class StudentImportDialogComponent {
  /** The colleges to choose from, for a platform administrator. */
  @Input() colleges: College[] = [];
  /** A platform administrator chooses the college; a college administrator's own is used. */
  @Input() mustChooseCollege = false;

  /** Some students were created: the list behind the dialog should load again. */
  @Output() imported = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  readonly maxRows = IMPORT_MAX_ROWS;

  step: Step = 'choose';
  file: File | null = null;
  college: number | null = null;
  working = false;
  downloading = false;
  /** Why the file or the college cannot be used yet, or what the server refused. */
  error = '';
  result: StudentImportResult | null = null;

  constructor(private students: StudentsService) {}

  /** Rows that need the admin's attention; the fine ones are only counted. */
  get problems(): StudentImportRow[] {
    return (this.result?.rows ?? []).filter(
      (row) => row.status === 'skipped' || row.status === 'error',
    );
  }

  get canCheck(): boolean {
    return !!this.file && (!this.mustChooseCollege || !!this.college) && !this.working;
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.close();
  }

  close(): void {
    if (this.working) return;
    this.closed.emit();
  }

  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;

    this.error = '';
    this.result = null;
    this.step = 'choose';
    this.file = null;

    if (!file) return;

    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      this.error = 'Choose an Excel file (.xlsx or .xls) or a .csv file.';
      input.value = '';
      return;
    }
    if (file.size > IMPORT_MAX_BYTES) {
      this.error = 'The file is larger than 2 MB.';
      input.value = '';
      return;
    }

    this.file = file;
  }

  downloadTemplate(): void {
    if (this.downloading) return;
    this.downloading = true;
    this.error = '';

    this.students.importTemplate().subscribe({
      next: (blob) => {
        this.downloading = false;
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = 'students-template.xlsx';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error: GlobalException) => {
        this.downloading = false;
        this.error = error.message;
      },
    });
  }

  /** Reads the file on the server and reports every row, creating nothing. */
  check(): void {
    this.run(true);
  }

  /** Creates the students the check found fine. */
  confirm(): void {
    this.run(false);
  }

  /** Back to choosing a file. */
  again(): void {
    this.step = 'choose';
    this.result = null;
    this.file = null;
    this.error = '';
  }

  statusLabel(row: StudentImportRow): string {
    return row.status === 'skipped' ? 'Skipped' : 'Error';
  }

  private run(dryRun: boolean): void {
    if (!this.file || this.working) return;

    this.working = true;
    this.error = '';

    this.students.importStudents(this.file, dryRun, this.college).subscribe({
      next: (result) => {
        this.working = false;
        this.result = result;
        this.step = dryRun ? 'checked' : 'done';
        if (!dryRun && result.created > 0) this.imported.emit();
      },
      error: (error: GlobalException) => {
        this.working = false;
        // {"file": [...]} and {"college": [...]} arrive as field errors.
        this.error =
          error.fieldErrors['file']?.[0] ?? error.fieldErrors['college']?.[0] ?? error.message;
      },
    });
  }
}
