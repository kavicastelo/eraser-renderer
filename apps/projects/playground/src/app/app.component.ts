import { Component } from '@angular/core';
import { DiagramViewerComponent } from 'diagram-viewer';
import {JsonPipe} from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DiagramViewerComponent, JsonPipe],
  templateUrl: './app.component.html',
})
export class AppComponent {
  codeText = `
title Admin System - Data Flow Diagram (DFD Level 1)

direction right
colorMode pastel
styleMode shadow
typeface clean

// Actors
Actors {
    superadmin[icon: shield, color: blue, label: "Super Admin"]
    enterprise_admin[icon: building, color: blue, label: "Enterprise Admin"]
    coach_user[icon: user, color: blue, label: "Coach / User"]
}

// Processes
Processes {
    admin_portal[icon: screen, color: purple, label: "Admin Portal (UI)"]
    admin_api[icon: share, color: purple, label: "Admin API Gateway"]
    org_process[icon: settings, color: green, label: "Org Management Process"]
    user_process[icon: users, color: green, label: "User/Coach Management Process"]
    billing_process[icon: credit-card, color: green, label: "Billing Process"]
    reports_process[icon: chart, color: green, label: "Reporting Process"]
}

// Data Stores
Stores {
    audit_log[icon: file, color: orange, label: "Audit Logs"]
    rbac_store[icon: key, color: orange, label: "RBAC Policies"]
    billing_store[icon: bank, color: orange, label: "Billing Records"]
    analytics_store[icon: bar-chart, color: orange, label: "Analytics Data"]
}

// External Systems
External {
    idp[icon: lock, color: gray, label: "Identity Provider (SSO)"]
    payment_gateway[icon: credit-card, color: gray, label: "Payment Gateway"]
}

// Flows
superadmin>admin_portal: UI actions
enterprise_admin>admin_portal: Admin actions
coach_user>admin_portal: Verification request

admin_portal>admin_api: API calls

admin_api>org_process: Org operations
admin_api>user_process: User operations
admin_api>billing_process: Billing ops
admin_api>reports_process: Reporting queries

org_process>idp: Configure SSO
billing_process>payment_gateway: Charges / refunds

user_process>rbac_store: Read/write roles
user_process>audit_log: Log changes

billing_process>billing_store: Store invoices
reports_process>analytics_store: Query/report data
reports_process>audit_log: Log exports

  `;

  lastEvent: any;

  onLoaded(ev: any) {
    this.lastEvent = ev;
    console.log('[diagram loaded]', ev);
  }
}
