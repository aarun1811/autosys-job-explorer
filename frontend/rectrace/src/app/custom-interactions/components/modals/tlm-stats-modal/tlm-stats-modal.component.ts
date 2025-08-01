import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, Observable } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import {
  TlmStatsService,
  BreakStatsData,
  AutomatchStatsData,
  ManualMatchStatsData
} from '../../../../services/tlm-stats.service';

export interface TlmStatsModalData {
  type: 'set_id' | 'recon';
  value: string;
  rowData: any;
  tlm_instance?: string;
}

@Component({
  selector: 'app-tlm-stats-modal',
  templateUrl: './tlm-stats-modal.component.html',
  styleUrls: ['./tlm-stats-modal.component.css']
})
export class TlmStatsModalComponent implements OnInit {
  // Loading states
  isLoading: boolean = false;
  isLoadingBreakStats: boolean = false;
  isLoadingAutomatchStats: boolean = false;
  isLoadingManualMatchStats: boolean = false;

  // Data
  breakStats: BreakStatsData[] = [];
  automatchStats: AutomatchStatsData[] = [];
  manualMatchStats: ManualMatchStatsData[] = [];

  // For recon type: set_id list and selected set_id
  setIdList: string[] = [];
  selectedSetId: string | null = null;

  // Error states
  hasBreakStatsError: boolean = false;
  hasAutomatchStatsError: boolean = false;
  hasManualMatchStatsError: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<TlmStatsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TlmStatsModalData,
    private tlmStatsService: TlmStatsService,
    private snackBar: MatSnackBar
  ) {
    this.dialogRef.disableClose = false;
    this.dialogRef.backdropClick().subscribe(() => {
      this.dialogRef.close();
    });
  }

  ngOnInit(): void {
    this.loadStats();
  }

  private loadStats(): void {
    this.isLoading = true;
    this.resetErrorStates();

    if (this.data.type === 'set_id') {
      this.loadStatsForSetId();
    } else {
      this.loadStatsForRecon();
    }
  }

  private loadStatsForSetId(): void {
    const params = {
      tlm_instance: this.data.tlm_instance || this.data.rowData.tlm_instance,
      local_acc_no: this.data.value
    };

    forkJoin({
      breakStats: this.tlmStatsService.getBreakStats(params).pipe(
        catchError(error => {
          this.hasBreakStatsError = true;
          this.showError('Failed to load break stats');
          return of(null);
        })
      ),
      automatchStats: this.tlmStatsService.getAutomatchStats(params).pipe(
        catchError(error => {
          this.hasAutomatchStatsError = true;
          this.showError('Failed to load automatch stats');
          return of(null);
        })
      ),
      manualMatchStats: this.tlmStatsService.getManualMatchStats({
        set_id: this.data.value
      }).pipe(
        catchError(error => {
          this.hasManualMatchStatsError = true;
          this.showError('Failed to load manual match stats');
          return of(null);
        })
      )
    }).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe(results => {
      if (results.breakStats) {
        this.breakStats = results.breakStats.data || [];
      }
      if (results.automatchStats) {
        this.automatchStats = results.automatchStats.data || [];
      }
      if (results.manualMatchStats) {
        this.manualMatchStats = results.manualMatchStats.data || [];
      }
    });
  }

  private loadStatsForRecon(): void {
    const params = {
      tlm_instance: this.data.tlm_instance || this.data.rowData.tlm_instance,
      agent_code: this.data.value
    };

    forkJoin({
      breakStats: this.tlmStatsService.getBreakStats(params).pipe(
        catchError(error => {
          this.hasBreakStatsError = true;
          this.showError('Failed to load break stats');
          return of(null);
        })
      ),
      automatchStats: this.tlmStatsService.getAutomatchStats(params).pipe(
        catchError(error => {
          this.hasAutomatchStatsError = true;
          this.showError('Failed to load automatch stats');
          return of(null);
        })
      ),
      manualMatchStats: this.tlmStatsService.getManualMatchStats({
        agent_code: this.data.value
      }).pipe(
        catchError(error => {
          this.hasManualMatchStatsError = true;
          this.showError('Failed to load manual match stats');
          return of(null);
        })
      )
    }).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe(results => {
      // Extract set_id list from all three API responses
      const setIdSet = new Set<string>();

      if (results.breakStats?.data) {
        results.breakStats.data.forEach(item => {
          if (item.local_acc_no) setIdSet.add(item.local_acc_no);
        });
      }

      if (results.automatchStats?.data) {
        results.automatchStats.data.forEach(item => {
          if (item.setid) setIdSet.add(item.setid);
        });
      }

      if (results.manualMatchStats?.data) {
        results.manualMatchStats.data.forEach(item => {
          if (item.setid) setIdSet.add(item.setid);
        });
      }

      this.setIdList = Array.from(setIdSet).sort();

      // Set initial data
      if (results.breakStats) {
        this.breakStats = results.breakStats.data || [];
      }
      if (results.automatchStats) {
        this.automatchStats = results.automatchStats.data || [];
      }
      if (results.manualMatchStats) {
        this.manualMatchStats = results.manualMatchStats.data || [];
      }
    });
  }

  onSetIdSelected(setId: string): void {
    this.selectedSetId = setId;
    this.loadStatsForSpecificSetId(setId);
  }

  private loadStatsForSpecificSetId(setId: string): void {
    this.isLoadingBreakStats = true;
    this.isLoadingAutomatchStats = true;
    this.isLoadingManualMatchStats = true;
    this.resetErrorStates();

    const params = {
      tlm_instance: this.data.tlm_instance || this.data.rowData.tlm_instance,
      local_acc_no: setId
    };

    forkJoin({
      breakStats: this.tlmStatsService.getBreakStats(params).pipe(
        catchError(error => {
          this.hasBreakStatsError = true;
          this.showError('Failed to load break stats for selected Set ID');
          return of(null);
        })
      ),
      automatchStats: this.tlmStatsService.getAutomatchStats(params).pipe(
        catchError(error => {
          this.hasAutomatchStatsError = true;
          this.showError('Failed to load automatch stats for selected Set ID');
          return of(null);
        })
      ),
      manualMatchStats: this.tlmStatsService.getManualMatchStats({
        set_id: setId
      }).pipe(
        catchError(error => {
          this.hasManualMatchStatsError = true;
          this.showError('Failed to load manual match stats for selected Set ID');
          return of(null);
        })
      )
    }).pipe(
      finalize(() => {
        this.isLoadingBreakStats = false;
        this.isLoadingAutomatchStats = false;
        this.isLoadingManualMatchStats = false;
      })
    ).subscribe(results => {
      if (results.breakStats) {
        this.breakStats = results.breakStats.data || [];
      }
      if (results.automatchStats) {
        this.automatchStats = results.automatchStats.data || [];
      }
      if (results.manualMatchStats) {
        this.manualMatchStats = results.manualMatchStats.data || [];
      }
    });
  }

  private resetErrorStates(): void {
    this.hasBreakStatsError = false;
    this.hasAutomatchStatsError = false;
    this.hasManualMatchStatsError = false;
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['error-snackbar']
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.dialogRef.close();
    }
  }

  getModalTitle(): string {
    if (this.data.type === 'set_id') {
      return `TLM Stats - Set ID: ${this.data.value}`;
    } else {
      return `TLM Stats - Recon: ${this.data.value}`;
    }
  }
}
