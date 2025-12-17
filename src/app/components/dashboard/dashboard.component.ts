import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { from, of, EMPTY, Observable } from 'rxjs';
import { catchError, finalize, switchMap, take, timeout } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';

// Angular Material Imports
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';

// Services
import { ClaimService } from '../../services/claim.service';
import { UsersService } from '../../services/users.service';
import { AuthorizationService } from '../../services/authorization.service';
import { AuthService } from '../../services/auth.service';

// Models
import { WFValuation } from '../../models/valuation.model';
import { UserModel } from '../../models/user.model';

// Shared
import { SharedModule } from '../shared/shared.module/shared.module';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    SharedModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatDatepickerModule,
    MatInputModule,
    MatNativeDateModule,
    FormsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  // Data State
  claims: WFValuation[] = [];
  filteredClaims: WFValuation[] = [];
  loading = true;
  error: string | null = null;
  currentUser: UserModel | null = null;

  // --- Date Filter State (New Logic) ---
  filterMode: 'month' | 'week' | 'day' | null = null;
  filterStartDate: Date | null = null;
  filterEndDate: Date | null = null;
  displayDateLabel = '';

  // Configuration
  steps: string[] = ['Stakeholder', 'BackEnd', 'AVO', 'QC', 'FinalReport'];
  statuses = ['Open', 'InProgress', 'Inspection Completed', 'Rejected'];
  selectedStatus = '';

  displayedColumns = [
    'vehicleNumber',
    'assignedTo',
    'phone',
    'location',
    'createdAt',
    'age',
    'redFlag',
    'applicant',
    'info',
    'currentStep',
    'status',
    'action'
  ];

  private readonly noAssignmentExemptRoles = ['Admin', 'StateAdmin', 'SuperAdmin'];

  constructor(
    private claimService: ClaimService,
    private userService: UsersService,
    private router: Router,
    private authz: AuthorizationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loading = true;

    from(this.authService.getCurrentUser())
      .pipe(
        timeout(8000),
        catchError(() => of(null)),
        switchMap((fbUser: any) => {
          if (!fbUser?.phoneNumber) {
            this.error = 'Please sign in to view valuations.';
            return EMPTY;
          }
          return this.userService.getById(fbUser.phoneNumber).pipe(
            take(1),
            catchError(() => {
              this.error = 'Failed to load user details';
              return EMPTY;
            })
          );
        }),
        switchMap((user: UserModel) => {
          this.currentUser = user;
          return this.fetchValuationsForUser(user);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (data: WFValuation[]) => {
          // Filter out steps the user doesn't have permission to see
          this.claims = (data ?? []).filter(v =>
            this.canViewStep(this.steps[this.getStepIndex(v)])
          );

          // Sort by CreatedAt Descending
          this.claims.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          this.applyFilter();
        },
        error: () => {
          this.error = 'Failed to load valuations';
        }
      });
  }

  // ================= DATA FETCHING (Restored Logic) =================

  private fetchValuationsForUser(user: UserModel): Observable<WFValuation[]> {
    // 1. AVO Check
    if (user.roleId === 'AVO') {
      return this.claimService
        .getValuationsByAdjusterPhone(user.userId)
        .pipe(take(1));
    }

    // 2. Admin Check
    if (this.noAssignmentExemptRoles.includes(user.roleId)) {
      return this.claimService.getOpenValuations().pipe(take(1));
    }

    // 3. Location Assignment Check (Critical for Standard Users)
    const states = this.parseJsonArray((user as any).assignedStates);
    const districts = this.parseJsonArray((user as any).assignedDistricts);

    if (districts.length) {
      return this.claimService.getByDistricts(districts).pipe(take(1));
    }
    if (states.length) {
      return this.claimService.getByStates(states).pipe(take(1));
    }

    return of([]);
  }

  private parseJsonArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) ?? [];
      } catch {
        return [];
      }
    }
    return [];
  }

  // ================= DATE FILTERING (New Logic) =================

  onMonthSelected(date: Date, picker: any): void {
    this.filterMode = 'month';

    // Set start to 1st of month, End to last second of last day of month
    this.filterStartDate = new Date(date.getFullYear(), date.getMonth(), 1);
    this.filterEndDate = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23, 59, 59, 999
    );

    this.displayDateLabel =
      date.toLocaleString('default', { month: 'long' }) +
      ' ' +
      date.getFullYear();

    this.applyFilter();
    picker.close();
  }

  onDateSelected(date: Date): void {
    // Drill down logic: If viewing week, click selects Day. Else select Week.
    if (this.filterMode === 'week') {
      this.setDayFilter(date);
    } else {
      this.setWeekFilter(date);
    }
  }

  private setWeekFilter(date: Date): void {
    const day = date.getDay();
    // Calculate Monday (or adjustment based on your locale preference)
    // Assuming start of week is Monday here based on standard business logic
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);

    const start = new Date(date);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    this.filterMode = 'week';
    this.filterStartDate = start;
    this.filterEndDate = end;

    this.displayDateLabel = `Week: ${start.toDateString()} - ${end.toDateString()}`;
    this.applyFilter();
  }

  private setDayFilter(date: Date): void {
    this.filterMode = 'day';

    this.filterStartDate = new Date(date.setHours(0, 0, 0, 0));
    this.filterEndDate = new Date(date.setHours(23, 59, 59, 999));

    this.displayDateLabel = new Date(date).toDateString();
    this.applyFilter();
  }

  applyFilter(): void {
    this.filteredClaims = this.claims.filter(v => {
      const created = new Date(v.createdAt).getTime();

      // Date Check
      const matchesDate =
        !this.filterStartDate ||
        (created >= this.filterStartDate.getTime() &&
         created <= this.filterEndDate!.getTime());

      // Status Check
      const matchesStatus =
        !this.selectedStatus || v.status === this.selectedStatus;

      return matchesDate && matchesStatus;
    });
  }

  setStatusFilter(status: string): void {
    this.selectedStatus = status === this.selectedStatus ? '' : status;
    this.applyFilter();
  }

  // ================= HELPERS & NAVIGATION =================

  getCount(status: string): number {
    if (!this.claims) return 0;
    return this.claims.filter(v => v.status === status).length;
  }

  getStepIndex(v: WFValuation): number {
    const idx = (v.workflowStepOrder ?? 1) - 1;
    return Math.min(Math.max(idx, 0), 4);
  }

  ageInDays(v: WFValuation): number {
    return Math.floor(
      (Date.now() - new Date(v.createdAt).getTime()) / 86400000
    );
  }

  navigateToCurrent(v: WFValuation): void {
    const step = this.steps[this.getStepIndex(v)];
    
    // Map Steps to Route paths
    const routes: Record<string, string> = {
      Stakeholder: 'stakeholder',
      BackEnd: 'vehicle-details',
      AVO: 'inspection',
      QC: 'quality-control',
      FinalReport: 'final-report'
    };

    const route = routes[step];

    if (route) {
      this.router.navigate(['/valuation', v.valuationId, route], {
        queryParams: {
          vehicleNumber: v.vehicleNumber,
          applicantContact: v.applicantContact,
          valuationType: v.valuationType
        }
      });
    }
  }

  openCase(v: WFValuation): void {
    this.router.navigate(['/valuation', v.valuationId, 'lead-history'], {
      queryParams: {
        vehicleNumber: v.vehicleNumber,
        applicantContact: v.applicantContact,
        valuationType: v.valuationType,
        valuationId: v.valuationId
      }
    });
  }

  // ================= PERMISSIONS & UI STYLING =================

  // Restored: Logic to handle cases where Step name != Permission Name (e.g., BackEnd vs VehicleDetails)
  private canViewStep(step: string): boolean {
    switch (step) {
      case 'Stakeholder':
        return this.authz.hasAnyPermission(['CanViewStakeholder', 'CanCreateStakeholder', 'CanEditStakeholder']);
      case 'BackEnd':
        return this.authz.hasAnyPermission(['CanViewVehicleDetails', 'CanCreateVehicleDetails', 'CanEditVehicleDetails']);
      case 'AVO':
        return this.authz.hasAnyPermission(['CanViewInspection', 'CanCreateInspection', 'CanEditInspection']);
      case 'QC':
        return this.authz.hasAnyPermission(['CanViewQualityControl', 'CanCreateQualityControl', 'CanEditQualityControl']);
      case 'FinalReport':
        return this.authz.hasAnyPermission(['CanViewFinalReport', 'CanCreateFinalReport', 'CanEditFinalReport']);
      default:
        return false;
    }
  }

  // Restored: Logic for CSS classes in HTML
  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed': return 'success';
      case 'in progress': return 'warning';
      case 'rejected': return 'error';
      default: return 'info';
    }
  }

  trackByValuation = (_: number, v: WFValuation) =>
    `${v.valuationId}:${v.vehicleNumber}:${v.applicantContact}`;
}