import { Component, Input, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { 
  GridOptions, 
  IServerSideDatasource, 
  IServerSideGetRowsParams,
  GridReadyEvent,
  ColDef
} from 'ag-grid-community';
import { 
  SearchServiceV4, 
  ColumnDefinition, 
  SSRMRequestV4 
} from '../../../services/search-v4.service';

// Import custom cell renderers
import { AppIDCellRendererComponent } from '../../../custom-interactions/components/renderers/app-id-cell-renderer.component';
import { AppSupportCellRendererComponent } from '../../../custom-interactions/components/renderers/app-support-cell-renderer.component';
import { ExecutionOrderButtonComponent } from '../../../custom-interactions/components/renderers/execution-order-button.component';
import { ReconCellRendererComponent } from '../../../custom-interactions/components/renderers/recon-cell-renderer.component';
import { SetIdCellRendererComponent } from '../../../custom-interactions/components/renderers/set-id-cell-renderer.component';

@Component({
  selector: 'app-search-v4-grid',
  templateUrl: './search-v4-grid.component.html',
  styleUrls: ['./search-v4-grid.component.css']
})
export class SearchV4GridComponent implements OnInit, OnDestroy {
  @Input() category!: string;
  @Input() categoryLabel!: string;
  @Input() initialFilter!: string[];  // ES results (max 1000)
  @Input() columns!: ColumnDefinition[];
  @Input() searchColumn!: string;
  
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  
  gridOptions: GridOptions = {};
  gridApi: any;
  gridColumnApi: any;
  
  constructor(private searchService: SearchServiceV4) {}
  
  ngOnInit(): void {
    this.setupGridOptions();
  }
  
  setupGridOptions(): void {
    // Convert column definitions to AG-Grid format
    const columnDefs: ColDef[] = this.columns.map(col => ({
      field: col.field,
      headerName: col.headerName,
      rowGroup: col.rowGroup || false,
      hide: col.hide || false,
      sortable: col.sortable !== false,
      filter: col.filter !== false,
      resizable: col.resizable !== false,
      width: col.width,
      cellRenderer: col.cellRenderer,
      cellRendererParams: col.cellRendererParams,
      cellStyle: col.cellStyle,
      pinned: col.pinned as any
    }));
    
    this.gridOptions = {
      columnDefs: columnDefs,
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 100,
        flex: 1
      },
      rowModelType: 'serverSide',
      cacheBlockSize: 100,
      maxBlocksInCache: 10,
      autoGroupColumnDef: {
        headerName: this.columns[0]?.headerName || 'Group',
        minWidth: 250,
        cellRendererParams: {
          suppressCount: false
        }
      },
      animateRows: true,
      suppressRowClickSelection: true,
      rowSelection: 'multiple',
      components: {
        appIDCellRenderer: AppIDCellRendererComponent,
        supportEmailCellRenderer: AppSupportCellRendererComponent,
        executionOrderButtonRenderer: ExecutionOrderButtonComponent,
        reconCellRenderer: ReconCellRendererComponent,
        setIdCellRenderer: SetIdCellRendererComponent
      },
      onGridReady: this.onGridReady.bind(this),
      getRowId: (params) => {
        // Generate unique row ID
        return params.data ? JSON.stringify(params.data) : Math.random().toString();
      }
    };
  }
  
  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.gridColumnApi = params.api;  // In newer versions, columnApi is part of api
    
    // Set up SSRM datasource
    const datasource = this.createSSRMDatasource();
    (this.gridApi as any).setGridOption('serverSideDatasource', datasource);
  }
  
  createSSRMDatasource(): IServerSideDatasource {
    return {
      getRows: async (params: IServerSideGetRowsParams) => {
        try {
          console.log('SSRM request for category:', this.category, 'Params:', {
            startRow: params.request.startRow,
            endRow: params.request.endRow,
            rowGroupCols: params.request.rowGroupCols,
            groupKeys: params.request.groupKeys
          });
          
          // Get the search column from the first column that's row grouped
          const searchColumnField = this.columns.find(col => col.rowGroup)?.field || this.searchColumn;
          
          const request: SSRMRequestV4 = {
            category: this.category,
            initialFilter: {
              column: searchColumnField,
              values: this.initialFilter  // Max 1000 values from ES
            },
            rowGroupCols: params.request.rowGroupCols?.map(col => col.field || col as any) || [],
            groupKeys: params.request.groupKeys || [],
            startRow: params.request.startRow || 0,
            endRow: params.request.endRow || 100,
            sortModel: params.request.sortModel || [],
            filterModel: {}  // Simplified for now
          };
          
          const response = await this.searchService.fetchSSRMData(request).toPromise();
          
          if (response) {
            console.log(`Received ${response.rows.length} rows, total: ${response.lastRow}`);
            
            params.success({
              rowData: response.rows,
              rowCount: response.lastRow
            });
          } else {
            params.fail();
          }
        } catch (error) {
          console.error('Failed to load SSRM data', error);
          params.fail();
        }
      }
    };
  }
  
  exportToExcel(): void {
    const request = {
      category: this.category,
      initialFilter: {
        column: this.searchColumn,
        values: this.initialFilter
      },
      columns: this.columns
        .filter(col => !col.hide)
        .map(col => col.field)
    };
    
    this.searchService.exportData(this.category, request).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.category}_export_${new Date().getTime()}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Export failed', error);
        alert('Export failed. Please try again.');
      }
    });
  }
  
  refreshGrid(): void {
    if (this.gridApi) {
      this.gridApi.refreshServerSide({ purge: true });
    }
  }
  
  clearFilters(): void {
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
    }
  }
  
  expandAll(): void {
    if (this.gridApi) {
      this.gridApi.expandAll();
    }
  }
  
  collapseAll(): void {
    if (this.gridApi) {
      this.gridApi.collapseAll();
    }
  }
  
  ngOnDestroy(): void {
    // Cleanup if needed
    if (this.gridApi) {
      this.gridApi.destroy();
    }
  }
}