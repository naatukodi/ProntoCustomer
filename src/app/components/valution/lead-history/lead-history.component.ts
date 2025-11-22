import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-lead-history',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './lead-history.component.html',
  styleUrls: ['./lead-history.component.scss']
})
export class LeadHistoryComponent implements OnInit {
  valuationId: string = '';
  vehicleNumber: string = '';
  applicantContact: string = '';
  valuationType: string = '';
  
  lead: any = {
    customerName: 'Customer Name',
    customerPhone: 'Phone Number',
    clientName: 'Client Name',
    history: [
      {
        date: new Date(),
        action: 'Lead Created',
        remarks: 'Lead created through API'
      },
      {
        date: new Date(),
        action: 'Assigned',
        remarks: 'Lead assigned to user'
      }
    ]
  };
  
  loading = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.vehicleNumber = params['vehicleNumber'];
      this.applicantContact = params['applicantContact'];
      this.valuationType = params['valuationType'];
      this.lead.customerName = params['applicantContact'];
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
