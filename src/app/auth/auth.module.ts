import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AuthorizeDirective } from './directives';

/**
 * The authorization directive. SharedModule re-exports this module, so feature
 * modules get `appAuthorize` just by importing SharedModule.
 *
 * It must not import SharedModule (that would be a circular import).
 * The login screen lives in its own lazy module: auth/login/login.module.ts.
 */
@NgModule({
  declarations: [AuthorizeDirective],
  imports: [CommonModule],
  exports: [AuthorizeDirective],
})
export class AuthModule {}
