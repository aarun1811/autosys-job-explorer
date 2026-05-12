import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { JobStatusInfo, VisualState, ExecutionOrderData, JobDetails } from '../../../../services/execution-order.service';

@Component({
  selector: 'app-execution-order-modal',
  templateUrl: './execution-order-modal.component.html',
  styleUrls: ['./execution-order-modal.component.scss']
})
export class ExecutionOrderModalComponent {
  public selectedJobName: string | null | undefined = null;
  public selectedJobDetails: JobDetails | null | undefined = null;
  public selectedJobStatus: JobStatusInfo | null | undefined = null;

  constructor(
    public dialogRef: MatDialogRef<ExecutionOrderModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ExecutionOrderData
  ) {
    this.dialogRef.disableClose = false;
    this.dialogRef.backdropClick().subscribe(() => {
      this.dialogRef.close();
    });
  }

  onNodeSelected(event: {
    jobName: string | null | undefined;
    details: JobDetails | null | undefined;
    status: JobStatusInfo | null | undefined
  }) {
    this.selectedJobName = event.jobName;
    this.selectedJobDetails = event.details || null;
    this.selectedJobStatus = event.status || null;
  }

  getStatusIcon(visualState: VisualState): string {
    const icons: Record<VisualState, string> = {
      COMPLETED: 'check_circle',
      FAILED: 'error',
      RUNNING: 'play_circle',
      INACTIVE: 'pause_circle',
      WAITING: 'schedule'
    }
    return icons[visualState] || 'help';
  };

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.dialogRef.close();
    }
  }
}
