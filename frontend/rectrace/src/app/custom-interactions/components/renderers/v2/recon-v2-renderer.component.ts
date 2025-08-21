import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { TlmStatsModalV2Component, TlmStatsModalV2Data } from '../../modals/tlm-stats-modal-v2/tlm-stats-modal-v2.component';

@Component({
  selector: 'app-recon-v2-renderer',
  template: `
    <button
      *ngIf="recon"
      class="recon-btn"
      (click)="showTlmDashboard()"
      [disabled]="isLoading"
      aria-label="View TLM Dashboard">
      <div class="btn-content">
        <mat-icon>insights</mat-icon>
        <span class="btn-text">{{ recon }}</span>
      </div>
      <mat-spinner *ngIf="isLoading" diameter="16" class="spinner"></mat-spinner>
    </button>
    <span *ngIf="!recon" class="empty-value">{{ recon || 'N/A' }}</span>
  `,
  styles: [`
    .recon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 12px;
      height: 28px;
      min-width: 100px;
      box-sizing: border-box;
      white-space: nowrap;
      border-radius: 6px;
      transition: all 0.2s ease;
      margin: 0;
      position: relative;
      font-family: 'Google Sans', sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: var(--google-purple);
      background-color: transparent;
      border: 1px solid var(--google-purple);
      line-height: 1;
      cursor: pointer;
      text-decoration: none;
    }

    .recon-btn:hover:not(:disabled) {
      background-color: var(--google-purple);
      color: var(--text-inverse);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    .recon-btn:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: none;
    }

    .recon-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      color: var(--text-secondary);
      border-color: var(--border-secondary);
    }

    .btn-content {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .recon-btn mat-icon {
      font-size: 16px;
      height: 16px;
      width: 16px;
      opacity: 0.9;
    }

    .btn-text {
      font-size: 12px;
      line-height: 1;
      font-weight: 500;
      white-space: nowrap;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .spinner {
      position: absolute;
      right: 4px;
      top: 50%;
      transform: translateY(-50%);
      
      ::ng-deep circle {
        stroke: var(--google-purple);
      }
    }

    .empty-value {
      color: var(--text-tertiary);
      font-style: italic;
      font-size: 12px;
    }

    /* Animation */
    .recon-btn {
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(2px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
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

    const modalData: TlmStatsModalV2Data = {
      type: 'recon',
      value: this.recon,
      rowData: this.params.data,
      tlm_instance: this.params.data?.tlm_instance
    };

    const dialogRef = this.dialog.open(TlmStatsModalV2Component, {
      width: '95vw',
      height: '90vh',
      data: modalData,
      panelClass: ['tlm-dashboard-modal-v2', 'no-padding'],
      autoFocus: false,
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(() => {
      this.isLoading = false;
    });
  }
}