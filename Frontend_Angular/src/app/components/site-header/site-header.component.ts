import { Component, HostListener, Input } from '@angular/core';
import { AuthService } from '../../services/auth.service';

interface NavLink {
  path: string;
  label: string;
  icon: string;
  /** highlighted call-to-action button */
  cta?: boolean;
}

const NAV: Record<'public' | 'user' | 'admin', NavLink[]> = {
  public: [
    { path: '/index', label: 'Home', icon: 'bi-house' },
    { path: '/register', label: 'Sign Up', icon: 'bi-person-plus' },
    { path: '/login', label: 'Login', icon: 'bi-box-arrow-in-right', cta: true },
    { path: '/contact', label: 'Contact', icon: 'bi-envelope' }
  ],
  // patients: their own health data
  user: [
    { path: '/dashboard', label: 'Home', icon: 'bi-speedometer2' },
    { path: '/predict', label: 'New assessment', icon: 'bi-heart-pulse' },
    { path: '/history', label: 'My history', icon: 'bi-clock-history' },
    { path: '/login', label: 'Logout', icon: 'bi-box-arrow-right' }
  ],
  // administrators: the model's data, the users and the inbox
  admin: [
    { path: '/admindashboard', label: 'Overview', icon: 'bi-speedometer2' },
    { path: '/usermanagement', label: 'Users', icon: 'bi-people' },
    { path: '/dataloader', label: 'Training data', icon: 'bi-cloud-arrow-up' },
    { path: '/dataset', label: 'Records', icon: 'bi-table' },
    { path: '/messages', label: 'Messages', icon: 'bi-chat-dots' },
    { path: '/login', label: 'Logout', icon: 'bi-box-arrow-right' }
  ]
};

/** Fixed top bar shared by every page; collapses into a hamburger menu on phones. */
@Component({
  standalone: false,
  selector: 'app-site-header',
  templateUrl: './site-header.component.html',
  styleUrls: ['./site-header.component.css']
})
export class SiteHeaderComponent {
  @Input() variant: 'public' | 'user' | 'admin' = 'public';
  open = false;

  constructor(private auth: AuthService) {}

  get links(): NavLink[] {
    return NAV[this.variant];
  }

  /** signed-in person (not shown on public pages) */
  get name(): string {
    return this.variant === 'public' ? '' : this.auth.name;
  }

  get initials(): string {
    return this.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  toggle() {
    this.open = !this.open;
  }

  close() {
    this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close();
  }
}
