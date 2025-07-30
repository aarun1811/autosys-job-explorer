import { Component, Input, OnChanges, OnInit, Output, SimpleChanges, EventEmitter, OnDestroy } from '@angular/core';
import type {
  GridApi,
  GridReadyEvent,
  RowGroupOpenedEvent,
  ColumnVisibleEvent as AgColumnVisibleEvent,
  FirstDataRenderedEvent,
  IFilter
} from 'ag-grid-enterprise';
import 'ag-grid-enterprise';
import { MatSnackBar } from '@angular/material/snack-bar';
import { JobData, SearchColumnDefinition } from '../../../models/job.model';
import { LicenseManager } from "ag-grid-enterprise";
import { SearchService } from '../../../services/search.service';

// Import our new services
import { GridStateService } from '../../services/grid-state.service';
import { GridActionsService } from '../../services/grid-actions.service';
import { GridConfigurationService } from '../../services/grid-configuration.service';

export interface ColumnVisibleEvent {
  categoryKey: string;
  columnField: string;
  isVisible: boolean;
}

interface FilterInstance extends IFilter {
  hidePopup?: () => void;
}

LicenseManager.setLicenseKey("license_value");

@Component({
  selector: 'app-all-jobs',
  templateUrl: './all-jobs.component.html',
  styleUrls: ['./all-jobs.component.css'],
})
export class AllJobsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() rowData: (JobData | null | undefined)[] = [];
  @Input() columnDefs: SearchColumnDefinition[] | undefined | null;
  @Input() categoryKey!: string;
  @Input() isGridLoading: boolean = false;
  @Input() currentQuery: string = ''; // Add current search query

  @Output() duplicatesRemoved = new EventEmitter<string>();
  @Output() groupExpanded = new EventEmitter<{groupKey: string, expandedData: any[], rowIndex?: number}>();

  // Grid configuration from service
  components = this.gridConfigService.getComponents();
  sideBarConfig = this.gridConfigService.getSideBarConfig();
  defaultColDef = this.gridConfigService.getDefaultColDef();
  autoGroupColumnDef = this.gridConfigService.getAutoGroupColumnDef(this);

  // SSRM Configuration
  rowModelType: 'serverSide' = 'serverSide';
  serverSideStoreType: 'partial' = 'partial';

  // Grid API
  private gridApi!: GridApi<JobData | undefined | null>;

  // State from service
  isCompactView: boolean = false;
  isDeduplicated: boolean = false;
  originalRowData: (JobData | null | undefined)[] = [];
  isProgrammaticChange: boolean = false;

  // SSRM State
  private currentSearchTerm: string = '';
  private currentCategory: string = '';
  private ssrmInitialized: boolean = false;
  private visibleColumns: string[] = [];
  private lastVisibleColumns: string[] = [];

  // Bound event handlers
  private boundOnFirstDataRendered = this.onFirstDataRendered.bind(this);
  private boundOnDocumentKeyDown = this.onDocumentKeyDown.bind(this);

  constructor(
    private readonly snackBar: MatSnackBar,
    private gridStateService: GridStateService,
    private gridActionsService: GridActionsService,
    private gridConfigService: GridConfigurationService,
    private searchService: SearchService
  ) {}

  ngOnInit(): void {
    if (this.rowData && this.rowData.length > 0) {
      this.originalRowData = [...this.rowData];
      this.gridStateService.setOriginalRowData(this.originalRowData);
    }
    document.addEventListener('keydown', this.boundOnDocumentKeyDown);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rowData'] && this.gridApi) {
      this.isDeduplicated = false;
      this.gridStateService.setDeduplicated(false);
      this.originalRowData = this.rowData ? [...this.rowData] : [];
      this.gridStateService.setOriginalRowData(this.originalRowData);
    }

    if (changes['isGridLoading'] && this.gridApi) {
      if (this.isGridLoading) {
        this.gridApi.showLoadingOverlay();
      } else {
        this.gridApi.hideOverlay();
      }
    }

    // Update SSRM state when search parameters change
    if (changes['currentQuery']) {
      this.currentSearchTerm = this.currentQuery;
      this.initializeSSRM();
    }

    if (changes['categoryKey']) {
      this.currentCategory = this.categoryKey;
      this.initializeSSRM();
    }

    // Initialize visible columns when columnDefs change
    if (changes['columnDefs'] && this.columnDefs) {
      // Include both visible columns and row group columns
      this.visibleColumns = this.columnDefs
        .filter(col => (!col.hide || col.rowGroup) && col.field !== 'execution_order')
        .map(col => col.field)
        .filter(field => field !== undefined) as string[];
      this.lastVisibleColumns = [...this.visibleColumns];
      console.log('Initial visible columns (including row groups, excluding execution_order):', this.visibleColumns);
    }
  }

  /**
   * Create SSRM datasource for AG Grid
   */
  createSSRMDatasource() {
    return {
      getRows: async (params: any) => {
        try {
          console.log('SSRM getRows called with params:', params);
          console.log('Category:', this.currentCategory, 'SearchTerm:', this.currentSearchTerm);
          console.log('Visible columns:', this.visibleColumns);

          // Only show loading overlay for initial data load, not for group expansion
          const isGroupExpansion = params.request.groupKeys && params.request.groupKeys.length > 0;
          if (this.gridApi && !isGroupExpansion) {
            this.gridApi.showLoadingOverlay();
          }

          // Fetch data from backend
          const response = await this.searchService.fetchSSRMDataForCategory(
            params,
            this.currentCategory,
            this.currentSearchTerm,
            this.visibleColumns
          ).toPromise();

          console.log('SSRM response:', response);

          if (response && response.success) {
            // Supply data to grid
            params.success({
              rowData: response.rows,
              rowCount: response.lastRow
            });
          } else {
            // Handle error
            params.fail();
            console.error('SSRM request failed:', response?.error);
          }
        } catch (error) {
          console.error('Error in SSRM getRows:', error);
          params.fail();
        } finally {
          // Hide loading overlay only for initial data load
          const isGroupExpansion = params.request.groupKeys && params.request.groupKeys.length > 0;
          if (this.gridApi && !isGroupExpansion) {
            this.gridApi.hideOverlay();
          }
        }
      }
    };
  }

  /**
   * Initialize SSRM datasource when search parameters are available
   */
  private initializeSSRM(): void {
    if (this.gridApi && this.currentSearchTerm && this.currentCategory && !this.ssrmInitialized) {
      console.log('Initializing SSRM for category:', this.currentCategory, 'searchTerm:', this.currentSearchTerm);
      this.ssrmInitialized = true;
      (this.gridApi as any).setGridOption('serverSideDatasource', this.createSSRMDatasource());
    }
  }

  /**
   * Get all required columns including row group columns
   * This ensures we fetch data for grouped columns even if they're hidden
   */
  private getAllRequiredColumns(): string[] {
    if (!this.gridApi) {
      return this.visibleColumns;
    }

    const columnState = this.gridApi.getColumnState();
    const requiredColumns: string[] = [];

    columnState.forEach(state => {
      if (state.colId && (
        !state.hide || // Visible columns
        state.rowGroup // Row group columns (even if hidden)
      )) {
        // Exclude execution_order column as it's just for display purposes
        if (state.colId !== 'execution_order') {
          requiredColumns.push(state.colId);
        }
      }
    });

    return requiredColumns;
  }

  /**
   * Handle column visibility changes
   * Only re-fetch data when columns are unhidden and we need to fetch data again
   */
  onColumnVisibilityChange(visibleColumns: string[]): void {
    console.log('Column visibility changed:', visibleColumns);

    // Get all required columns including row group columns
    const allRequiredColumns = this.getAllRequiredColumns();
    console.log('All required columns (including row groups):', allRequiredColumns);

    // Check if any columns were unhidden (added to visible columns)
    const newlyVisibleColumns = visibleColumns.filter(col => !this.lastVisibleColumns.includes(col));

    if (newlyVisibleColumns.length > 0) {
      console.log('Columns unhidden, re-fetching data:', newlyVisibleColumns);

      // Show loading overlay
      if (this.gridApi) {
        this.gridApi.showLoadingOverlay();
      }

      // Update visible columns to include all required columns
      this.visibleColumns = allRequiredColumns;
      this.lastVisibleColumns = [...visibleColumns];

      // Re-fetch data with new visible columns
      this.refreshSSRMData();
    } else {
      // Just hiding columns - update tracking but keep all required columns
      this.visibleColumns = allRequiredColumns;
      this.lastVisibleColumns = [...visibleColumns];
    }
  }

  /**
   * Refresh SSRM data with current parameters
   */
  private refreshSSRMData(): void {
    if (this.gridApi && this.currentSearchTerm && this.currentCategory) {
      console.log('Refreshing SSRM data with visible columns:', this.visibleColumns);
      (this.gridApi as any).setGridOption('serverSideDatasource', this.createSSRMDatasource());
    }
  }

  ngOnDestroy(): void {
    if (this.gridApi) {
      this.gridApi.removeEventListener('firstDataRendered', this.boundOnFirstDataRendered);
      this.gridApi.removeEventListener('columnVisible', this.onColumnVisibilityChanged.bind(this));
    }
    document.removeEventListener('keydown', this.boundOnDocumentKeyDown);
  }

  onGridReady(params: GridReadyEvent<JobData | undefined | null>) {
    this.gridApi = params.api;

    // Set up event listeners
    this.gridApi.addEventListener('firstDataRendered', this.boundOnFirstDataRendered);
    this.gridApi.addEventListener('columnVisible', this.onColumnVisibilityChanged.bind(this));

    // Initialize SSRM if we have search parameters
    if (this.currentSearchTerm && this.currentCategory) {
      this.initializeSSRM();
    }
  }

  /**
   * Handle column visibility changes from AG Grid events
   */
  private onColumnVisibilityChanged(event: any): void {
    // Get current visible columns
    const currentVisibleColumns = this.gridApi.getColumnState()
      .filter(state => !state.hide && state.colId)
      .map(state => state.colId as string)
      .filter(field => field !== undefined);

    // Get all required columns including row group columns
    const allRequiredColumns = this.getAllRequiredColumns();

    // Check if columns were unhidden
    const newlyVisibleColumns = currentVisibleColumns.filter(col => !this.lastVisibleColumns.includes(col));

    if (newlyVisibleColumns.length > 0) {
      console.log('Column visibility changed - columns unhidden:', newlyVisibleColumns);
      console.log('All required columns (including row groups):', allRequiredColumns);
      this.onColumnVisibilityChange(currentVisibleColumns);
    } else {
      // Just hiding columns - update tracking but keep all required columns
      this.visibleColumns = allRequiredColumns;
      this.lastVisibleColumns = [...currentVisibleColumns];
    }
  }

  private onFirstDataRendered(event: FirstDataRenderedEvent) {
    setTimeout(() => event.api.autoSizeAllColumns(), 0);
  }

  private onDocumentKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const activeElement = document.activeElement;
      if (this.gridApi && activeElement instanceof HTMLElement && activeElement.tagName === 'INPUT' && activeElement.closest('.ag-filter-wrapper')) {
        const columnDefs = this.gridApi.getColumnDefs();
        if (columnDefs) {
          columnDefs.forEach(colDef => {
            const field = (colDef as any).field;
            if (typeof field === 'string') {
              const filterInstance = this.gridApi.getFilterInstance(field);
              if (filterInstance) {
                (filterInstance as any).hidePopup();
              }
            }
          });
        }
      }
    }
  }

  // Grid action methods using services
  expandAllGroups(): void {
    this.gridActionsService.expandAllGroups(this.gridApi);
  }

  collapseAllGroups(): void {
    this.gridActionsService.collapseAllGroups(this.gridApi);
  }

  toggleColumns(): void {
    // First toggle the columns panel
    this.gridActionsService.toggleColumns(this.gridApi);

    // Listen for column visibility changes
    if (this.gridApi) {
      // Get current visible columns
      const currentVisibleColumns = this.gridApi.getColumnState()
        .filter(state => !state.hide && state.colId)
        .map(state => state.colId as string)
        .filter(field => field !== undefined);

      // Get all required columns including row group columns
      const allRequiredColumns = this.getAllRequiredColumns();

      // Check if columns were unhidden
      const newlyVisibleColumns = currentVisibleColumns.filter(col => !this.lastVisibleColumns.includes(col));

      if (newlyVisibleColumns.length > 0) {
        console.log('Columns unhidden, triggering re-fetch:', newlyVisibleColumns);
        console.log('All required columns (including row groups):', allRequiredColumns);
        this.onColumnVisibilityChange(currentVisibleColumns);
      }
    }
  }

  toggleDensity(): void {
    this.gridActionsService.toggleDensity(
      this.gridApi,
      this.isCompactView,
      (isCompact: boolean) => {
        this.isCompactView = isCompact;
        this.gridStateService.setCompactView(isCompact);
      }
    );
  }

  onExportClick(): void {
    this.gridActionsService.exportToExcel(this.gridApi, this.categoryKey);
  }

  copyToClipboard(): void {
    this.gridActionsService.copyToClipboard(this.gridApi);
  }

  removeDuplicates(): void {
    this.gridActionsService.removeDuplicates(
      this.gridApi,
      500,
      (categoryKey: string) => {
        this.duplicatesRemoved.emit(categoryKey);
        this.isDeduplicated = true;
        this.gridStateService.setDeduplicated(true);
      },
      this.categoryKey
    );
  }
}
