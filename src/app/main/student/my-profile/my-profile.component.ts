import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { StudentProfile } from 'src/app/api/models';
import { StudentsService } from 'src/app/api/services';
import { CollegeSummary } from 'src/app/auth/models';
import { AuthService } from 'src/app/auth/services';
import { GlobalException } from 'src/app/core/exceptions';

/** ST3: a student's own details. Read only: only an administrator can correct them. */
@Component({
  selector: 'app-my-profile',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './my-profile.component.html',
  styleUrls: ['./my-profile.component.scss'],
})
export class MyProfileComponent implements OnInit {
  profile: StudentProfile | null = null;
  college: CollegeSummary | null = null;
  loading = false;
  error = '';

  constructor(
    private students: StudentsService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.auth.user?.student_profile_public_id;
    this.college = this.auth.user?.college ?? null;

    if (!id) {
      this.error = 'Your account has no student profile. Ask your college administrator.';
      return;
    }

    this.loading = true;
    this.error = '';

    this.students.get(id).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.loading = false;
      },
      error: (error: GlobalException) => {
        this.loading = false;
        this.error = error.message;
      },
    });
  }
}
