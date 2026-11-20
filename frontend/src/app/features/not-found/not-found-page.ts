import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card empty">
      <app-icon name="search" [size]="28" />
      <h3>Page not found</h3>
      <p>The page you are looking for doesn't exist.</p>
      <a routerLink="/" class="btn btn-sm">Back to the dashboard</a>
    </section>
  `,
})
export class NotFoundPage {}
