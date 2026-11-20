import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DemoMode } from '../core/mock/demo-mode';
import { ThemeService } from '../core/services/theme.service';
import { DemoBanner } from '../shared/ui/demo-banner';
import { Icon } from '../shared/ui/icon';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, DemoBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  protected readonly demo = inject(DemoMode);

  protected toggleTheme(): void {
    this.theme.toggle();
  }
}
