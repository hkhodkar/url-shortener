import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Modal } from './modal';

@Component({
  imports: [Modal],
  template: `<app-modal title="Test" (closed)="onClosed()"><input /></app-modal>`,
})
class Host {
  closedCount = 0;

  onClosed(): void {
    this.closedCount++;
  }
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return {
    host: fixture.componentInstance,
    backdrop: el.querySelector('.backdrop') as HTMLElement,
    input: el.querySelector('input') as HTMLInputElement,
  };
}

describe('Modal', () => {
  it('closes on a click on the backdrop', () => {
    const { host, backdrop } = setup();
    backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.closedCount).toBe(1);
  });

  it('stays open when a drag starts in an input and ends on the backdrop', () => {
    const { host, backdrop, input } = setup();
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.closedCount).toBe(0);
  });

  it('closes on Escape', () => {
    const { host } = setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.closedCount).toBe(1);
  });
});
