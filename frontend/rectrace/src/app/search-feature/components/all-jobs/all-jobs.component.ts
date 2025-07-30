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

          // Show loading state
          if (this.gridApi) {
            this.gridApi.showLoadingOverlay();
          }

          // Fetch data from backend
          const response = await this.searchService.fetchSSRMDataForCategory(
            params,
            this.currentCategory,
            this.currentSearchTerm
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
          // Hide loading state
          if (this.gridApi) {
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

  ngOnDestroy(): void {
    if (this.gridApi) {
      this.gridApi.removeEventListener('firstDataRendered', this.boundOnFirstDataRendered);
    }
    document.removeEventListener('keydown', this.boundOnDocumentKeyDown);
  }

  onGridReady(params: GridReadyEvent<JobData | undefined | null>) {
    this.gridApi = params.api;

    // Set up event listeners
    this.gridApi.addEventListener('firstDataRendered', this.boundOnFirstDataRendered);

    // Initialize SSRM if we have search parameters
    if (this.currentSearchTerm && this.currentCategory) {
      this.initializeSSRM();
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
    this.gridActionsService.toggleColumns(this.gridApi);
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
