import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { SiteHeaderComponent } from './site-header.component';

describe('SiteHeaderComponent', () => {
  let fixture: ComponentFixture<SiteHeaderComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [SiteHeaderComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SiteHeaderComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  const labels = () => Array.from(el.querySelectorAll('nav a')).map((a) => a.textContent?.trim());

  it('shows the public menu by default', () => {
    expect(labels()).toEqual(['Home', 'Sign Up', 'Login', 'Contact']);
  });

  it('shows the patient and admin menus', () => {
    fixture.componentInstance.variant = 'user';
    fixture.detectChanges();
    expect(labels()).toEqual(['Home', 'New assessment', 'My history', 'Logout']);

    fixture.componentInstance.variant = 'admin';
    fixture.detectChanges();
    expect(labels()).toEqual(['Overview', 'Users', 'Training data', 'Records', 'Messages', 'Logout']);
  });

  it('toggles the mobile menu with the hamburger button and closes on Escape', () => {
    const nav = el.querySelector('nav') as HTMLElement;
    const button = el.querySelector('.menu-btn') as HTMLButtonElement;

    expect(nav.classList.contains('open')).toBeFalse();
    button.click();
    fixture.detectChanges();
    expect(nav.classList.contains('open')).toBeTrue();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(nav.classList.contains('open')).toBeFalse();
  });
});
