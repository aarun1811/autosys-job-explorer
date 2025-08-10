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
        // Use the first column value as row ID for groups
        // This allows AG-Grid to track groups across refreshes
        if (params.data) {
          const firstColField = this.columns[0]?.field;
          if (firstColField && params.data[firstColField]) {
            return params.data[firstColField];
          }
        }
        return Math.random().toString();
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
            // This is for root level groups
            if (!params.request.groupKeys || params.request.groupKeys.length === 0) {
              setTimeout(() => {
                response.rows.forEach((row: any) => {
                  const firstColField = this.columns[0]?.field;
                  if (firstColField && row[firstColField]) {
                    const rowId = row[firstColField];
                    if (this.expandedGroupIds.has(rowId)) {
                      const node = this.gridApi.getRowNode(rowId);
                      if (node && node.group) {
                        console.log('Re-expanding group after load:', rowId);
                        node.setExpanded(true);
                      }
                    }
                  }
                });
              }, 50);
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
          // Store the group key - this is the actual value being grouped
          // For root level groups, the key is in node.key
          const groupKey = node.key;
          if (groupKey) {
            console.log('Saving expanded group:', groupKey);
            this.expandedGroupIds.add(groupKey);
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