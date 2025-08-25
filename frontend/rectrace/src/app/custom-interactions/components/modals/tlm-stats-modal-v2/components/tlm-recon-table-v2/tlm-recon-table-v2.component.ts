import { Component, Input, OnInit, OnDestroy, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AgGridAngular } from 'ag-grid-angular';
import { 
  ColDef, 
  GridOptions, 
  GridApi, 
  IServerSideGetRowsParams,
  IServerSideGetRowsRequest
} from 'ag-grid-community';

import { 
  TlmStatsV2Service, 
  MergedReconStats, 
  SsrmRequest, 
  DateRange 
} from '../../../../../../services/tlm-stats-v2.service';
import { FilterState } from '../../tlm-stats-modal-v2.component';

@Component({
  selector: 'app-tlm-recon-table-v2',
  templateUrl: './tlm-recon-table-v2.component.html',
  styleUrls: ['./tlm-recon-table-v2.component.css']
})
export class TlmReconTableV2Component implements OnInit, OnDestroy, OnChanges {
  
  @Input() filterState!: FilterState;
  @Input() isDarkTheme: boolean = false;
  
  @ViewChild('agGrid') agGrid!: AgGridAngular;
  
  private destroy$ = new Subject<void>();
  
  // Grid configuration
  gridApi!: GridApi;
  gridOptions: GridOptions;
  columnDefs: ColDef[];
  gridTheme: string = 'ag-theme-alpine';
  
  // Loading state
  isLoading: boolean = false;
  hasError: boolean = false;
  errorMessage: string = '';
  totalRows: number = 0;

  constructor(private tlmStatsV2Service: TlmStatsV2Service) {
    // Column definitions
    this.columnDefs = [
      {
        field: 'tlm_instance',
        headerName: 'TLM Instance',
        width: 120,
        resizable: true,
        sortable: true,
        filter: 'agTextColumnFilter'
      },
      {
        field: 'agent_code',
        headerName: 'Agent Code',
        width: 130,
        resizable: true,
        sortable: true,
        filter: 'agTextColumnFilter'
      },
      {
        field: 'setid',
        headerName: 'Set ID',
        width: 180,
        resizable: true,
        sortable: true,
        filter: 'agTextColumnFilter'
      },
      {
        field: 'stmt_date',
        headerName: 'Statement Date',
        width: 140,
        resizable: true,
        sortable: true,
        filter: 'agDateColumnFilter',
        valueFormatter: params => this.formatDate(params.value)
      },
      {
        field: 'bran_code',
        headerName: 'Branch Code',
        width: 120,
        resizable: true,
        sortable: true,
        filter: 'agTextColumnFilter'
      },
      {
        field: 'corr_acc_no',
        headerName: 'Corr Account',
        width: 150,
        resizable: true,
        sortable: true,
        filter: 'agTextColumnFilter'
      },
      {
        field: 'total_items',
        headerName: 'Total Items',
        width: 120,
        resizable: true,
        sortable: true,
        filter: 'agNumberColumnFilter',
        cellClass: 'text-right',
        valueFormatter: params => params.value !== null && params.value !== undefined 
          ? params.value.toLocaleString() : '0'
      },
      {
        field: 'automatch_items',
        headerName: 'Automatch Items',
        width: 140,
        resizable: true,
        sortable: true,
        filter: 'agNumberColumnFilter',
        cellClass: 'text-right',
        valueFormatter: params => params.value !== null && params.value !== undefined 
          ? params.value.toLocaleString() : '0'
      },
      {
        field: 'total_manual_match_count',
        headerName: 'Manual Match Count',
        width: 160,
        resizable: true,
        sortable: true,
        filter: 'agNumberColumnFilter',
        cellClass: 'text-right',
        valueFormatter: params => params.value !== null && params.value !== undefined 
          ? params.value.toLocaleString() : '0'
      }
    ];

    // Grid options
    this.gridOptions = {
      columnDefs: this.columnDefs,
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 100
      },
      rowModelType: 'serverSide',
      cacheBlockSize: 100,
      maxConcurrentDatasourceRequests: 1,
      blockLoadDebounceMillis: 300,
      animateRows: true,
      suppressRowClickSelection: true,
      suppressCellFocus: true,
      enableCellTextSelection: true,
      ensureDomOrder: true,
      onGridReady: (params) => {
        this.gridApi = params.api;
        this.updateGridTheme();
      },
      onFirstDataRendered: () => {
        this.autoSizeColumns();
      }
    };
  }

  ngOnInit(): void {
    this.updateGridTheme();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isDarkTheme']) {
      this.updateGridTheme();
    }
    
    if (changes['filterState'] && this.gridApi) {
      this.refreshData();
    }
  }

  onGridReady(params: any): void {
    this.gridApi = params.api;
    this.setupServerSideDatasource();
    this.updateGridTheme();
  }

  private setupServerSideDatasource(): void {
    const datasource = {
      getRows: (params: IServerSideGetRowsParams) => {
        this.isLoading = true;
        this.hasError = false;

        const request = this.createSsrmRequest(params.request);
        
        this.tlmStatsV2Service.getReconTableData(request)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => this.isLoading = false)
          )
          .subscribe({
            next: (response) => {
              if (response.status === 'success') {
                this.totalRows = response.lastRow || 0;
                params.success({
                  rowData: response.data,
                  rowCount: response.lastRow
                });
              } else {
                this.handleError('Failed to load reconciliation data', params);
              }
            },
            error: (error) => {
              console.error('Error loading reconciliation data:', error);
              this.handleError('Error loading reconciliation data', params);
            }
          });
      }
    };

    // (this.gridApi as any).setServerSideDatasource(datasource);
    (this.gridApi as any).setGridOption('serverSideDatasource', datasource);
  }

  private createSsrmRequest(request: IServerSideGetRowsRequest): SsrmRequest {
    return this.tlmStatsV2Service.createSsrmRequest({
      startRow: request.startRow || 0,
      endRow: request.endRow || 100,
      tlmInstance: this.filterState.tlmInstance,
      agentCodes: this.filterState.selectedRecons.length > 0 ? this.filterState.selectedRecons : undefined,
      setIds: this.filterState.selectedSetIds.length > 0 ? this.filterState.selectedSetIds : undefined,
      dateRange: this.filterState.dateRange,
      sortModel: request.sortModel,
      filterModel: request.filterModel
    });
  }

  private handleError(message: string, params: IServerSideGetRowsParams): void {
    this.hasError = true;
    this.errorMessage = message;
    params.fail();
  }

  private updateGridTheme(): void {
    this.gridTheme = this.isDarkTheme ? 'ag-theme-alpine-dark' : 'ag-theme-alpine';
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

  private autoSizeColumns(): void {
    if (this.gridApi) {
      const allColumnIds: string[] = [];
      this.gridApi.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });
      
      if (allColumnIds.length > 0) {
        this.gridApi.autoSizeColumns(allColumnIds);
      }
    }
  }

  // Public methods
  refreshData(): void {
    if (this.gridApi) {
      this.setupServerSideDatasource();
    }
  }

  exportData(): void {
    if (!this.gridApi) return;

    this.isLoading = true;
    
    // Create export request without pagination
    const exportRequest = this.tlmStatsV2Service.createSsrmRequest({
      startRow: 0,
      endRow: Number.MAX_SAFE_INTEGER,
      tlmInstance: this.filterState.tlmInstance,
      agentCodes: this.filterState.selectedRecons.length > 0 ? this.filterState.selectedRecons : undefined,
      setIds: this.filterState.selectedSetIds.length > 0 ? this.filterState.selectedSetIds : undefined,
      dateRange: this.filterState.dateRange
    });

    this.tlmStatsV2Service.exportReconData(exportRequest)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          if (response.status === 'success') {
            this.downloadExcel(response.data, 'reconciliation-statistics');
          }
        },
        error: (error) => {
          console.error('Error exporting reconciliation data:', error);
        }
      });
  }

  private downloadExcel(data: MergedReconStats[], filename: string): void {
    // Convert data to CSV format for Excel compatibility
    if (data.length === 0) return;

    const headers = [
      'TLM Instance', 'Agent Code', 'Set ID', 'Statement Date', 'Branch Code', 
      'Corr Account', 'Total Items', 'Automatch Items', 'Manual Match Count'
    ];
    
    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        `"${row.tlm_instance || ''}"`,
        `"${row.agent_code || ''}"`,
        `"${row.setid || ''}"`,
        `"${this.formatDate(row.stmt_date)}"`,
        `"${row.bran_code || ''}"`,
        `"${row.corr_acc_no || ''}"`,
        row.total_items || 0,
        row.automatch_items || 0,
        row.total_manual_match_count || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Getters for template
  get hasData(): boolean {
    return this.totalRows > 0;
  }

  get statusMessage(): string {
    if (this.isLoading) return 'Loading reconciliation data...';
    if (this.hasError) return this.errorMessage;
    if (!this.hasData) return 'No reconciliation data found';
    return `Showing ${this.totalRows.toLocaleString()} reconciliation records`;
  }
}