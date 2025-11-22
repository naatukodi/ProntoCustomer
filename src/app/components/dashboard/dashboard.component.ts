import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { from, of, EMPTY, Observable } from 'rxjs';
import { catchError, finalize, switchMap, take, timeout } from 'rxjs/operators';

import { ClaimService } from '../../services/claim.service';
import { UsersService } from '../../services/users.service';
import { AuthorizationService } from '../../services/authorization.service';
import { AuthService } from '../../services/auth.service';

import { WFValuation } from '../../models/valuation.model';
import { UserModel } from '../../models/user.model';

import { SharedModule } from '../shared/shared.module/shared.module';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';

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
  claims: WFValuation[] = [];
  filteredClaims: WFValuation[] = [];
  loading = true;
  error: string | null = null;
  filterDate: Date | null = null;
  currentUser: UserModel | null = null;
  steps: string[] = ['Stakeholder', 'BackEnd', 'AVO', 'QC', 'FinalReport'];


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

  // Status filter only
  statuses = ['Open', 'InProgress', 'Inspection Completed', 'Rejected'];
  selectedStatus: string = '';

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
          this.claims = (data ?? []).filter((v) =>
            this.canViewStep(this.steps[this.getStepIndex(v)])
          );
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

  onDateFilterChange(): void {
    if (!this.filterDate) {
      this.applyFilter();
      return;
    }
    const filterTime = this.filterDate.setHours(0, 0, 0, 0);
    this.filteredClaims = this.claims.filter((v) => {
      const createdTime = new Date(v.createdAt).setHours(0, 0, 0, 0);
      return createdTime === filterTime;
    });
  }

  private fetchValuationsForUser(user: UserModel): Observable<WFValuation[]> {
    if (user.roleId === 'AVO') {
      return this.claimService
        .getValuationsByAdjusterPhone(user.userId)
        .pipe(take(1));
    }
    if (this.noAssignmentExemptRoles.includes(user.roleId)) {
      return this.claimService.getOpenValuations().pipe(take(1));
    }
    const states = this.parseJsonArray((user as any).assignedStates);
    const districts = this.parseJsonArray((user as any).assignedDistricts);
    if (districts.length)
      return this.claimService.getByDistricts(districts).pipe(take(1));
    if (states.length) return this.claimService.getByStates(states).pipe(take(1));
    return of<WFValuation[]>([]);
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

  // =========== FILTERS ===========
  applyFilter(): void {
    this.filteredClaims = this.claims.filter((v) => {
      const matchesDate = !this.filterDate || new Date(v.createdAt).setHours(0, 0, 0, 0) === this.filterDate.setHours(0, 0, 0, 0);
      const matchesStatus = !this.selectedStatus || v.status === this.selectedStatus;
      return matchesDate && matchesStatus;
    });
  }

  setStatusFilter(status: string): void {
    this.selectedStatus = status === this.selectedStatus ? '' : status;
    this.applyFilter();
  }

  getStepIndex(v: WFValuation): number {
    const idx = (v.workflowStepOrder ?? 1) - 1;
    return Math.min(Math.max(idx, 0), 4);
  }

  navigateToCurrent(v: WFValuation): void {
    const step = ['Stakeholder', 'BackEnd', 'AVO', 'QC', 'FinalReport'][this.getStepIndex(v)];
    let route = '';
    switch (step) {
      case 'Stakeholder':
        route = 'stakeholder';
        break;
      case 'BackEnd':
        route = 'vehicle-details';
        break;
      case 'AVO':
        route = 'inspection';
        break;
      case 'QC':
        route = 'quality-control';
        break;
      case 'FinalReport':
        route = 'final-report';
        break;
    }
    this.router.navigate(['/valuation', v.valuationId, route], {
      queryParams: {
        vehicleNumber: v.vehicleNumber,
        applicantContact: v.applicantContact,
        valuationType: v.valuationType,
      },
    });
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
    //this.navigateToCurrent(v); 
  }

  ageInDays(v: WFValuation): number {
    const t = v?.createdAt ? new Date(v.createdAt).getTime() : Date.now();
    return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  }

  private canViewStep(step: string): boolean {
    switch (step) {
      case 'Stakeholder':
        return this.authz.hasAnyPermission([
          'CanViewStakeholder',
          'CanCreateStakeholder',
          'CanEditStakeholder',
        ]);
      case 'BackEnd':
        return this.authz.hasAnyPermission([
          'CanViewVehicleDetails',
          'CanCreateVehicleDetails',
          'CanEditVehicleDetails',
        ]);
      case 'AVO':
        return this.authz.hasAnyPermission([
          'CanViewInspection',
          'CanCreateInspection',
          'CanEditInspection',
        ]);
      case 'QC':
        return this.authz.hasAnyPermission([
          'CanViewQualityControl',
          'CanCreateQualityControl',
          'CanEditQualityControl',
        ]);
      case 'FinalReport':
        return this.authz.hasAnyPermission([
          'CanViewFinalReport',
          'CanCreateFinalReport',
          'CanEditFinalReport',
        ]);
      default:
        return false;
    }
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'in progress':
        return 'warning';
      case 'rejected':
        return 'error';
      default:
        return 'info';
    }
  }

  trackByValuation = (_: number, v: WFValuation) =>
    `${v.valuationId}:${v.vehicleNumber}:${v.applicantContact}`;
}
