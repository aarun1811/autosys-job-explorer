import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-app-id-cell-renderer',
  template: `
    <a *ngIf="appId"
       [href]="getFileUrl()"
       target="_blank"
       class="file-link"
       [matTooltip]="getTooltipText()">
      {{ appId }}
    </a>
    <span *ngIf="!appId">{{ appId }}</span>
  `,
  styles: [`
    .file-link {
      color: #1a73e8;
      text-decoration: underline;
      cursor: pointer;
    }
    .file-link:hover {
      text-decoration: none;
    }
  `]
})
export class AppIDCellRendererComponent implements ICellRendererAngularComp {
  appId: string = '';
  appName: string = '';

  agInit(params: ICellRendererParams): void {
    this.appId = params.value;
    this.appName = params.data?.app_name || "";
  }

  refresh(params: ICellRendererParams): boolean {
    return false;
  }

  getFileUrl(): string {
    return "https://lnkd.in/gpAtSBRj";
  }

  getTooltipText(): string {
    return `View details of ${this.appName}`;
  }

  destroy(): void {
    // Cleanup if needed
  }
}