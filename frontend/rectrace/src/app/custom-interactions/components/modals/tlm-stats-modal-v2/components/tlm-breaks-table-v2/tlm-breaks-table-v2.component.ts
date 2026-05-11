import { Component, Input, OnInit, OnDestroy, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridOptions,
  GridApi
} from 'ag-grid-community';

import {
  TlmStatsV2Service,
  BreakStatsV2,
  TlmStatsRequest,
  DateRange
} from '../../../../../../services/tlm-stats-v2.service';
import { FilterState } from '../../tlm-stats-modal-v2.component';

@Component({
  selector: 'app-tlm-breaks-table-v2',
  templateUrl: './tlm-breaks-table-v2.component.html',
  styleUrls: ['./tlm-breaks-table-v2.component.scss']
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

  // Status message
  get statusMessage(): string {
    if (this.isLoading) {
      return 'Loading data...';
    }
    if (this.hasError) {
      return this.errorMessage || 'Error loading data';
    }
    if (this.totalRows === 0) {
      return 'No data available';
    }
    return `${this.totalRows} record${this.totalRows === 1 ? '' : 's'} found`;
  }

  // Dynamic height calculation
  private readonly ROW_HEIGHT = 36; // AG-Grid row height
  private readonly HEADER_HEIGHT = 40; // AG-Grid header height
  private readonly MIN_ROWS = 3; // Minimum rows to show
  private readonly MAX_ROWS = 10; // Maximum rows to show

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
      rowModelType: 'clientSide',
      animateRows: true,
      suppressRowClickSelection: true,
      suppressCellFocus: true,
      enableCellTextSelection: true,
      ensureDomOrder: true,
      onGridReady: (params) => {
        this.gridApi = params.api;
        this.updateGridTheme();
        this.loadData();
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
    this.updateGridTheme();
    this.loadData();
  }

  private loadData(): void {
    if (!this.filterState?.tlmInstance) {
      return;
    }

    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    const request: TlmStatsRequest = this.tlmStatsV2Service.createTlmStatsRequest({
      tlmInstance: this.filterState.tlmInstance,
      agentCodes: this.filterState.selectedRecons.length > 0 ? this.filterState.selectedRecons : undefined,
      setIds: this.filterState.selectedSetIds.length > 0 ? this.filterState.selectedSetIds : undefined,
      dateRange: this.filterState.dateRange,
      entryPoint: this.filterState.entryPoint
    });

    this.tlmStatsV2Service.getBreaksTableData(request)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (response) => {
          if (response.status === 'success') {
            this.totalRows = response.count || response.data.length;
            this.gridApi?.setGridOption('rowData', response.data);
            this.calculateDynamicHeight();
          } else {
            this.hasError = true;
            this.errorMessage = 'Failed to load data';
            this.gridApi?.setGridOption('rowData', []);
          }
        },
        error: (error) => {
          console.error('Error loading breaks data:', error);
          this.hasError = true;
          this.errorMessage = 'Error loading data: ' + (error.message || 'Unknown error');
          this.gridApi?.setGridOption('rowData', []);
        }
      });
  }

  refreshData(): void {
    this.loadData();
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

  private calculateDynamicHeight(): void {
    // Calculate height based on actual row count
    let rowsToShow = Math.min(Math.max(this.totalRows || this.MIN_ROWS, this.MIN_ROWS), this.MAX_ROWS);
    const calculatedHeight = this.HEADER_HEIGHT + (rowsToShow * this.ROW_HEIGHT);

    const gridElement = document.querySelector('.breaks-grid-container');
    if (gridElement) {
      (gridElement as HTMLElement).style.height = `${calculatedHeight}px`;
    }
  }

  // Public methods
  getTableHeight(): string {
    // Calculate height based on actual row count
    let rowsToShow = this.totalRows || this.MIN_ROWS;
    rowsToShow = Math.min(Math.max(rowsToShow, this.MIN_ROWS), this.MAX_ROWS);

    const calculatedHeight = this.HEADER_HEIGHT + (rowsToShow * this.ROW_HEIGHT);
    return `${calculatedHeight}px`;
  }

  exportToExcel(): void {
    if (this.gridApi && this.totalRows > 0) {
      const params = {
        fileName: `tlm-breaks-${Date.now()}.xlsx`,
        sheetName: 'TLM Breaks',
        exportMode: 'xlsx',
        processHeaderCallback: (params: any) => params.column.getColDef().headerName,
        processRowGroupCallback: () => '',
        processCellCallback: (params: any) => {
          // Format dates and numbers for export
          if (params.column.getColId() === 'stmt_date' && params.value) {
            return this.formatDate(params.value);
          }
          if (params.column.getColId() === 'breaks_count' && params.value !== null && params.value !== undefined) {
            return params.value.toLocaleString();
          }
          return params.value;
        }
      };

      this.gridApi.exportDataAsExcel(params);
    }
  }

  hasData(): boolean {
    return this.totalRows > 0;
  }

  getRowCount(): number {
    return this.totalRows;
  }
}