import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AttendanceSessionDetail } from 'src/app/api/models';
import { AttendanceService } from 'src/app/api/services';
import { GlobalException } from 'src/app/core/exceptions';
import { ConfirmService, ToastService } from 'src/app/core/services';
import { UserType } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { AttendanceModule } from '../attendance.module';
import { TakeAttendanceComponent } from './take-attendance.component';

function makeSession(status: 'OPEN' | 'SUBMITTED' | 'CANCELLED' = 'OPEN'): AttendanceSessionDetail {
  return {
    public_id: 'sess-1',
    subject_name: 'Data Structures',
    subject_code: 'CS201',
    date: '2026-10-29',
    start_time: '09:00:00',
    end_time: '10:00:00',
    status,
    total_students: 2,
    present_count: 0,
    absent_count: 2,
    cancellation_reason: '',
    records: [
      { public_id: 'r1', student_name: 'Aarav Sharma', roll_number: '1', status: 'ABSENT' },
      { public_id: 'r2', student_name: 'Diya Nair', roll_number: '2', status: 'ABSENT' },
    ],
  } as unknown as AttendanceSessionDetail;
}

describe('TakeAttendanceComponent', () => {
  let attendance: Record<string, ReturnType<typeof vi.fn>>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirm: { confirm: ReturnType<typeof vi.fn> };

  function create(
    status: 'OPEN' | 'SUBMITTED' | 'CANCELLED' = 'OPEN',
    userType: UserType = UserType.TEACHER,
  ) {
    attendance = {
      session: vi.fn().mockReturnValue(of(makeSession(status))),
      markRecords: vi.fn().mockImplementation((_id, records) => {
        const updated = makeSession();
        updated.present_count = records.filter(
          (r: { status: string }) => r.status === 'PRESENT',
        ).length;
        updated.absent_count = 2 - updated.present_count;
        return of(updated);
      }),
      submit: vi.fn().mockReturnValue(of(makeSession('SUBMITTED'))),
      cancel: vi.fn().mockReturnValue(of(makeSession('CANCELLED'))),
      corrections: vi
        .fn()
        .mockReturnValue(of({ count: 0, next: null, previous: null, results: [] })),
      correct: vi.fn().mockReturnValue(of({})),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    confirm = { confirm: vi.fn().mockReturnValue(of(true)) };

    TestBed.configureTestingModule({
      imports: [AttendanceModule],
      providers: [
        provideRouter([]),
        { provide: AttendanceService, useValue: attendance },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
        { provide: AuthService, useValue: { userType } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'sess-1' }) } },
        },
      ],
    });

    const fixture = TestBed.createComponent(TakeAttendanceComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      element: fixture.nativeElement as HTMLElement,
    };
  }

  it('lists the students with Present and Absent buttons while the session is open', () => {
    const { element } = create();

    expect(element.textContent).toContain('Aarav Sharma');
    expect(element.querySelectorAll('.segmented').length).toBe(2);
    expect(element.textContent).toContain('Submit');
  });

  it('saves only the student that was changed', () => {
    const { element, fixture } = create();

    element.querySelector<HTMLButtonElement>('.segmented .present')!.click();
    fixture.detectChanges();

    expect(attendance['markRecords']).toHaveBeenCalledWith('sess-1', [
      { public_id: 'r1', status: 'PRESENT' },
    ]);
    expect(fixture.componentInstance.session!.present_count).toBe(1);
    expect(fixture.componentInstance.session!.records[0].status).toBe('PRESENT');
  });

  it('does nothing when the status is already the one that was tapped', () => {
    const { element } = create();

    element.querySelector<HTMLButtonElement>('.segmented .absent')!.click();

    expect(attendance['markRecords']).not.toHaveBeenCalled();
  });

  it('puts the old mark back when saving fails', () => {
    const { component } = create();
    attendance['markRecords'].mockReturnValue(
      throwError(() => new GlobalException({ status: 0, message: 'offline' })),
    );

    component.setStatus(component.session!.records[0], 'PRESENT');

    expect(component.session!.records[0].status).toBe('ABSENT');
    expect(component.saving).toBe(0);
  });

  it('marks everyone present with one call for the students not yet present', () => {
    const { component } = create();

    component.markAllPresent();

    expect(attendance['markRecords']).toHaveBeenCalledWith('sess-1', [
      { public_id: 'r1', status: 'PRESENT' },
      { public_id: 'r2', status: 'PRESENT' },
    ]);
  });

  it('asks before submitting, then locks the session', () => {
    const { component } = create();

    component.submit();

    expect(confirm.confirm).toHaveBeenCalled();
    expect(attendance['submit']).toHaveBeenCalledWith('sess-1');
    expect(component.isSubmitted).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Attendance submitted');
  });

  it('does not submit when the teacher declines', () => {
    const { component } = create();
    confirm.confirm.mockReturnValue(of(false));

    component.submit();

    expect(attendance['submit']).not.toHaveBeenCalled();
  });

  it('needs a reason to cancel the lecture', () => {
    const { component } = create();

    component.cancelReason = '   ';
    component.cancelLecture();
    expect(attendance['cancel']).not.toHaveBeenCalled();

    component.cancelReason = 'Teacher on leave';
    component.cancelLecture();
    expect(attendance['cancel']).toHaveBeenCalledWith('sess-1', 'Teacher on leave');
    expect(component.isCancelled).toBe(true);
  });

  it('is read-only once submitted, with a Correct button per student', () => {
    const { element } = create('SUBMITTED');

    expect(element.querySelectorAll('.segmented').length).toBe(0);
    expect(element.textContent).toContain('Correct');
    expect(attendance['corrections']).toHaveBeenCalledWith('sess-1');
  });

  it('corrects a student to the opposite status with a reason', () => {
    const { component } = create('SUBMITTED');
    const record = component.session!.records[0];

    component.openCorrection(record);
    component.correctionReason = 'Was in class';
    component.saveCorrection();

    expect(attendance['correct']).toHaveBeenCalledWith('sess-1', {
      record: 'r1',
      status: 'PRESENT',
      reason: 'Was in class',
    });
    expect(component.correcting).toBeNull();
  });

  it('offers no actions on a cancelled lecture and shows why it was cancelled', () => {
    const { element, component, fixture } = create('CANCELLED');
    component.session!.cancellation_reason = 'Holiday';
    fixture.detectChanges();

    expect(component.isCancelled).toBe(true);
    expect(element.textContent).toContain('Holiday');
    expect(element.textContent).not.toContain('Submit');
  });

  describe('the redesigned page', () => {
    it('filters the list by search text and by the Present and Absent chips', () => {
      const { component } = create();
      component.session!.records[0].status = 'PRESENT';

      expect(component.visibleRecords.length).toBe(2);

      component.search = 'diya';
      expect(component.visibleRecords.map((r) => r.roll_number)).toEqual(['2']);

      component.search = '';
      component.filter = 'PRESENT';
      expect(component.visibleRecords.map((r) => r.roll_number)).toEqual(['1']);

      component.filter = 'ABSENT';
      expect(component.visibleRecords.map((r) => r.roll_number)).toEqual(['2']);
    });

    it('also finds a student by roll number', () => {
      const { component } = create();

      component.search = '2';

      expect(component.visibleRecords.map((r) => r.student_name)).toEqual(['Diya Nair']);
    });

    it('works out the counts and the percentage from the list', () => {
      const { component } = create();
      component.session!.records[0].status = 'PRESENT';

      expect(component.counts).toEqual({ all: 2, present: 1, absent: 1 });
      expect(component.percentPresent).toBe(50);
    });

    it('shows the counts in the banner and on the chips', () => {
      const { element, fixture, component } = create();
      component.setStatus(component.session!.records[0], 'PRESENT');
      fixture.detectChanges();

      expect(element.querySelector('.page-banner .stats')?.textContent).toContain('Present');
      expect(element.querySelector('.chips')?.textContent).toContain('Present 1');
      expect(element.querySelector('.meter span')?.getAttribute('style')).toContain('50%');
    });

    it('keeps Submit in an action bar while the session is open', () => {
      const { element } = create();

      expect(element.querySelector('.action-bar')?.textContent).toContain('Submit attendance');
    });

    it('tells who marked it once, not on every row, once submitted', () => {
      const { element, fixture, component } = create('SUBMITTED');
      component.session!.records.forEach((r) => (r.marked_by_name = 'Amit Patil'));
      fixture.detectChanges();

      expect(component.markedBy).toBe('Amit Patil');
      expect(element.querySelector('.note')?.textContent).toContain('Marked by Amit Patil');
      expect(element.querySelector('.action-bar')).toBeNull();
      expect(element.querySelectorAll('.student .btn').length).toBe(2);
    });

    it('says when nothing matches the search', () => {
      const { element, fixture, component } = create();

      component.search = 'zzz';
      fixture.detectChanges();

      expect(element.querySelector('.empty')?.textContent).toContain('No students match');
    });
  });

  describe('Back', () => {
    it('falls back to Today for a teacher and to Sessions for an administrator', () => {
      expect(create('OPEN', UserType.TEACHER).component.backLink).toBe('/teacher/today');

      TestBed.resetTestingModule();
      expect(create('OPEN', UserType.ADMIN).component.backLink).toBe('/admin/sessions');
    });
  });
});
