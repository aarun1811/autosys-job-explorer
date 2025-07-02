import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, ColDef } from 'ag-grid-enterprise';
import { ExecutionOrderService } from 'src/app/services/execution-order.service';
import { ExecutionOrderModalComponent } from '../modals/execution-order-modal/execution-order-modal.component';
import { MatSnackBar } from '@angular/material/snack-bar';

interface ExecutionOrderButtonParams extends ICellRendererParams {
  colDef?: ColDef & {
    cellRendererParams?: {
      jobNameField?: string;
    }
  };
}

interface ExecutionOrderResponse {
  loadJob: string;
  executionSequence: Array<{
    jobName: string;
    executionOrder: number;
    loadJob: string;
  }>;
  jobDetails: {
    [key: string]: {
      jobType: string;
      machine: string;
      [key: string]: any;
    };
  };
}

@Component({
  selector: 'app-execution-order-button',
  template: `
    <button
      *ngIf="jobName"
      class="execution-order-btn"
      (click)="showExecutionOrder()"
      [disabled]="isLoading"
      aria-label="View Execution Order">
      <div class="btn-content">
        <mat-icon>account_tree</mat-icon>
        <span class="btn-text">View</span>
      </div>
      <mat-spinner *ngIf="isLoading" diameter="16" class="spinner"></mat-spinner>
    </button>
  `,
  styles: [`
  .execution-order-btn {
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
    color: #1a73e8;
    background-color: transparent;
    border: none;
    line-height: 1;
    cursor: pointer;
  }

  .execution-order-btn:hover:not(:disabled) {
    background-color: rgba(26, 115, 232, 0.04);
  }

  .execution-order-btn:active:not(:disabled) {
    background-color: rgba(26, 115, 232, 0.08);
  }

  .execution-order-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    color: #5f6368;
  }

  .btn-content {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .execution-order-btn mat-icon {
    font-size: 14px;
    height: 14px;
    width: 14px;
    opacity: 0.87;
  }

  .btn-text {
    font-size: 12px;
    line-height: 1;
    font-weight: 500;
  }

  .spinner {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
  }

  @media (max-width: 768px) {
    .btn-text {
      display: none;
    }

    .execution-order-btn {
      min-width: 28px;
      padding: 0 6px;
      width: auto;
    }

    .btn-content {
      gap: 0;
    }

    .spinner {
      right: 4px;
    }
  }
`]
})
export class ExecutionOrderButtonComponent implements ICellRendererAngularComp {
  params!: ExecutionOrderButtonParams;
  isLoading: boolean = false;
  jobName: string | null = null;

  constructor(
    private readonly executionOrderService: ExecutionOrderService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {}

  agInit(params: ExecutionOrderButtonParams): void {
    this.params = params;
    this.setJobNameFromData();
  }

  refresh(params: ExecutionOrderButtonParams): boolean {
    // return false;
    this.params = params;
    this.setJobNameFromData();
    return true;
  }

  private setJobNameFromData(): void {
    const jobNameField = this.params.colDef?.cellRendererParams.jobNameField || 'load_job';
    const potentialJobName = this.params.data ? this.params.data[jobNameField] : null;

    if (potentialJobName && typeof potentialJobName === 'string' && potentialJobName.trim().length > 0) {
      this.jobName = potentialJobName;
    }
  }

  showExecutionOrder(): void {
    const jobName = this.params.data.load_job;
    if (!jobName) {
      this.showError('Job name is undefined');
      return;
    }

    this.isLoading = true;

    this.executionOrderService.getExecutionOrder(jobName).subscribe(
      (data: ExecutionOrderResponse) => {
        this.isLoading = false;
        if (!data || !data.executionSequence || data.executionSequence.length === 0) {
          this.showError('No execution order data available');
          return;
        }

        this.dialog.open(ExecutionOrderModalComponent, {
          width: '90vw',
          height: '90vh',
          data: data,
          panelClass: 'execution-order-modal',
          autoFocus: false
        });
      },
      (error) => {
        console.error('Error fetching execution order:', error);
        this.isLoading = false;
        this.showError('Failed to load execution order');
      }
    );
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['error-snackbar']
    });
  }
}