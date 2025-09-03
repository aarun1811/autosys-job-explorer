import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { QuickRecStatsService, QuickRecStatsRequest, QuickRecAutoMatchStats, QuickRecManualMatchStats, QuickRecDashboardSummary } from 'src/app/services/quickrec-stats.service';

export interface QuickRecModalData {
  reconId?: string;
  recPortalId?: string;
  entryPoint: 'recon_id' | 'rec_portal_id';
  dateRange?: number;
}

@Component({
  selector: 'app-quickrec-stats-modal',
  templateUrl: './quickrec-stats-modal.component.html',
  styleUrls: ['./quickrec-stats-modal.component.css']
})
export class QuickRecStatsModalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  loading = false;
  error: string | null = null;
  
  // Data
  autoMatchStats: QuickRecAutoMatchStats[] = [];
  manualMatchStats: QuickRecManualMatchStats[] = [];
  dashboardSummary: QuickRecDashboardSummary | null = null;
  
  // Filter values
  selectedDateRange = 1;
  currentRequest: QuickRecStatsRequest;
  
  constructor(
    public dialogRef: MatDialogRef<QuickRecStatsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: QuickRecModalData,
    private quickRecStatsService: QuickRecStatsService
  ) {
    // Initialize request based on entry point
    this.currentRequest = {
      date_range: this.selectedDateRange,
      entry_point: this.data.entryPoint
    };
    
    if (this.data.entryPoint === 'recon_id' && this.data.reconId) {
      this.currentRequest.recon_id = this.data.reconId;
    } else if (this.data.entryPoint === 'rec_portal_id' && this.data.recPortalId) {
      this.currentRequest.rec_portal_id = this.data.recPortalId;
    }
  }
  
  ngOnInit(): void {
    this.loadStats();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  onDateRangeChange(dateRange: number): void {
    this.selectedDateRange = dateRange;
    this.currentRequest.date_range = dateRange;
    this.loadStats();
  }
  
  onFilterChange(filters: any): void {
    // Update request based on filter changes
    if (filters.reconId !== undefined) {
      this.currentRequest.recon_id = filters.reconId;
    }
    if (filters.recPortalId !== undefined) {
      this.currentRequest.rec_portal_id = filters.recPortalId;
    }
    this.loadStats();
  }
  
  loadStats(): void {
    this.loading = true;
    this.error = null;
    
    // Load all stats in parallel
    forkJoin({
      autoMatch: this.quickRecStatsService.getAutoMatchStats(this.currentRequest),
      manualMatch: this.quickRecStatsService.getManualMatchStats(this.currentRequest),
      summary: this.quickRecStatsService.getDashboardSummary({
        recon_id: this.currentRequest.recon_id,
        rec_portal_id: this.currentRequest.rec_portal_id,
        date_range: this.currentRequest.date_range,
        entry_point: this.currentRequest.entry_point
      })
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (results) => {
        if (results.autoMatch.status === 'success') {
          this.autoMatchStats = results.autoMatch.data;
        }
        if (results.manualMatch.status === 'success') {
          this.manualMatchStats = results.manualMatch.data;
        }
        if (results.summary.status === 'success') {
          this.dashboardSummary = results.summary.data;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading QuickRec stats:', error);
        this.error = 'Failed to load QuickRec statistics. Please try again.';
        this.loading = false;
      }
    });
  }
  
  onClose(): void {
    this.dialogRef.close();
  }
}