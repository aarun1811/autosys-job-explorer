import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { TlmStatsModalV2Component, TlmStatsModalV2Data } from '../../modals/tlm-stats-modal-v2/tlm-stats-modal-v2.component';

@Component({
  selector: 'app-tlm-instance-v2-renderer',
  template: `
    @if (tlmInstance && !isQuickRec) {
    <span
      class="tlm-instance-link"
      (click)="showTlmDashboard()"
      [class.loading]="isLoading">
      <mat-icon>insights</mat-icon>
      <span class="tlm-text">{{ tlmInstance }}</span>
      @if (isLoading) {
        <mat-spinner diameter="14" class="spinner"></mat-spinner>
      }
    </span>
    }
    @else if (tlmInstance && isQuickRec) {
    <span class="tlm-text-plain">{{ tlmInstance }}</span>
    }
    @if (!tlmInstance) {
    <span class="empty-cell"></span>
    }
  `,
  styles: [`
    .tlm-instance-link {
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

    .tlm-instance-link:hover:not(.loading) {
      color: #2e7d32;
      text-decoration: underline;
      text-underline-offset: 2px;
      background-color: rgba(52, 168, 83, 0.08);
      padding: 2px 6px;
      margin: 0 -6px;
      border-radius: 3px;
    }

    .tlm-instance-link:active:not(.loading) {
      opacity: 0.8;
    }

    .tlm-instance-link.loading {
      opacity: 0.7;
      cursor: default;
    }

    .tlm-instance-link mat-icon {
      font-size: 14px;
      height: 14px;
      width: 14px;
      opacity: 0.9;
    }

    .tlm-text {
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

    .tlm-text-plain {
      font-family: 'Google Sans', sans-serif;
      font-size: 11px;
      color: rgba(0, 0, 0, 0.87);
    }
  `]
})
export class TlmInstanceV2RendererComponent implements ICellRendererAngularComp {
  params!: ICellRendererParams;
  isLoading: boolean = false;
  tlmInstance: string | null = null;
  isQuickRec: boolean = false;

  constructor(private readonly dialog: MatDialog) { }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.tlmInstance = params.value;
    this.isQuickRec = this.tlmInstance === 'QuickRec';
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.tlmInstance = params.value;
    this.isQuickRec = this.tlmInstance === 'QuickRec';
    return true;
  }

  showTlmDashboard(): void {
    if (!this.tlmInstance) {
      return;
    }

    // Disable clicking for QuickRec - Quickrec should use the QuickRec-specific renderer
    if (this.tlmInstance === 'QuickRec') {
      return;
    }

    this.isLoading = true;

    const modalData: TlmStatsModalV2Data = {
      type: 'tlm_instance',
      value: this.tlmInstance,
      rowData: this.params.data,
      tlm_instance: this.tlmInstance
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