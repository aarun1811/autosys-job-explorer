import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { GridApi, GridOptions, ColDef } from 'ag-grid-community';
import { QuickRecManualMatchStats } from 'src/app/services/quickrec-stats.service';

@Component({
  selector: 'app-quickrec-manual-table',
  templateUrl: './quickrec-manual-table.component.html',
  styleUrls: ['./quickrec-manual-table.component.css']
})
export class QuickRecManualTableComponent implements OnInit, OnChanges {
  @Input() data: QuickRecManualMatchStats[] = [];
  @Input() loading = false;
  
  gridOptions: GridOptions;
  gridApi!: GridApi;
  columnDefs: ColDef[];
  defaultColDef: ColDef;
  
  constructor() {
    this.columnDefs = [
      { 
        field: 'recPortalId', 
        headerName: 'Rec Portal ID',
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 150
      },
      { 
        field: 'cob', 
        headerName: 'COB',
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 120
      },
      { 
        field: 'leftManualMatches', 
        headerName: 'Left Manual Matches',
        sortable: true,
        filter: 'agNumberColumnFilter',
        resizable: true,
        minWidth: 150,
        type: 'numericColumn',
        cellClass: 'manual-cell',
        valueFormatter: params => this.formatNumber(params.value)
      },
      { 
        field: 'rightManualMatches', 
        headerName: 'Right Manual Matches',
        sortable: true,
        filter: 'agNumberColumnFilter',
        resizable: true,
        minWidth: 150,
        type: 'numericColumn',
        cellClass: 'manual-cell',
        valueFormatter: params => this.formatNumber(params.value)
      },
      {
        headerName: 'Total Matches',
        sortable: true,
        filter: 'agNumberColumnFilter',
        resizable: true,
        minWidth: 120,
        type: 'numericColumn',
        cellClass: 'total-cell',
        valueGetter: params => {
          const left = params.data.leftManualMatches || 0;
          const right = params.data.rightManualMatches || 0;
          return left + right;
        },
        valueFormatter: params => this.formatNumber(params.value)
      },
      { 
        field: 'updatedDate', 
        headerName: 'Updated Date',
        sortable: true,
        filter: 'agDateColumnFilter',
        resizable: true,
        minWidth: 180,
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
}