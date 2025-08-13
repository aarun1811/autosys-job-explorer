import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-app-support-cell-renderer',
  template: `
    <a *ngIf="supportEmail"
       [href]="'mailto:' + supportEmail"
       target="_blank"
       class="file-link"
       [matTooltip]="getTooltipText()">
      {{ supportEmail }}
    </a>
    <span *ngIf="!supportEmail">{{ supportEmail }}</span>
  `,
  styles: [`
    .file-link {
      color: var(--google-blue, #1a73e8);
      text-decoration: underline;
      cursor: pointer;
    }
    .file-link:hover {
      text-decoration: none;
    }
  `]
})
export class AppSupportCellRendererComponent implements ICellRendererAngularComp {
  supportEmail: string = '';
  appName: string = '';

  agInit(params: ICellRendererParams): void {
    this.supportEmail = params.value;
    this.appName = params.data?.app_name || "";
  }

  refresh(params: ICellRendererParams): boolean {
    return false;
  }

  getTooltipText(): string {
    return `Send email to ${this.appName}`;
  }

  destroy(): void {
    // Cleanup if needed
  }
}
