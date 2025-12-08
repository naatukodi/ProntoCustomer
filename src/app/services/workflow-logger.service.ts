import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ✅ CORRECTED INTERFACE - MATCHES ACTUAL API RESPONSE
export interface LeadHistoryEntry {
  valuationId?: string;
  firstUpdate?: boolean;
  firstDateTime?: string | Date;
  action?: string;
  remarks?: string;
  statusChange?: boolean;
  previousStatus?: string | null;
  currentStatus?: string | null;
  statusChangedDateTime?: string | Date;
  currentTat?: number;
  totalTat?: number;
}

export interface LeadDetails {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  applicantName?: string;
  applicantPhone?: string;
  applicantLocation?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  vehicleModel?: string;
  clientName?: string;
  clientLocation?: string;
  executiveId?: string;
  executiveName?: string;
  executivePhone?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowLoggerService {
  private apiBaseUrl = environment.apiBaseUrl;
  private historySubject = new BehaviorSubject<LeadHistoryEntry[]>([]);

  constructor(private http: HttpClient) {}

  /**
   * Fetch Lead History from backend
   */
  async getHistory(valuationId: string): Promise<LeadHistoryEntry[]> {
    try {
      const response = await this.http
        .get<LeadHistoryEntry[]>(
          `${this.apiBaseUrl}/valuations/${valuationId}/workflow/gethistory`
        )
        .toPromise();
      
      const history = response || [];
      this.historySubject.next(history);
      return history;
    } catch (error) {
      console.error('Error fetching history:', error);
      return [];
    }
  }

  /**
   * Fetch Lead Details by combining data from multiple endpoints
   * ✅ UPDATED: Now accepts valuationType from URL parameter
   */
  async getLeadDetails(
    valuationId: string,
    vehicleNumber: string,
    applicantContact: string,
    valuationType?: string  // ← ADD THIS PARAMETER
  ): Promise<LeadDetails> {
    try {
      const leadDetails: LeadDetails = {};

      // ✅ FETCH STAKEHOLDER - Contains customer, client, and executive info
      try {
        const stakeholder = await this.http
          .get<any>(
            `${this.apiBaseUrl}/valuations/${valuationId}/stakeholder`,
            {
              params: {
                vehicleNumber: vehicleNumber,
                applicantContact: applicantContact
              }
            }
          )
          .toPromise();

        if (stakeholder) {
          // ✅ CORRECT MAPPINGS FROM STAKEHOLDER API
          // Customer info from applicant object
          leadDetails.customerName = stakeholder.applicant?.name || '-';
          leadDetails.customerPhone = stakeholder.applicant?.contact || '-';
          leadDetails.customerEmail = stakeholder.applicantEmail || '-';
          
          // Applicant info
          leadDetails.applicantName = stakeholder.applicant?.name || '-';
          leadDetails.applicantPhone = stakeholder.applicant?.contact || '-';
          leadDetails.applicantLocation = stakeholder.vehicleLocation?.name || '-';
          
          // Client info from top-level name
          leadDetails.clientName = stakeholder.name || '-';
          leadDetails.clientLocation = stakeholder.vehicleLocation?.district || '-';
          
          // Executive info from stakeholder
          leadDetails.executiveId = stakeholder.executiveContact || '-';
          leadDetails.executiveName = stakeholder.executiveName || '-';
          leadDetails.executivePhone = stakeholder.executiveContact || '-';
        }
      } catch (err) {
        console.warn('Could not load stakeholder data:', err);
      }

      // ✅ FETCH VEHICLE DETAILS WITH CORRECTED FIELD NAMES
      try {
        const vehicleDetails = await this.http
          .get<any>(
            `${this.apiBaseUrl}/valuations/${valuationId}/vehicledetails`,
            {
              params: {
                vehicleNumber: vehicleNumber,
                applicantContact: applicantContact
              }
            }
          )
          .toPromise();

        if (vehicleDetails) {
          // ✅ CORRECT MAPPINGS FROM VEHICLEDETAILS API
          leadDetails.vehicleNumber = vehicleDetails.registrationNumber || vehicleDetails.vehicleNumber || '-';
          
          // ✅ USE valuationType FROM URL PARAMETER (Priority 1)
          // Falls back to classOfVehicle if valuationType not provided
          leadDetails.vehicleType = valuationType || vehicleDetails.classOfVehicle || '-';
          
          leadDetails.vehicleModel = vehicleDetails.model || vehicleDetails.vehicleModel || '-';
        }
      } catch (err) {
        console.warn('Could not load vehicle details:', err);
      }

      // ✅ FETCH WORKFLOW (for workflow status info)
      try {
        const workflow = await this.http
          .get<any>(
            `${this.apiBaseUrl}/valuations/${valuationId}/workflow`,
            {
              params: {
                vehicleNumber: vehicleNumber,
                applicantContact: applicantContact
              }
            }
          )
          .toPromise();

        // Workflow returns steps array, not assigned user
        // Executive info already populated from Stakeholder API
        if (workflow && !Array.isArray(workflow)) {
          // In case workflow returns an object with user info
          if (workflow.currentAssignedTo || workflow.assignedTo) {
            const assignedUser = workflow.currentAssignedTo || workflow.assignedTo;
            leadDetails.executiveId = assignedUser.userId || assignedUser.id || leadDetails.executiveId;
            leadDetails.executiveName = assignedUser.userName || assignedUser.name || leadDetails.executiveName;
            leadDetails.executivePhone = assignedUser.phone || leadDetails.executivePhone;
          }
        }
      } catch (err) {
        console.warn('Could not load workflow data:', err);
      }

      return leadDetails;
    } catch (error) {
      console.error('Error fetching lead details:', error);
      return {};
    }
  }

  /**
   * Get history updates as observable
   */
  getHistoryUpdates(): Observable<LeadHistoryEntry[]> {
    return this.historySubject.asObservable();
  }

  /**
   * Refresh history
   */
  async refreshHistory(valuationId: string): Promise<void> {
    await this.getHistory(valuationId);
  }
}
