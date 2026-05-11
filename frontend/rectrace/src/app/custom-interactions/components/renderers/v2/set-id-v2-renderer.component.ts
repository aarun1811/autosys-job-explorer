import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { TlmStatsModalV2Component, TlmStatsModalV2Data } from '../../modals/tlm-stats-modal-v2/tlm-stats-modal-v2.component';

@Component({
  selector: 'app-set-id-v2-renderer',
  template: `
    @if(setId && !isQuickRec) {
      <span
        class="set-id-link"
        (click)="showTlmDashboard()"
        [class.loading]="isLoading">
        <mat-icon>insights</mat-icon>
      <span class="set-id-text">{{ setId }}</span>
      @if(isLoading) {
        <mat-spinner diameter="14" class="spinner"></mat-spinner>
      }
    </span>
    }
    @if (setId && isQuickRec) {
      <span class="set-id-text-plain">{{ setId }}</span>
    }
    @if (!setId) {
      <span class="empty-cell"></span>
    }
  `,
  styles: [`
    .set-id-link {
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

    .set-id-link:hover:not(.loading) {
      color: #2e7d32;
      text-decoration: underline;
      text-underline-offset: 2px;
      background-color: rgba(52, 168, 83, 0.08);
      padding: 2px 6px;
      margin: 0 -6px;
      border-radius: 3px;
    }

    .set-id-link:active:not(.loading) {
      opacity: 0.8;
    }

    .set-id-link.loading {
      opacity: 0.7;
      cursor: default;
    }

    .set-id-link mat-icon {
      font-size: 14px;
      height: 14px;
      width: 14px;
      opacity: 0.9;
    }

    .set-id-text {
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

    .set-id-text-plain {
      font-family: 'Google Sans', sans-serif;
      font-size: 11px;
      color: rgba(0, 0, 0, 0.87);
  }
  `]
})
export class SetIdV2RendererComponent implements ICellRendererAngularComp {
  params!: ICellRendererParams;
  isLoading: boolean = false;
  setId: string | null = null;
  isQuickRec: boolean = false;

  constructor(private readonly dialog: MatDialog) { }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.setId = params.value;
    this.isQuickRec = params.data?.tlm_instance === 'QuickRec';
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.setId = params.value;
    this.isQuickRec = params.data?.tlm_instance === 'QuickRec';
    return true;
  }

  showTlmDashboard(): void {
    if (!this.setId) {
      return;
    }

    // Disable clicking for QuickRec rows - they should use the QuickRec-specific renderers
    const tlmInstance = this.params.data?.tlm_instance;
    if (tlmInstance === 'QuickRec') {
      return;
    }

    this.isLoading = true;

    const modalData: TlmStatsModalV2Data = {
      type: 'set_id',
      value: this.setId,
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