import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { GridApi, GridOptions, ColDef } from 'ag-grid-community';
import { QuickRecAutoMatchStats } from 'src/app/services/quickrec-stats.service';

@Component({
  selector: 'app-quickrec-automatch-table',
  templateUrl: './quickrec-automatch-table.component.html',
  styleUrls: ['./quickrec-automatch-table.component.css']
})
export class QuickRecAutomatchTableComponent implements OnInit, OnChanges {
  @Input() data: QuickRecAutoMatchStats[] = [];
  @Input() loading = false;
  
  gridOptions: GridOptions;
  gridApi!: GridApi;
  columnDefs: ColDef[];
  defaultColDef: ColDef;
  
  constructor() {
    this.columnDefs = [
      { 
        field: 'reconName', 
        headerName: 'Recon Name',
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 150
      },
      { 
        field: 'reconId', 
        headerName: 'Recon ID',
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 120
      },
      { 
        field: 'recPortalId', 
        headerName: 'Rec Portal ID',
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 120
      },
      { 
        field: 'leftRecordCount', 
        headerName: 'Left Records',
        sortable: true,
        filter: 'agNumberColumnFilter',
        resizable: true,
        minWidth: 120,
        type: 'numericColumn',
        valueFormatter: params => this.formatNumber(params.value)
      },
      { 
        field: 'rightRecordCount', 
        headerName: 'Right Records',
        sortable: true,
        filter: 'agNumberColumnFilter',
        resizable: true,
        minWidth: 120,
        type: 'numericColumn',
        valueFormatter: params => this.formatNumber(params.value)
      },
      { 
        field: 'leftBreakCount', 
        headerName: 'Left Breaks',
        sortable: true,
        filter: 'agNumberColumnFilter',
        resizable: true,
        minWidth: 120,
        type: 'numericColumn',
        cellClass: 'breaks-cell',
        valueFormatter: params => {
          const row = params.data as QuickRecAutoMatchStats;
          const percentage = this.getPercentage(params.value, row.leftRecordCount);
          return `${this.formatNumber(params.value)} (${percentage}%)`;
        }
      },
      { 
        field: 'rightBreakCount', 
        headerName: 'Right Breaks',
        sortable: true,
        filter: 'agNumberColumnFilter',
        resizable: true,
        minWidth: 120,
        type: 'numericColumn',
        cellClass: 'breaks-cell',
        valueFormatter: params => {
          const row = params.data as QuickRecAutoMatchStats;
          const percentage = this.getPercentage(params.value, row.rightRecordCount);
          return `${this.formatNumber(params.value)} (${percentage}%)`;
        }
      },
      { 
        field: 'leftMatchCount', 
        headerName: 'Left Matches',
        sortable: true,
        filter: 'agNumberColumnFilter',
        resizable: true,
        minWidth: 120,
        type: 'numericColumn',
        cellClass: 'matches-cell',
        valueFormatter: params => {
          const row = params.data as QuickRecAutoMatchStats;
          const percentage = this.getPercentage(params.value, row.leftRecordCount);
          return `${this.formatNumber(params.value)} (${percentage}%)`;
        }
      },
      { 
        field: 'rightMatchCount', 
        headerName: 'Right Matches',
        sortable: true,
        filter: 'agNumberColumnFilter',
        resizable: true,
        minWidth: 120,
        type: 'numericColumn',
        cellClass: 'matches-cell',
        valueFormatter: params => {
          const row = params.data as QuickRecAutoMatchStats;
          const percentage = this.getPercentage(params.value, row.rightRecordCount);
          return `${this.formatNumber(params.value)} (${percentage}%)`;
        }
      },
      { 
        field: 'loadDate', 
        headerName: 'Load Date',
        sortable: true,
        filter: 'agDateColumnFilter',
        resizable: true,
        minWidth: 150,
        valueFormatter: params => this.formatDate(params.value)
      }
    ];
    
    this.defaultColDef = {
      sortable: true,
      filter: true,
      resizable: true
    };
    
    this.gridOptions = {
      rowData: this.data,
      columnDefs: this.columnDefs,
      defaultColDef: this.defaultColDef,
      animateRows: true,
      pagination: true,
      paginationPageSize: 10,
      paginationPageSizeSelector: [10, 25, 50, 100],
      suppressCellFocus: false,
      enableCellTextSelection: true,
      domLayout: 'autoHeight',
      suppressHorizontalScroll: false,
      onGridReady: (params) => {
        this.gridApi = params.api;
        this.gridApi.sizeColumnsToFit();
      },
      onGridSizeChanged: (params) => {
        if (params.api) {
          params.api.sizeColumnsToFit();
        }
      }
    };
  }
  
  ngOnInit(): void {
    // Grid options are already initialized in constructor
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.gridApi) {
      this.gridApi.setGridOption('rowData', this.data || []);
    }
  }
  
  formatNumber(value: number): string {
    return value ? value.toLocaleString() : '0';
  }
  
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
  
  getPercentage(value: number, total: number): string {
    if (!total || total === 0) return '0.00';
    return ((value / total) * 100).toFixed(2);
  }
}