import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WorkflowLoggerService, LeadHistoryEntry, LeadDetails } from '../../../services/workflow-logger.service';

@Component({
  selector: 'app-lead-history',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './lead-history.component.html',
  styleUrls: ['./lead-history.component.scss']
})
export class LeadHistoryComponent implements OnInit, OnDestroy {
  valuationId: string = '';
  vehicleNumber: string = '';
  applicantContact: string = '';
  valuationType: string = '';
  
  historyEntries: LeadHistoryEntry[] = [];
  leadDetails: LeadDetails = {};
  loading = true;
  error: string | null = null;
  
  private destroy$ = new Subject<void>();
  private refreshInterval: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workflowLogger: WorkflowLoggerService
  ) {}

  ngOnInit(): void {
    // Get params from route
    this.route.queryParams.subscribe(params => {
      this.valuationId = params['valuationId'];
      this.vehicleNumber = params['vehicleNumber'];
      this.applicantContact = params['applicantContact'];
      this.valuationType = params['valuationType'];
      
      if (this.valuationId) {
        this.loadHistory();
        this.loadLeadDetails();
        this.startAutoRefresh();
        
        // Subscribe to history updates
        this.workflowLogger
          .getHistoryUpdates()
          .pipe(takeUntil(this.destroy$))
          .subscribe(history => {
            this.historyEntries = history;
          });
      } else {
        this.error = 'Valuation ID not found';
        this.loading = false;
      }
    });
  }

  /**
   * Load history from backend
   * ✅ NOW USES CORRECT API FIELD NAMES
   */
  private async loadHistory(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      
      const historyData = await this.workflowLogger.getHistory(this.valuationId);
      console.log('History data received:', historyData);
      
      this.historyEntries = historyData || [];
      
      if (!this.historyEntries || this.historyEntries.length === 0) {
        console.warn('No history found for valuation:', this.valuationId);
        this.error = 'No history found for this valuation';
      }
    } catch (err) {
      this.error = 'Failed to load lead history';
      console.error('Error loading history:', err);
      this.historyEntries = [];
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load lead details (customer, vehicle, client, executive info)
   * ✅ NOW PASSES ALL 4 PARAMETERS INCLUDING valuationType
   */
  private async loadLeadDetails(): Promise<void> {
    try {
      this.leadDetails = await this.workflowLogger.getLeadDetails(
        this.valuationId,
        this.vehicleNumber,
        this.applicantContact,
        this.valuationType  // ← ADD THIS PARAMETER
      );
    } catch (err) {
      console.warn('Could not load lead details:', err);
      // Use fallback data from params
      this.leadDetails = {
        vehicleNumber: this.vehicleNumber,
        applicantPhone: this.applicantContact,
        vehicleType: this.valuationType  // ← Use URL param as fallback
      };
    }
  }

  /**
   * Format date and time
   * ✅ HANDLES firstDateTime FIELD FROM API
   */
  formatDateTime(dateString: string | Date | null | undefined): string {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '-';
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (err) {
      console.warn('Error formatting date:', dateString, err);
      return '-';
    }
  }

  /**
   * Auto-refresh history every 10 seconds
   */
  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(async () => {
      await this.workflowLogger.refreshHistory(this.valuationId);
    }, 10000); // Refresh every 10 seconds
  }

  /**
   * Go back to dashboard
   */
  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}
