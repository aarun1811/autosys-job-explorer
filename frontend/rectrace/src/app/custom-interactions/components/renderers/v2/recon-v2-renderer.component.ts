import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { RecvizEmbedDialogComponent } from '../../modals/recviz-embed-dialog/recviz-embed-dialog.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-recon-v2-renderer',
  template: `
    <span
      *ngIf="recon"
      class="recon-link"
      (click)="showTlmDashboard()"
      [class.loading]="isLoading">
      <mat-icon>insights</mat-icon>
      <span class="recon-text">{{ recon }}</span>
      <mat-spinner *ngIf="isLoading" diameter="14" class="spinner"></mat-spinner>
    </span>
    <span *ngIf="!recon" class="empty-cell"></span>
  `,
  styles: [`
    .recon-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--google-green);
      font-family: 'Google Sans', sans-serif;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
      padding: 2px 0;
    }

    .recon-link:hover:not(.loading) {
      color: #2e7d32;
      text-decoration: underline;
      text-underline-offset: 2px;
      background-color: rgba(52, 168, 83, 0.08);
      padding: 2px 6px;
      margin: 0 -6px;
      border-radius: 3px;
    }

    .recon-link:active:not(.loading) {
      opacity: 0.8;
    }

    .recon-link.loading {
      opacity: 0.7;
      cursor: default;
    }

    .recon-link mat-icon {
      font-size: 14px;
      height: 14px;
      width: 14px;
      opacity: 0.9;
    }

    .recon-text {
      line-height: 1;
      letter-spacing: 0.2px;
    }

    .spinner {
      margin-left: 4px;
      
      ::ng-deep circle {
        stroke: var(--google-green);
      }
    }

    .empty-cell {
      display: none;
    }
  `]
})
export class ReconV2RendererComponent implements ICellRendererAngularComp {
  params!: ICellRendererParams;
  isLoading: boolean = false;
  recon: string | null = null;

  constructor(private readonly dialog: MatDialog) {}

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.recon = params.value;
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.recon = params.value;
    return true;
  }

  showTlmDashboard(): void {
    if (!this.recon) {
      return;
    }

    this.isLoading = true;

    const params = new URLSearchParams();
    params.set('filter.tlm_instance', this.params.data?.tlm_instance || '');
    params.set('filter.recon', this.recon);
    params.set('lock', 'tlm_instance,recon');
    params.set('theme', 'dark');

    const url = `${environment.recvizUrl}/embed/dashboards/tlm-stats?${params.toString()}`;

    const dialogRef = this.dialog.open(RecvizEmbedDialogComponent, {
      width: '95vw',
      height: '90vh',
      data: { url },
      panelClass: ['tlm-dashboard-modal-v2', 'no-padding'],
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe(() => {
      this.isLoading = false;
    });
  }
}