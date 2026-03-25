import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { TlmStatsModalComponent, TlmStatsModalData } from '../modals/tlm-stats-modal/tlm-stats-modal.component';

@Component({
  selector: 'app-recon-cell-renderer',
  template: `
    @if(recon) {
      <button
        class="recon-btn"
        (click)="showTlmStats()"
        [disabled]="isLoading"
        aria-label="View TLM Stats">
      <div class="btn-content">
        <mat-icon>analytics</mat-icon>
        <span class="btn-text">{{ recon }}</span>
      </div>
      @if(isLoading) {
        <mat-spinner diameter="16" class="spinner"></mat-spinner>
      }
    </button>
    }
    @if(!recon) {
      <span>{{ recon }}</span>
    }
  `,
  styles: [`
    .recon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 10px;
      height: 24px;
      min-width: 80px;
      box-sizing: border-box;
      white-space: nowrap;
      border-radius: 4px;
      transition: all 0.2s ease;
      margin: 0;
      position: relative;
      font-family: 'Google Sans', sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: var(--google-blue, #1a73e8);
      background-color: transparent;
      border: none;
      line-height: 1;
      cursor: pointer;
      text-decoration: underline;
    }

    .recon-btn:hover:not(:disabled) {
      background-color: var(--bg-hover, rgba(26, 115, 232, 0.04));
      text-decoration: none;
    }

    .recon-btn:active:not(:disabled) {
      background-color: var(--bg-active, rgba(26, 115, 232, 0.08));
    }

    .recon-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      color: var(--text-secondary, #5f6368);
    }

    .btn-content {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .recon-btn mat-icon {
      font-size: 14px;
      height: 14px;
      width: 14px;
      opacity: 0.87;
    }

    .btn-text {
      font-size: 12px;
      line-height: 1;
      font-weight: 500;
      white-space: nowrap;
    }

    .spinner {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
    }

  `]
})
export class ReconCellRendererComponent implements ICellRendererAngularComp {
  params!: ICellRendererParams;
  isLoading: boolean = false;
  recon: string | null = null;

  constructor(private readonly dialog: MatDialog) { }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.recon = params.value;
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.recon = params.value;
    return true;
  }

  showTlmStats(): void {
    if (!this.recon) {
      return;
    }

    this.isLoading = true;

    const modalData: TlmStatsModalData = {
      type: 'recon',
      value: this.recon,
      rowData: this.params.data,
      tlm_instance: this.params.data?.tlm_instance
    };

    const dialogRef = this.dialog.open(TlmStatsModalComponent, {
      width: '90vw',
      height: '90vh',
      data: modalData,
      panelClass: 'tlm-stats-modal',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(() => {
      this.isLoading = false;
    });
  }
}
