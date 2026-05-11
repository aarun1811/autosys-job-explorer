import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { MatDialog } from '@angular/material/dialog';
import { QuickRecStatsModalComponent } from '../../modals/quickrec-stats-modal/quickrec-stats-modal.component';

@Component({
  selector: 'app-rec-portal-id-renderer',
  templateUrl: './rec-portal-id-renderer.component.html',
  styleUrls: ['./rec-portal-id-renderer.component.css']
})
export class RecPortalIdRendererComponent implements ICellRendererAngularComp {
  params: any;
  value: string = '';
  isClickable: boolean = false;
  isLoading: boolean = false;
  tlmInstance: string = '';
  reconId: string = '';

  constructor(private dialog: MatDialog) { }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.value = this.getValueToDisplay(params);

    // Check if tlm_instance is "QuickRec" to enable clickability
    const rowData = params.data;
    this.tlmInstance = rowData?.tlm_instance || '';
    this.reconId = rowData?.recon_id || '';
    this.isClickable = this.tlmInstance === 'QuickRec' && !!this.value && this.value !== '-';
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.value = this.getValueToDisplay(params);

    const rowData = params.data;
    this.tlmInstance = rowData?.tlm_instance || '';
    this.reconId = rowData?.recon_id || '';
    this.isClickable = this.tlmInstance === 'QuickRec' && !!this.value && this.value !== '-';

    return true;
  }

  getValueToDisplay(params: ICellRendererParams): string {
    const value = params.value;
    return value ? String(value) : '-';
  }

  onClick(): void {
    // Only open modal if clickable (tlm_instance is QuickRec)
    if (!this.isClickable) {
      return;
    }

    this.isLoading = true;

    const dialogRef = this.dialog.open(QuickRecStatsModalComponent, {
      width: '95vw',
      maxWidth: '1400px',
      height: '85vh',
      data: {
        recPortalId: this.value,
        reconId: this.reconId,
        entryPoint: 'rec_portal_id',
        dateRange: 1
      },
      panelClass: ['quickrec-dashboard-modal', 'no-padding'],
      autoFocus: false,
      disableClose: false

    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('QuickRec modal closed for rec_portal_id:', this.value);
      this.isLoading = false;
    });
  }
}