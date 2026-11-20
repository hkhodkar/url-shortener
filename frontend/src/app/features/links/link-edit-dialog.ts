import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiErrorMessage } from '../../core/api/api-error';
import { LinksApi } from '../../core/api/links.api';
import { Link, LinkUpdate } from '../../core/models/link.models';
import { displayUrl, endOfDayIso, formatDate, toDateInput } from '../../core/utils/format';
import { notPastDayValidator } from '../../core/validators/date.validator';
import { httpUrlValidator } from '../../core/validators/url.validator';
import { Modal } from '../../shared/ui/modal';

/** Edit title, destination, expiry and the on/off switch of a link. */
@Component({
  selector: 'app-link-edit-dialog',
  imports: [ReactiveFormsModule, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-edit-dialog.html',
  styles: `
    .short {
      margin-bottom: 20px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      background: var(--surface-muted);
      color: var(--text-muted);
      font-size: 13px;
      overflow-wrap: anywhere;

      strong {
        color: var(--text);
        font-weight: 600;
      }
    }

    .date-row {
      display: flex;
      gap: 8px;

      .input {
        flex: 1;
        min-width: 0;
      }
    }

    .switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);

      .desc {
        display: block;
        color: var(--text-muted);
        font-size: 13px;
      }

      strong {
        display: block;
        font-weight: 500;
      }
    }

    .form-error {
      margin-top: 18px;
    }
  `,
})
export class LinkEditDialog implements OnInit {
  readonly link = input.required<Link>();
  readonly saved = output<Link>();
  readonly closed = output<void>();

  private readonly api = inject(LinksApi);

  protected readonly form = new FormGroup({
    target_url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2048), httpUrlValidator],
    }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    expires_on: new FormControl('', { nonNullable: true, validators: [notPastDayValidator] }),
    is_active: new FormControl(true, { nonNullable: true }),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly today = toDateInput(new Date());
  protected readonly displayUrl = displayUrl;
  protected readonly formatDate = formatDate;

  ngOnInit(): void {
    const link = this.link();
    this.form.reset({
      target_url: link.target_url,
      title: link.title ?? '',
      expires_on: toDateInput(link.expires_at),
      is_active: link.is_active,
    });
  }

  protected clearExpiry(): void {
    const control = this.form.controls.expires_on;
    control.setValue('');
    control.markAsDirty();
  }

  protected showError(name: 'target_url' | 'expires_on'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { controls } = this.form;
    // only send what changed, an untouched past expiry date must not be re-validated
    const changes: LinkUpdate = {};
    if (controls.target_url.dirty) changes.target_url = controls.target_url.value.trim();
    if (controls.title.dirty) changes.title = controls.title.value.trim() || null;
    if (controls.expires_on.dirty) {
      changes.expires_at = controls.expires_on.value ? endOfDayIso(controls.expires_on.value) : null;
    }
    if (controls.is_active.dirty) changes.is_active = controls.is_active.value;

    if (!Object.keys(changes).length) {
      this.closed.emit();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.update(this.link().code, changes).subscribe({
      next: (link) => {
        this.saving.set(false);
        this.saved.emit(link);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }
}
