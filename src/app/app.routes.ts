import { Routes } from '@angular/router';
import { MainLayoutComponent } from './components/main-layout/main-layout';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { StakeholderNewComponent } from './components/stakeholder/stakeholder-new/stakeholder-new.component';
import { StakeholderUpdateComponent } from './components/stakeholder/stakeholder-update/stakeholder-update.component';
import { StakeholderViewComponent } from './components/stakeholder/stakeholder-view/stakeholder-view.component';
import { ValuationVehicleDetailsComponent } from './components/valution/valuation-vehicle-details/valuation-vehicle-details.component';
import { ValuationUpdateComponent } from './components/valution/valuation-update/valuation-update.component';
import { InspectionViewComponent } from './components/inspection/inspection-view/inspection-view.component';
import { InspectionUpdateComponent } from './components/inspection/inspection-update/inspection-update.component';
import { VehicleImageUploadComponent } from './components/inspection/vehicle-image-upload/vehicle-image-upload.component';
import { QualityControlViewComponent } from './components/qc/quality-control-view/quality-control-view.component';
import { QualityControlUpdateComponent } from './components/qc/quality-control-update/quality-control-update.component';
import { FinalReportComponent } from './components/Report/final-report/final-report.component';
import { UserRolesComponent } from './components/users/user-roles-view/user-roles.component';
import { UsersComponent } from './components/users/users/users.component';

import { Unauthorized } from './unauthorized/unauthorized';
import { LoginComponent } from './login/login';
import { AuthGuard } from './auth/auth';
import { RoleGuard }      from './auth/role.guard';
import { AddUserComponent } from './components/users/add-user/add-user.component';
import { EditUserComponent } from './components/users/edit-user/edit-user.component';
import { ReportCompletionUpdateComponent } from './components/Report/final-report-completion/report-completion-update.component';
import { LeadHistoryComponent } from './components/valution/lead-history/lead-history.component'
export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
   {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],    // optional if you want root protected
    children: [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanViewDashboard' } },
  { path: 'valuation/:valuationId/lead-history', component: LeadHistoryComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanViewDashboard' } },
  // 2) Stakeholder routes
  { path: 'stakeholder', component: StakeholderNewComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanCreateStakeholder' } },
  { path: 'valuation/:valuationId/stakeholder/update', component: StakeholderUpdateComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanEditStakeholder' } },
  { path: 'valuation/:valuationId/stakeholder', component: StakeholderViewComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanViewStakeholder' } },
  // 3) Valuation routes
  { path: 'valuation/:valuationId/vehicle-details', component: ValuationVehicleDetailsComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanViewVehicleDetails' } },
  { path: 'valuation/:valuationId/vehicle-details/update', component: ValuationUpdateComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanEditVehicleDetails' } },
  // 4) Inspection routes
  { path: 'valuation/:valuationId/inspection', component: InspectionViewComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanViewInspection' } },
  { path: 'valuation/:valuationId/inspection/update', component: InspectionUpdateComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanEditInspection' } },
  { path: 'valuation/:valuationId/inspection/vehicle-image-upload', component: VehicleImageUploadComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanEditInspection' } },
  // 5) Quality Control routes
  { path: 'valuation/:valuationId/quality-control', component: QualityControlViewComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanViewQualityControl' } },
  { path: 'valuation/:valuationId/quality-control/update', component: QualityControlUpdateComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanEditQualityControl' } },
  // 6) Final Report route
  { path: 'valuation/:valuationId/final-report', component: FinalReportComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanViewFinalReport' } },
  { path: 'valuation/:valuationId/final-report/update', component: ReportCompletionUpdateComponent, canActivate: [AuthGuard, RoleGuard], data: { permission: 'CanEditFinalReport' } },

  // 7) User roles
  { path: 'users/:phone/roles', component: UserRolesComponent },
  { path: 'users', component: UsersComponent },
  { path: 'users/add', component: AddUserComponent },
  { path: 'users/:id/edit', component: EditUserComponent },
  { path: 'unauthorized', component: Unauthorized },
   ]
  },
  { path: '**', redirectTo: '' }
];
