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
  isExporting = false;  // Track export status
  expandedGroupIds: Set<string> = new Set();  // Track expanded groups
  private columnVisibilityTimer: any;  // Timer for column visibility changes
  private lastFilterModel: string = '';  // Track last filter to avoid duplicate refreshes
  private shouldRestoreState = false;  // Flag to indicate state should be restored after next load
  
  // Define frontend-only columns that don't exist in database
  private readonly FRONTEND_ONLY_COLUMNS = new Set([
    'execution_order',
    'actions',
    'ag-Grid-AutoColumn',  // AG-Grid's auto-generated group column
    // Add other non-DB columns here as needed
  ]);
  
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
      filter: col.filter !== false ? 'agTextColumnFilter' : false,  // Use text filter for all columns
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true,
        suppressAndOrCondition: true,  // Simplify filter UI
        refreshValuesOnOpen: false,  // Don't refresh on open
        debounceMs: 0  // We handle debouncing ourselves
      },
      resizable: col.resizable !== false,
      width: col.width,
      cellRenderer: col.cellRenderer,
      cellRendererParams: col.cellRendererParams,
      cellStyle: col.cellStyle,
      pinned: col.pinned as any,
      suppressMenu: false,  // Enable column menu for visibility toggling
      menuTabs: ['generalMenuTab', 'columnsMenuTab']  // Include columns tab for visibility control
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
      suppressServerSideInfiniteScroll: false,
      components: {
        appIDCellRenderer: AppIDCellRendererComponent,
        supportEmailCellRenderer: AppSupportCellRendererComponent,
        executionOrderButtonRenderer: ExecutionOrderButtonComponent,
        reconCellRenderer: ReconCellRendererComponent,
        setIdCellRenderer: SetIdCellRendererComponent
      },
      onGridReady: this.onGridReady.bind(this),
      onFilterChanged: this.onFilterChanged.bind(this),
      onColumnVisible: this.onColumnVisibilityChanged.bind(this),
      onRowGroupOpened: this.onRowGroupOpened.bind(this),
      getRowId: (params) => {
        // Simple approach: use JSON stringification of the entire row data
        // This ensures uniqueness since each row should have some different combination of values
        if (params.data) {
          // For SSRM, AG-Grid provides a unique nodeId we can use
          if (params.context && params.context.nodeId) {
            return params.context.nodeId.toString();
          }
          
          // Create a unique ID by stringifying the whole data object
          // This guarantees uniqueness as long as rows have some differences
          const dataString = JSON.stringify(params.data);
          
          // Create a simple hash to keep the ID shorter
          let hash = 0;
          for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          
          // Add a timestamp component to ensure uniqueness even for identical rows
          return `row_${Math.abs(hash)}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  
  onFilterChanged(): void {
    if (this.gridApi) {
      const currentFilterModel = JSON.stringify(this.gridApi.getFilterModel() || {});
      
      if (currentFilterModel !== this.lastFilterModel) {
        this.lastFilterModel = currentFilterModel;
        // Set flag to restore expanded state after AG-Grid's automatic refresh
        this.shouldRestoreState = true;
      }
    }
  }
  
  onRowGroupOpened(event: any): void {
    // Track expanded state in real-time as users expand/collapse groups
    if (!event || !event.node) {
      return;
    }
    
    const node = event.node;
    
    // Build the full path for this node
    let groupPath: string[] = [];
    let currentNode = node;
    
    while (currentNode) {
      if (currentNode.key) {
        groupPath.unshift(currentNode.key);
      }
      currentNode = currentNode.parent;
    }
    
    if (groupPath.length > 0) {
      const groupId = groupPath.join('|');
      
      if (node.expanded) {
        this.expandedGroupIds.add(groupId);
      } else {
        this.expandedGroupIds.delete(groupId);
      }
    }
  }
  
  onColumnVisibilityChanged(event: any): void {
    // Only trigger refresh if this is a user-initiated column visibility change
    // Check if the event source is from column menu (not from group expansion)
    if (!event || !event.column || event.source === 'gridInitializing') {
      return;
    }
    
    // Skip if this is the auto-generated group column
    const columnId = event.column.getColId();
    if (columnId === 'ag-Grid-AutoColumn' || this.FRONTEND_ONLY_COLUMNS.has(columnId)) {
      return;
    }
    
    // Clear any existing timer
    if (this.columnVisibilityTimer) {
      clearTimeout(this.columnVisibilityTimer);
    }
    
    // Set a new timer to refresh after column changes stabilize
    this.columnVisibilityTimer = setTimeout(() => {
      if (this.gridApi) {
        // Set flag to restore state after refresh
        this.shouldRestoreState = true;
        
        // Refresh the grid to apply SELECT DISTINCT with new visible columns
        this.gridApi.refreshServerSide({
          purge: true,
          route: []
        });
      }
    }, 500); // Wait 500ms after last column change
  }
  
  createSSRMDatasource(): IServerSideDatasource {
    return {
      getRows: async (params: IServerSideGetRowsParams) => {
        try {
          
          // Get the search column from the first column that's row grouped
          const searchColumnField = this.columns.find(col => col.rowGroup)?.field || this.searchColumn;
          
          // Convert AG-Grid filter model to our format
          const filterModel: any = {};
          if (params.request.filterModel) {
            const agFilterModel = params.request.filterModel as any;
            Object.keys(agFilterModel).forEach(field => {
              const agFilter = agFilterModel[field];
              if (agFilter && agFilter.filter) {
                filterModel[field] = {
                  filterType: agFilter.filterType || 'text',
                  type: agFilter.type || 'contains',
                  filter: agFilter.filter
                };
              }
            });
          }
          
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
            filterModel: filterModel,
            visibleColumns: this.getVisibleColumns()  // Add visible columns for SELECT DISTINCT
          };
          
          const response = await this.searchService.fetchSSRMData(request).toPromise();
          
          if (response) {
            params.success({
              rowData: response.rows,
              rowCount: response.lastRow
            });
            
            // Restore expanded groups after root level loads if flag is set
            const isRootLevel = !params.request.groupKeys || params.request.groupKeys.length === 0;
            const hasGroups = params.request.rowGroupCols && params.request.rowGroupCols.length > 0;
            
            if (isRootLevel && hasGroups && this.shouldRestoreState && this.expandedGroupIds.size > 0) {
              // Reset flag
              this.shouldRestoreState = false;
              
              // Delay to ensure nodes are rendered
              setTimeout(() => {
                this.restoreExpandedState();
              }, 100);
            }
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
    // Get current filter model from grid
    const currentFilterModel = this.gridApi ? this.gridApi.getFilterModel() : {};
    
    // Convert AG-Grid filter model to our format
    const filterModel: any = {};
    if (currentFilterModel) {
      Object.keys(currentFilterModel).forEach(field => {
        const agFilter = (currentFilterModel as any)[field];
        if (agFilter && agFilter.filter) {
          filterModel[field] = {
            filterType: agFilter.filterType || 'text',
            type: agFilter.type || 'contains',
            filter: agFilter.filter
          };
        }
      });
    }
    
    // Get the grouped column first, then other visible columns
    const groupedColumn = this.columns.find(col => col.rowGroup)?.field;
    const exportColumns: string[] = [];
    
    // Add grouped column first if it exists
    if (groupedColumn) {
      exportColumns.push(groupedColumn);
    }
    
    // Add other visible columns (excluding the grouped one to avoid duplicates)
    this.columns
      .filter(col => !col.hide && col.field !== groupedColumn)
      .forEach(col => {
        if (col.field) {
          exportColumns.push(col.field);
        }
      });
    
    const request = {
      category: this.category,
      initialFilter: {
        column: this.searchColumn,
        values: this.initialFilter
      },
      columns: exportColumns,
      filterModel: filterModel
    };
    
    // Set loading state
    this.isExporting = true;
    
    // Show loading overlay on grid
    if (this.gridApi) {
      this.gridApi.showLoadingOverlay();
    }
    
    this.searchService.exportData(this.category, request).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.category}_export_${new Date().getTime()}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        
        // Clear loading state
        this.isExporting = false;
        if (this.gridApi) {
          this.gridApi.hideOverlay();
        }
      },
      error: (error) => {
        console.error('Export failed', error);
        alert('Export failed. Please try again.');
        
        // Clear loading state
        this.isExporting = false;
        if (this.gridApi) {
          this.gridApi.hideOverlay();
        }
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
  
  private restoreExpandedState(): void {
    if (!this.gridApi || this.expandedGroupIds.size === 0) {
      return;
    }
    
    const groupsToRestore = new Set(this.expandedGroupIds);
    
    // Iterate through all nodes and restore expansion state
    this.gridApi.forEachNode((node: any) => {
      if (node.group && !node.expanded) {
        // Build the path for this node
        let groupPath: string[] = [];
        let currentNode = node;
        
        while (currentNode) {
          if (currentNode.key) {
            groupPath.unshift(currentNode.key);
          }
          currentNode = currentNode.parent;
        }
        
        const groupId = groupPath.join('|');
        
        if (this.expandedGroupIds.has(groupId)) {
          node.setExpanded(true);
          groupsToRestore.delete(groupId);
        }
      }
    });
    
    // Remove groups that no longer exist from our tracking
    groupsToRestore.forEach(groupId => {
      this.expandedGroupIds.delete(groupId);
    });
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
  
  private getVisibleColumns(): string[] {
    const visibleCols: string[] = [];
    
    if (this.gridApi) {
      // Get all visible columns from grid state
      this.gridApi.getColumnState().forEach((col: any) => {
        if (!col.hide && col.colId && !this.FRONTEND_ONLY_COLUMNS.has(col.colId)) {
          visibleCols.push(col.colId);
        }
      });
    }
    
    // Always include grouped columns (even if hidden) to maintain grouping functionality
    this.columns.filter(c => c.rowGroup).forEach(col => {
      if (col.field && !visibleCols.includes(col.field) && !this.FRONTEND_ONLY_COLUMNS.has(col.field)) {
        visibleCols.push(col.field);
      }
    });
    
    return visibleCols;
  }
  
  ngOnDestroy(): void {
    // Clear any pending timers
    if (this.columnVisibilityTimer) {
      clearTimeout(this.columnVisibilityTimer);
    }
    
    // Cleanup grid
    if (this.gridApi) {
      this.gridApi.destroy();
    }
  }
}