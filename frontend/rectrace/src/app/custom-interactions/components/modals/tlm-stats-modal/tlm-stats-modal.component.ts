import { Component, Inject, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { of } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridOptions, GridApi } from 'ag-grid-community';
import {
  TlmStatsService,
  BreakStatsData,
  AutomatchStatsData,
  ManualMatchStatsData,
  MergedStatsData
} from '../../../../services/tlm-stats.service';
import { ThemeService } from '../../../../services/theme.service';

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
export class TlmStatsModalComponent implements OnInit, OnDestroy {
  @ViewChild('mergedGrid') mergedGrid!: AgGridAngular;
  @ViewChild('breaksGrid') breaksGrid!: AgGridAngular;

  // Loading states
  isLoadingBreakStats: boolean = false;
  isLoadingAutomatchStats: boolean = false;
  isLoadingManualMatchStats: boolean = false;

  // Data
  mergedStatsData: MergedStatsData[] = [];
  breakStatsData: BreakStatsData[] = [];

  // For recon type: set_id list and selected set_id
  setIdList: string[] = [];
  selectedSetId: string | null = null;

  // Error states
  hasBreakStatsError: boolean = false;
  hasAutomatchStatsError: boolean = false;
  hasManualMatchStatsError: boolean = false;

  // Grid configurations
  mergedGridOptions: GridOptions;
  breaksGridOptions: GridOptions;
  
  mergedGridApi!: GridApi;
  breaksGridApi!: GridApi;
  
  // Theme management
  gridTheme: string = 'ag-theme-material';
  private destroy$ = new Subject<void>();

  // Column definitions for merged table
  mergedColumnDefs: ColDef[] = [
    { 
      field: 'tlm_instance', 
      headerName: 'TLM Instance',
      width: 120,
      resizable: true,
      sortable: true,
      filter: true
    },
    { 
      field: 'agent_code', 
      headerName: 'Agent Code',
      width: 120,
      resizable: true,
      sortable: true,
      filter: true
    },
    { 
      field: 'setid', 
      headerName: 'Set ID',
      width: 250,
      resizable: true,
      sortable: true,
      filter: true
    },
    { 
      field: 'stmt_date', 
      headerName: 'Statement Date',
      width: 130,
      resizable: true,
      sortable: true,
      filter: true,
      valueFormatter: params => this.formatDate(params.value)
    },
    { 
      field: 'bran_code', 
      headerName: 'Branch Code',
      width: 110,
      resizable: true,
      sortable: true,
      filter: true
    },
    { 
      field: 'corr_acc_no', 
      headerName: 'Corr Account',
      width: 150,
      resizable: true,
      sortable: true,
      filter: true
    },
    { 
      field: 'total_items', 
      headerName: 'Total Items',
      width: 110,
      resizable: true,
      sortable: true,
      filter: 'agNumberColumnFilter',
      cellClass: 'text-right',
      valueFormatter: params => params.value !== undefined ? params.value.toLocaleString() : ''
    },
    { 
      field: 'automatch_items', 
      headerName: 'Automatch Items',
      width: 140,
      resizable: true,
      sortable: true,
      filter: 'agNumberColumnFilter',
      cellClass: 'text-right',
      valueFormatter: params => params.value !== undefined ? params.value.toLocaleString() : ''
    },
    { 
      field: 'total_manual_match_count', 
      headerName: 'Manual Match Count',
      width: 160,
      resizable: true,
      sortable: true,
      filter: 'agNumberColumnFilter',
      cellClass: 'text-right',
      valueFormatter: params => params.value !== undefined ? params.value.toLocaleString() : ''
    }
  ];

  // Column definitions for breaks table
  breaksColumnDefs: ColDef[] = [
    { 
      field: 'breaks_count', 
      headerName: 'Breaks Count',
      width: 120,
      resizable: true,
      sortable: true,
      filter: 'agNumberColumnFilter',
      cellClass: 'text-right',
      valueFormatter: params => params.value ? params.value.toLocaleString() : '0'
    },
    { 
      field: 'agent_code', 
      headerName: 'Agent Code',
      width: 120,
      resizable: true,
      sortable: true,
      filter: true
    },
    { 
      field: 'local_acc_no', 
      headerName: 'Local Account No',
      width: 300,
      resizable: true,
      sortable: true,
      filter: true
    },
    { 
      field: 'bran_code', 
      headerName: 'Branch Code',
      width: 120,
      resizable: true,
      sortable: true,
      filter: true
    }
  ];

  constructor(
    public dialogRef: MatDialogRef<TlmStatsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TlmStatsModalData,
    private tlmStatsService: TlmStatsService,
    private snackBar: MatSnackBar,
    private themeService: ThemeService
  ) {
    this.dialogRef.disableClose = false;
    this.dialogRef.backdropClick().subscribe(() => {
      this.dialogRef.close();
    });

    // Initialize grid options
    this.mergedGridOptions = {
      columnDefs: this.mergedColumnDefs,
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true
      },
      animateRows: true,
      suppressRowClickSelection: true,
      enableCellTextSelection: true,
      ensureDomOrder: true,
      onGridReady: (params) => {
        this.mergedGridApi = params.api;
      }
    };

    this.breaksGridOptions = {
      columnDefs: this.breaksColumnDefs,
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true
      },
      animateRows: true,
      suppressRowClickSelection: true,
      enableCellTextSelection: true,
      ensureDomOrder: true,
      onGridReady: (params) => {
        this.breaksGridApi = params.api;
      }
    };
  }

  ngOnInit(): void {
    // Subscribe to theme changes
    this.themeService.getTheme()
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => {
        this.gridTheme = theme === 'dark' ? 'ag-theme-material-dark' : 'ag-theme-material';
      });
    
    this.loadStats();
  }

  private loadStats(): void {
    this.resetErrorStates();

    if (this.data.type === 'set_id') {
      this.loadStatsForSetId();
    } else {
      this.loadStatsForRecon();
    }
  }

  private loadStatsForSetId(): void {
    const tlmInstance = this.data.tlm_instance || this.data.rowData?.tlm_instance;
    
    // Load break stats
    this.loadBreakStats(tlmInstance, this.data.value, undefined);
    
    // Load automatch and manual match stats
    this.loadMergedStats(tlmInstance, this.data.value, undefined);
  }

  private loadStatsForRecon(): void {
    const tlmInstance = this.data.tlm_instance || this.data.rowData?.tlm_instance;
    
    // Load break stats
    this.loadBreakStats(tlmInstance, undefined, this.data.value);
    
    // Load automatch and manual match stats
    this.loadMergedStats(tlmInstance, undefined, this.data.value);
    
    // Also load set IDs for the sidebar
    this.loadSetIdList(tlmInstance, this.data.value);
  }

  private loadBreakStats(tlmInstance: string, localAccNo?: string, agentCode?: string): void {
    this.isLoadingBreakStats = true;
    this.hasBreakStatsError = false;

    const params: any = { tlm_instance: tlmInstance };
    if (localAccNo) params.local_acc_no = localAccNo;
    if (agentCode) params.agent_code = agentCode;

    this.tlmStatsService.getBreakStats(params).pipe(
      catchError(error => {
        this.hasBreakStatsError = true;
        this.showError('Failed to load break stats');
        return of(null);
      }),
      finalize(() => this.isLoadingBreakStats = false)
    ).subscribe(response => {
      if (response?.data) {
        this.breakStatsData = response.data;
        if (this.breaksGridApi) {
          this.breaksGridApi.setGridOption('rowData', this.breakStatsData);
        }
      }
    });
  }

  private loadMergedStats(tlmInstance: string, localAccNo?: string, agentCode?: string): void {
    this.isLoadingAutomatchStats = true;
    this.isLoadingManualMatchStats = true;
    
    const params: any = { tlm_instance: tlmInstance };
    if (localAccNo) params.local_acc_no = localAccNo;
    if (agentCode) params.agent_code = agentCode;

    // Load automatch stats
    const automatchObs = this.tlmStatsService.getAutomatchStats(params).pipe(
      catchError(error => {
        this.hasAutomatchStatsError = true;
        this.showError('Failed to load automatch stats');
        return of(null);
      }),
      finalize(() => this.isLoadingAutomatchStats = false)
    );

    // Load manual match stats
    const manualParams: any = {};
    if (localAccNo) manualParams.set_id = localAccNo;
    if (agentCode) manualParams.agent_code = agentCode;
    if (tlmInstance) manualParams.tlm_instance = tlmInstance;

    const manualObs = this.tlmStatsService.getManualMatchStats(manualParams).pipe(
      catchError(error => {
        this.hasManualMatchStatsError = true;
        this.showError('Failed to load manual match stats');
        return of(null);
      }),
      finalize(() => this.isLoadingManualMatchStats = false)
    );

    // Process both responses
    automatchObs.subscribe(automatchResponse => {
      manualObs.subscribe(manualResponse => {
        this.mergeStatsData(
          automatchResponse?.data || [],
          manualResponse?.data || []
        );
      });
    });
  }

  private mergeStatsData(automatchData: AutomatchStatsData[], manualData: ManualMatchStatsData[]): void {
    const mergedMap = new Map<string, MergedStatsData>();

    // Process automatch data
    automatchData.forEach(item => {
      const key = `${item.tlm_instance}_${item.agent_code}_${item.setid}_${item.stmt_date}_${item.bran_code}_${item.corr_acc_no}`;
      mergedMap.set(key, {
        tlm_instance: item.tlm_instance,
        agent_code: item.agent_code,
        setid: item.setid,
        stmt_date: item.stmt_date,
        bran_code: item.bran_code,
        corr_acc_no: item.corr_acc_no,
        total_items: item.total_items,
        automatch_items: item.automatch_items,
        total_manual_match_count: undefined
      });
    });

    // Merge manual match data
    manualData.forEach(item => {
      const key = `${item.tlm_instance}_${item.agent_code}_${item.setid}_${item.stmt_date}_${item.bran_code}_${item.corr_acc_no}`;
      const existing = mergedMap.get(key);
      
      if (existing) {
        existing.total_manual_match_count = item.total_manual_match_count;
      } else {
        mergedMap.set(key, {
          tlm_instance: item.tlm_instance,
          agent_code: item.agent_code,
          setid: item.setid,
          stmt_date: item.stmt_date,
          bran_code: item.bran_code,
          corr_acc_no: item.corr_acc_no,
          total_items: undefined,
          automatch_items: undefined,
          total_manual_match_count: item.total_manual_match_count
        });
      }
    });

    this.mergedStatsData = Array.from(mergedMap.values());
    
    if (this.mergedGridApi) {
      this.mergedGridApi.setGridOption('rowData', this.mergedStatsData);
    }
  }

  private loadSetIdList(tlmInstance: string, agentCode: string): void {
    const params = { tlm_instance: tlmInstance, agent_code: agentCode };

    // Load all three APIs to extract set IDs
    const breakStatsObs = this.tlmStatsService.getBreakStats(params).pipe(catchError(() => of(null)));
    const automatchObs = this.tlmStatsService.getAutomatchStats(params).pipe(catchError(() => of(null)));
    const manualObs = this.tlmStatsService.getManualMatchStats({ agent_code: agentCode }).pipe(catchError(() => of(null)));

    breakStatsObs.subscribe(breakResponse => {
      automatchObs.subscribe(automatchResponse => {
        manualObs.subscribe(manualResponse => {
          const setIdSet = new Set<string>();

          breakResponse?.data?.forEach(item => {
            if (item.local_acc_no) setIdSet.add(item.local_acc_no);
          });

          automatchResponse?.data?.forEach(item => {
            if (item.setid) setIdSet.add(item.setid);
          });

          manualResponse?.data?.forEach(item => {
            if (item.setid) setIdSet.add(item.setid);
          });

          this.setIdList = Array.from(setIdSet).sort();
        });
      });
    });
  }

  onSetIdSelected(setId: string): void {
    this.selectedSetId = setId;
    const tlmInstance = this.data.tlm_instance || this.data.rowData?.tlm_instance;
    
    // Reload stats for selected set ID
    this.loadBreakStats(tlmInstance, setId, undefined);
    this.loadMergedStats(tlmInstance, setId, undefined);
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

  private formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.dialogRef.close();
    }
  }

  getModalTitle(): string {
    if (this.data.type === 'set_id') {
      return `TLM Statistics - Set ID: ${this.data.value}`;
    } else {
      return `TLM Statistics - Agent Code: ${this.data.value}`;
    }
  }

  onMergedGridReady(params: any): void {
    this.mergedGridApi = params.api;
    
    if (this.mergedStatsData.length > 0) {
      this.mergedGridApi.setGridOption('rowData', this.mergedStatsData);
    }
  }

  onBreaksGridReady(params: any): void {
    this.breaksGridApi = params.api;
    
    if (this.breakStatsData.length > 0) {
      this.breaksGridApi.setGridOption('rowData', this.breakStatsData);
    }
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}