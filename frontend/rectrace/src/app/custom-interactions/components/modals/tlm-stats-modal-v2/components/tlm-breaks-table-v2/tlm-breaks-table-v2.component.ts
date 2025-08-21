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
  BreakStatsV2, 
  SsrmRequest, 
  DateRange 
} from '../../../../../../services/tlm-stats-v2.service';
import { FilterState } from '../../tlm-stats-modal-v2.component';

@Component({
  selector: 'app-tlm-breaks-table-v2',
  templateUrl: './tlm-breaks-table-v2.component.html',
  styleUrls: ['./tlm-breaks-table-v2.component.css']
})
export class TlmBreaksTableV2Component implements OnInit, OnDestroy, OnChanges {
  
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
        field: 'breaks_count',
        headerName: 'Breaks Count',
        width: 140,
        resizable: true,
        sortable: true,
        filter: 'agNumberColumnFilter',
        cellClass: 'text-right',
        valueFormatter: params => params.value !== null && params.value !== undefined 
          ? params.value.toLocaleString() : '0'
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
        field: 'local_acc_no',
        headerName: 'Local Account No',
        width: 200,
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
        width: 130,
        resizable: true,
        sortable: true,
        filter: 'agTextColumnFilter'
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
        
        this.tlmStatsV2Service.getBreaksTableData(request)
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
                this.handleError('Failed to load breaks data', params);
              }
            },
            error: (error) => {
              console.error('Error loading breaks data:', error);
              this.handleError('Error loading breaks data', params);
            }
          });
      }
    };

    (this.gridApi as any).setServerSideDatasource(datasource);
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

    this.tlmStatsV2Service.exportBreaksData(exportRequest)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          if (response.status === 'success') {
            this.downloadExcel(response.data, 'breaks-statistics');
          }
        },
        error: (error) => {
          console.error('Error exporting breaks data:', error);
        }
      });
  }

  private downloadExcel(data: BreakStatsV2[], filename: string): void {
    // Convert data to CSV format for Excel compatibility
    if (data.length === 0) return;

    const headers = ['Breaks Count', 'Agent Code', 'Local Account No', 'Statement Date', 'Branch Code'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        row.breaks_count || 0,
        `"${row.agent_code || ''}"`,
        `"${row.local_acc_no || ''}"`,
        `"${this.formatDate(row.stmt_date)}"`,
        `"${row.bran_code || ''}"`
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
    if (this.isLoading) return 'Loading breaks data...';
    if (this.hasError) return this.errorMessage;
    if (!this.hasData) return 'No breaks data found';
    return `Showing ${this.totalRows.toLocaleString()} breaks records`;
  }
}