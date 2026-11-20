import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { toCanvas, toDataURL } from 'qrcode';
import { Icon } from './icon';

const COLORS = { dark: '#161b2e', light: '#ffffff' };

/** QR code drawn in the browser, with a PNG download. */
@Component({
  selector: 'app-qr-code',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame">
      <canvas #canvas role="img" [attr.aria-label]="'QR code for ' + value()"></canvas>
    </div>
    @if (downloadable()) {
      <button type="button" class="btn btn-sm" (click)="download()">
        <app-icon name="download" [size]="16" />
        Download PNG
      </button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .frame {
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #fff;
      line-height: 0;
    }

    canvas {
      display: block;
      max-width: 100%;
      height: auto !important;
    }
  `,
})
export class QrCode {
  readonly value = input.required<string>();
  readonly size = input(168);
  readonly fileName = input('qr-code');
  readonly downloadable = input(true);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  protected readonly safeName = computed(() => this.fileName().replace(/[^\w-]+/g, '-'));

  constructor() {
    effect(() => {
      const canvas = this.canvas().nativeElement;
      toCanvas(canvas, this.value(), { width: this.size(), margin: 1, color: COLORS }).catch(
        () => undefined,
      );
    });
  }

  protected async download(): Promise<void> {
    // a bigger image than the preview, so it stays sharp in print
    const url = await toDataURL(this.value(), { width: 1024, margin: 2, color: COLORS });
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.safeName()}.png`;
    link.click();
  }
}
