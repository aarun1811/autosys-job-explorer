import { Component, Inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ThemeService } from '../../../../services/theme.service';
import { TlmStatsV2Service, DateRange, DashboardSummary } from '../../../../services/tlm-stats-v2.service';

export interface TlmStatsModalV2Data {
  type: 'set_id' | 'recon' | 'tlm_instance';
  value: string;
  rowData: any;
  tlm_instance?: string;
}

export interface FilterState {
  tlmInstance: string;
  selectedRecons: string[];
  selectedSetIds: string[];
  dateRange: DateRange;
  availableRecons: string[];
  availableSetIds: string[];
  // Filter locks based on entry point
  tlmInstanceLocked: boolean;
  reconLocked: boolean;
  setIdLocked: boolean;
  entryPoint: string; // "set_id", "recon", or "tlm_instance"
}

@Component({
  selector: 'app-tlm-stats-modal-v2',
  templateUrl: './tlm-stats-modal-v2.component.html',
  styleUrls: ['./tlm-stats-modal-v2.component.css']
})
export class TlmStatsModalV2Component implements OnInit, OnDestroy {
  
  // Theme management
  isDarkTheme: boolean = false;
  private destroy$ = new Subject<void>();

  // Filter state
  filterState: FilterState = {
    tlmInstance: '',
    selectedRecons: [],
    selectedSetIds: [],
    dateRange: DateRange.ONE_DAY,
    availableRecons: [],
    availableSetIds: [],
    tlmInstanceLocked: false,
    reconLocked: false,
    setIdLocked: false,
    entryPoint: ''
  };

  // Loading states
  isLoadingSummary: boolean = false;
  isLoadingRecons: boolean = false;
  isLoadingSetIds: boolean = false;

  // Data
  dashboardSummary: DashboardSummary | null = null;

  // Error states
  hasSummaryError: boolean = false;

  // Constants
  DateRange = DateRange;

  constructor(
    public dialogRef: MatDialogRef<TlmStatsModalV2Component>,
    @Inject(MAT_DIALOG_DATA) public data: TlmStatsModalV2Data,
    private tlmStatsV2Service: TlmStatsV2Service,
    private themeService: ThemeService
  ) {
    this.dialogRef.disableClose = false;
    this.dialogRef.backdropClick().subscribe(() => {
      this.dialogRef.close();
    });
  }

  ngOnInit(): void {
    // Subscribe to theme changes
    this.themeService.getTheme()
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => {
        this.isDarkTheme = theme === 'dark';
      });

    // Initialize filter state based on entry point
    this.initializeFilterState();
    
    // Load initial data
    this.loadInitialData();
  }

  private initializeFilterState(): void {
    const tlmInstance = this.data.tlm_instance || this.data.rowData?.tlm_instance;
    
    this.filterState = {
      ...this.filterState,
      tlmInstance: tlmInstance,
      dateRange: DateRange.ONE_DAY,
      entryPoint: this.data.type
    };

    switch (this.data.type) {
      case 'set_id':
        // From set_id: tlm_instance & recon locked, only date range editable
        this.filterState.tlmInstanceLocked = true;
        this.filterState.reconLocked = true;
        this.filterState.setIdLocked = true;
        const reconValue = this.data.rowData?.agent_code || this.data.rowData?.recon;
        this.filterState.selectedRecons = reconValue ? [reconValue] : [];
        this.filterState.selectedSetIds = [this.data.value];
        // Populate available options with the locked values so they display properly
        this.filterState.availableRecons = reconValue ? [reconValue] : [];
        this.filterState.availableSetIds = [this.data.value];
        break;
        
      case 'recon':
        // From recon: tlm_instance & recon locked, set_id multi-select enabled
        this.filterState.tlmInstanceLocked = true;
        this.filterState.reconLocked = true;
        this.filterState.setIdLocked = false;
        this.filterState.selectedRecons = [this.data.value];
        // Populate available recons with the locked value
        this.filterState.availableRecons = [this.data.value];
        break;
        
      case 'tlm_instance':
        // From tlm_instance: only tlm locked, recon & set_id cascade filters
        this.filterState.tlmInstanceLocked = true;
        this.filterState.reconLocked = false;
        this.filterState.setIdLocked = false;
        break;
    }
  }

  private loadInitialData(): void {
    // Load all data initially
    this.loadAllData();
    
    // Load filter options if needed
    if (!this.filterState.reconLocked) {
      this.loadAvailableRecons();
    }
    
    if (!this.filterState.setIdLocked && this.filterState.selectedRecons.length > 0) {
      this.loadAvailableSetIds();
    }
  }

  private loadDashboardSummary(): void {
    this.isLoadingSummary = true;
    this.hasSummaryError = false;

    const params = {
      tlm_instance: this.filterState.tlmInstance,
      agent_code: this.filterState.selectedRecons.length > 0 ? this.filterState.selectedRecons : undefined,
      set_id: this.filterState.selectedSetIds.length > 0 ? this.filterState.selectedSetIds : undefined,
      date_range: this.filterState.dateRange,
      entry_point: this.filterState.entryPoint
    };

    this.tlmStatsV2Service.getDashboardSummary(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.status === 'success') {
            this.dashboardSummary = response.data;
          } else {
            this.hasSummaryError = true;
          }
          this.isLoadingSummary = false;
        },
        error: (error) => {
          console.error('Error loading dashboard summary:', error);
          this.hasSummaryError = true;
          this.isLoadingSummary = false;
        }
      });
  }

  private loadAvailableRecons(): void {
    this.isLoadingRecons = true;

    this.tlmStatsV2Service.getReconsForTlmInstance(this.filterState.tlmInstance)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.status === 'success') {
            this.filterState.availableRecons = response.data;
          }
          this.isLoadingRecons = false;
        },
        error: (error) => {
          console.error('Error loading available recons:', error);
          this.isLoadingRecons = false;
        }
      });
  }

  private loadAvailableSetIds(): void {
    if (this.filterState.selectedRecons.length === 0) {
      this.filterState.availableSetIds = [];
      return;
    }

    this.isLoadingSetIds = true;

    // For now, load set IDs for the first selected recon
    // In a full implementation, you might want to load for all selected recons
    const primaryRecon = this.filterState.selectedRecons[0];

    this.tlmStatsV2Service.getSetIdsForRecon(this.filterState.tlmInstance, primaryRecon)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.status === 'success') {
            this.filterState.availableSetIds = response.data;
          }
          this.isLoadingSetIds = false;
        },
        error: (error) => {
          console.error('Error loading available set IDs:', error);
          this.isLoadingSetIds = false;
        }
      });
  }

  // Event handlers
  onReconSelectionChange(selectedRecons: string[]): void {
    this.filterState.selectedRecons = selectedRecons;
    
    // Clear and reload set IDs when recon selection changes
    this.filterState.selectedSetIds = [];
    this.loadAvailableSetIds();
    
    // Don't reload data here - wait for Apply button
  }

  onSetIdSelectionChange(selectedSetIds: string[]): void {
    this.filterState.selectedSetIds = selectedSetIds;
    
    // Don't reload data here - wait for Apply button
  }

  onDateRangeChange(dateRange: DateRange): void {
    this.filterState.dateRange = dateRange;
    
    // Don't reload data here - wait for Apply button
  }

  onClearFilters(): void {
    // Reset filters while respecting locks
    if (!this.filterState.reconLocked) {
      this.filterState.selectedRecons = [];
    }
    if (!this.filterState.setIdLocked) {
      this.filterState.selectedSetIds = [];
      this.filterState.availableSetIds = [];
    }
    
    // Reset date range
    this.filterState.dateRange = DateRange.ONE_DAY;
    
    // Automatically apply after clearing to show updated results
    this.loadAllData();
  }

  onApplyFilters(): void {
    // Reload all data with current filters
    this.loadAllData();
  }
  
  private loadAllData(): void {
    // Load dashboard summary
    this.loadDashboardSummary();
    
    // Trigger refresh for tables by updating the filter state
    // The tables watch filterState changes via ngOnChanges
    // We need to create a new object reference to trigger change detection
    this.filterState = { ...this.filterState };
  }

  // Utility methods
  getModalTitle(): string {
    switch (this.data.type) {
      case 'set_id':
        return `TLM Dashboard - Set ID: ${this.data.value}`;
      case 'recon':
        return `TLM Dashboard - Recon: ${this.data.value}`;
      case 'tlm_instance':
        return `TLM Dashboard - Instance: ${this.data.value}`;
      default:
        return 'TLM Dashboard';
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.dialogRef.close();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}