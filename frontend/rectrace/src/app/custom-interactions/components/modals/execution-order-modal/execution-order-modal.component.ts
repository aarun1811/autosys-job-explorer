import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

interface JobNode {
  jobName: string;
  loadJob: string;
  executionOrder: number;
}

interface JobDetails {
  jobType: string;
  machine: string;
  runCalendar: string;
  excludeCalendar: string;
  boxName: string;
  command: string;
  description: string;
  // New v2 fields
  status: string;
  nextStartTime: string;
  isScheduledToday: boolean;
}

interface ExecutionOrderData {
  loadJob: string;
  executionSequence: JobNode[];
  jobDetails: { [key: string]: JobDetails };
}

@Component({
  selector: 'app-execution-order-modal',
  templateUrl: './execution-order-modal.component.html',
  styleUrls: ['./execution-order-modal.component.css']
})
export class ExecutionOrderModalComponent {
  public selectedJobName: string | null | undefined = null;
  public selectedJobDetails: JobDetails | null | undefined = null;

  constructor(
    public dialogRef: MatDialogRef<ExecutionOrderModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ExecutionOrderData
  ) {
    console.log("data: ");
    console.log(data);
    this.dialogRef.disableClose = false;
    this.dialogRef.backdropClick().subscribe(() => {
      this.dialogRef.close();
    });
  }

  onNodeSelected(event: { jobName: string | null | undefined; details: JobDetails | null | undefined }) {
    this.selectedJobName = event.jobName;
    this.selectedJobDetails = event.details || null;
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.dialogRef.close();
    }
  }
}
