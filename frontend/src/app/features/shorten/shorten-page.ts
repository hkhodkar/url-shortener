import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { LinksApi } from '../../core/api/links.api';
import { Link } from '../../core/models/link.models';
import { endOfDayIso, toDateInput } from '../../core/utils/format';
import {
  aliasAvailableValidator,
  aliasFormatValidator,
} from '../../core/validators/alias.validator';
import { ALIAS_MAX_LENGTH, ALIAS_MIN_LENGTH } from '../../core/validators/alias-rules';
import { notPastDayValidator } from '../../core/validators/date.validator';
import { httpUrlValidator } from '../../core/validators/url.validator';
import { Icon } from '../../shared/ui/icon';
import { LinkResult } from './link-result';

@Component({
  selector: 'app-shorten-page',
  imports: [ReactiveFormsModule, Icon, LinkResult],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shorten-page.html',
  styleUrl: './shorten-page.scss',
})
export class ShortenPage {
  private readonly api = inject(LinksApi);

  protected readonly minAlias = ALIAS_MIN_LENGTH;
  protected readonly maxAlias = ALIAS_MAX_LENGTH;
  protected readonly today = toDateInput(new Date());

  protected readonly form = new FormGroup({
    target_url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2048), httpUrlValidator],
    }),
    alias: new FormControl('', {
      nonNullable: true,
      validators: [aliasFormatValidator],
      asyncValidators: [aliasAvailableValidator((alias) => this.api.checkAlias(alias))],
    }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    expires_on: new FormControl('', { nonNullable: true, validators: [notPastDayValidator] }),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly created = signal<Link | null>(null);

  private readonly meta = toSignal(this.api.meta().pipe(catchError(() => of(null))));
  /** "sho.rt/" in front of the alias field. */
  protected readonly prefix = computed(() => {
    const base = this.meta()?.short_base_url;
    return base ? `${base.replace(/^https?:\/\//, '')}/` : '…/';
  });
  /** Shorter form for phones: only the last path segment, "…/r/". */
  protected readonly shortPrefix = computed(() => {
    const prefix = this.prefix();
    const parts = prefix.split('/').filter(Boolean);
    return parts.length > 1 ? `…/${parts.at(-1)}/` : prefix;
  });

  // every value, status or reset event of the alias control, so the hint follows the async check
  private readonly aliasEvents = toSignal(this.form.controls.alias.events);
  protected readonly aliasState = computed(() => {
    this.aliasEvents();
    const control = this.form.controls.alias;
    const value = control.value.trim();
    if (!value) return 'empty';
    if (control.pending) return 'checking';
    return control.valid ? 'available' : 'invalid';
  });

  protected aliasMessage(): string {
    const errors = this.form.controls.alias.errors;
    return (errors?.['alias'] ?? errors?.['aliasTaken'] ?? '') as string;
  }

  protected showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  protected submit(): void {
    if (this.form.invalid || this.form.pending) {
      this.form.markAllAsTouched();
      return;
    }
    const { target_url, alias, title, expires_on } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .create({
        target_url: target_url.trim(),
        alias: alias.trim() || null,
        title: title.trim() || null,
        expires_at: expires_on ? endOfDayIso(expires_on) : null,
      })
      .subscribe({
        next: (link) => {
          this.saving.set(false);
          this.created.set(link);
          this.form.reset();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.form.controls.alias.setErrors({ aliasTaken: apiErrorMessage(error) });
            this.form.controls.alias.markAsTouched();
          } else {
            this.error.set(apiErrorMessage(error));
          }
        },
      });
  }

  protected startOver(): void {
    this.created.set(null);
  }
}
