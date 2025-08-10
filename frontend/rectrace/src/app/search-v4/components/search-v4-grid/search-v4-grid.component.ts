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
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

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
  private filterChanged$ = new Subject<void>();  // Subject for debouncing
  private isRefreshing = false;  // Prevent concurrent refreshes
  
  constructor(private searchService: SearchServiceV4) {}
  
  ngOnInit(): void {
    this.setupGridOptions();
    
    // Set up debounced filter changes
    this.filterChanged$
      .pipe(debounceTime(300))  // Wait 300ms after last change
      .subscribe(() => {
        this.applyFilterChanges();
      });
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
        suppressAndOrCondition: true  // Simplify filter UI
      },
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
      onFilterChanged: this.onFilterChanged.bind(this),
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
    // Don't trigger if we're already refreshing (prevents double calls)
    if (!this.isRefreshing) {
      // Trigger debounced filter change
      this.filterChanged$.next();
    }
  }
  
  private applyFilterChanges(): void {
    // Prevent concurrent refreshes
    if (this.isRefreshing) {
      console.log('Refresh already in progress, skipping...');
      return;
    }
    
    this.isRefreshing = true;
    
    // Save expanded state before refresh
    this.saveExpandedState();
    
    if (this.gridApi) {
      // Try a targeted refresh first - only refresh root level
      // The expanded groups will be restored in the datasource getRows callback
      this.gridApi.refreshServerSide({
        purge: true,  // We still need to purge to handle removed groups
        route: [],    // Refresh from root
      });
      
      // Mark as not refreshing after a short delay
      // The expansion will happen in the datasource callback
      setTimeout(() => {
        this.isRefreshing = false;
      }, 300);
    } else {
      this.isRefreshing = false;
    }
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
            filterModel: filterModel
          };
          
          const response = await this.searchService.fetchSSRMData(request).toPromise();
          
          if (response) {
            console.log(`Received ${response.rows.length} rows, total: ${response.lastRow}`);
            
            params.success({
              rowData: response.rows,
              rowCount: response.lastRow
            });
            
            // Re-expand previously expanded groups after data loads
            // Handle multi-level grouping
            if (params.request.rowGroupCols && params.request.rowGroupCols.length > 0) {
              const currentDepth = params.request.groupKeys ? params.request.groupKeys.length : 0;
              const groupCol = params.request.rowGroupCols[currentDepth];
              const groupColField = typeof groupCol === 'string' ? groupCol : groupCol?.field;
              
              if (groupColField && typeof groupColField === 'string') {
                setTimeout(() => {
                  response.rows.forEach((row: any) => {
                    const groupValue = row[groupColField];
                    if (groupValue) {
                      // Build the group path for multi-level
                      const groupPath = [...(params.request.groupKeys || []), groupValue];
                      const groupId = groupPath.join('|'); // Use | as separator for multi-level
                      
                      if (this.expandedGroupIds.has(groupId)) {
                        const node = this.gridApi.getRowNode(groupValue);
                        if (node && node.group) {
                          console.log('Re-expanding group after load:', groupId);
                          node.setExpanded(true);
                        }
                      }
                    }
                  });
                }, 50);
              }
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
      // Save expanded state before clearing
      this.saveExpandedState();
      
      this.gridApi.setFilterModel(null);
      
      // The expansion will be restored in the datasource callback
      // No need to manually restore here
    }
  }
  
  private saveExpandedState(): void {
    this.expandedGroupIds.clear();
    if (this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.group && node.expanded) {
          // For multi-level grouping, build the full path
          let groupPath: string[] = [];
          let currentNode = node;
          
          // Walk up the tree to build the full path
          while (currentNode) {
            if (currentNode.key) {
              groupPath.unshift(currentNode.key); // Add to beginning
            }
            currentNode = currentNode.parent;
          }
          
          if (groupPath.length > 0) {
            const groupId = groupPath.join('|'); // Use | as separator
            console.log('Saving expanded group:', groupId);
            this.expandedGroupIds.add(groupId);
          }
        }
      });
      console.log('Saved expanded groups:', Array.from(this.expandedGroupIds));
    }
  }
  
  private restoreExpandedState(): void {
    if (this.gridApi && this.expandedGroupIds.size > 0) {
      console.log('Restoring expanded groups:', Array.from(this.expandedGroupIds));
      
      // Use onRowDataUpdated to ensure data is loaded before expanding
      const expandGroups = () => {
        this.gridApi.forEachNode((node: any) => {
          if (node.group) {
            const groupKey = node.key;
            if (groupKey && this.expandedGroupIds.has(groupKey)) {
              console.log('Expanding group:', groupKey);
              node.setExpanded(true);
            }
          }
        });
      };
      
      // Try to expand immediately
      expandGroups();
      
      // Also try again after a short delay in case nodes aren't ready
      setTimeout(() => expandGroups(), 100);
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
    // Cleanup subscriptions
    this.filterChanged$.complete();
    
    // Cleanup grid
    if (this.gridApi) {
      this.gridApi.destroy();
    }
  }
}