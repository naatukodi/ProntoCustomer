// header.ts
import { Component, ViewChild, inject, OnInit, OnDestroy } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared/shared.module/shared.module';

import { Auth, authState, User } from '@angular/fire/auth';
import { Observable, of, Subject } from 'rxjs';
import { map, switchMap, shareReplay, takeUntil } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { AuthorizationService } from '../../services/authorization.service';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SharedModule
  ],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  @ViewChild('drawer') drawer!: MatSidenav;

  private bp = inject(BreakpointObserver);
  private auth = inject(Auth);
  private usersSvc = inject(UsersService);
  private destroy$ = new Subject<void>();

  authSvc = inject(AuthService);
  authzSvc1 = inject(AuthorizationService);

  isHandset$: Observable<boolean> = this.bp
    .observe(['(max-width: 768px)'])
    .pipe(
      map(r => r.matches),
      shareReplay(1)
    );

  /** Firebase auth user */
  user$: Observable<User | null> = authState(this.auth).pipe(
    shareReplay(1)
  );

  /** Display name from API or Firebase fallback */
  userName$: Observable<string> = this.user$.pipe(
    switchMap(u => {
      if (!u) return of('');
      const id = this.resolveId(u);
      if (!id) return of(this.fallbackName(u));
      return this.usersSvc.getById(id).pipe(
        map(m => (m?.name?.trim() || this.fallbackName(u))),
        takeUntil(this.destroy$)
      );
    }),
    shareReplay(1)
  );

  /** Roles from backend */
  roles$: Observable<string[]> = this.user$.pipe(
    switchMap(u => {
      if (!u) return of<string[]>([]);
      const phone = u.phoneNumber ?? '';
      return phone ? this.usersSvc.getRoles(phone) : of<string[]>([]);
    }),
    shareReplay(1),
    takeUntil(this.destroy$)
  );

  /** Derived flags - Admin check */
  isAdmin$: Observable<boolean> = this.roles$.pipe(
    map(roles => roles.includes('Admin') || roles.some(r => r === 'Admin')),
    shareReplay(1)
  );

  /** Stakeholder permission check */
  canEditStakeholder$: Observable<boolean> = this.roles$.pipe(
    map(roles => 
      roles.includes('CanEditStakeholder') || 
      roles.includes('CanCreateStakeholder') ||
      roles.includes('Admin')
    ),
    shareReplay(1)
  );

  ngOnInit(): void {
    // Initialize component
  }

  /**
   * Handle logout
   */
  onLogout(): void {
    if (confirm('Are you sure you want to logout?')) {
      this.authSvc.logout();
      this.authzSvc1.clearPermissions();
    }
  }

  /**
   * Cleanup on destroy
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Prefer phoneNumber, then uid, then email */
  private resolveId(u: User): string | null {
    return u.phoneNumber ?? u.uid ?? u.email ?? null;
  }

  private fallbackName(u: User): string {
    return u.displayName || u.email || u.phoneNumber || '';
  }
}