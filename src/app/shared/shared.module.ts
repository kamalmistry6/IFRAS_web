import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthModule } from '../auth/auth.module';
import { ComingSoonComponent } from './components/coming-soon';
import { TimeSelectComponent } from './components/time-select/time-select.component';
import { FormErrorPipe } from './pipes';

const COMPONENTS = [ComingSoonComponent, TimeSelectComponent];
const PIPES = [FormErrorPipe];

/**
 * What every feature module needs: Angular's common and forms modules, the
 * router directives, the appAuthorize directive, and a few pipes.
 *
 * There are no wrapper components for buttons, fields or cards. They are CSS
 * classes (src/styles/): class="btn btn-primary", class="card", class="input-group".
 *
 * Import it in every feature module:
 *   @NgModule({ imports: [SharedModule, MyRoutingModule], declarations: [...] })
 */
@NgModule({
  declarations: [...COMPONENTS, ...PIPES],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, AuthModule],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    AuthModule,
    ...COMPONENTS,
    ...PIPES,
  ],
})
export class SharedModule {}
