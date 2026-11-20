import { DOCUMENT, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

/** Small hover/focus tooltip attached to the body, so table overflow can't clip it. */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(mouseenter)': 'show()',
    '(focusin)': 'show()',
    '(mouseleave)': 'hide()',
    '(focusout)': 'hide()',
  },
})
export class TooltipDirective {
  readonly text = input<string | null | undefined>(null, { alias: 'appTooltip' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private tip?: HTMLElement;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  protected show(): void {
    const text = this.text();
    if (!text || this.tip) return;
    const tip = this.document.createElement('div');
    tip.className = 'app-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = text;
    this.document.body.appendChild(tip);
    this.tip = tip;

    const anchor = this.host.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const viewport = this.document.documentElement.clientWidth;
    const left = Math.min(
      Math.max(8, anchor.left + anchor.width / 2 - box.width / 2),
      viewport - box.width - 8,
    );
    const above = anchor.top - box.height - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${above >= 8 ? above : anchor.bottom + 8}px`;
  }

  protected hide(): void {
    this.tip?.remove();
    this.tip = undefined;
  }
}
