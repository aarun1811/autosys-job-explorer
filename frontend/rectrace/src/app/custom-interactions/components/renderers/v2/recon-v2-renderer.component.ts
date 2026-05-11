import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { TlmStatsModalV2Component, TlmStatsModalV2Data } from '../../modals/tlm-stats-modal-v2/tlm-stats-modal-v2.component';

@Component({
  selector: 'app-recon-v2-renderer',
  template: `
  @if (recon && !isQuickRec) {
    <span
      class="recon-link"
      (click)="showTlmDashboard()"
      [class.loading]="isLoading">
      <mat-icon>insights</mat-icon>
      <span class="recon-text">{{ recon }}</span>
      @if (isLoading) { 
        <mat-spinner diameter="14" class="spinner"></mat-spinner>
      }
    </span>
  }
  @if (recon && isQuickRec) {
    <span class="recon-text-plain">{{ recon }}</span>
  }
  @if (!recon) {
    <span class="empty-cell"></span>
  }
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

    .recon-text-plain {
      font-family: 'Google Sans', sans-serif;
      font-size: 11px;
      color: rgba(0, 0, 0, 0.87);
    }
  `]
})
export class ReconV2RendererComponent implements ICellRendererAngularComp {
  params!: ICellRendererParams;
  isLoading: boolean = false;
  recon: string | null = null;
  isQuickRec: boolean = false;

  constructor(private readonly dialog: MatDialog) { }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.recon = params.value;
    this.isQuickRec = params.data?.tlm_instance === 'QuickRec';
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.recon = params.value;
    this.isQuickRec = params.data?.tlm_instance === 'QuickRec';
    return true;
  }

  showTlmDashboard(): void {
    if (!this.recon) {
      return;
    }

    // Disable clicking for Quickec rows - they should use the QuickRec specific renderers
    const tlmInstance = this.params.data?.tlm_instance;
    if (tlmInstance === 'QuickRec') {
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