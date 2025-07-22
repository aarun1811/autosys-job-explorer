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

  // Grid API
  private gridApi!: GridApi<JobData | undefined | null>;

  // State from service
  isCompactView: boolean = false;
  isDeduplicated: boolean = false;
  originalRowData: (JobData | null | undefined)[] = [];
  isProgrammaticChange: boolean = false;

  // Group expansion tracking
  private expandedGroups = new Set<string>();
  public loadingGroups = new Set<string>();

  // Bound event handlers
  private boundOnRowGroupOpened = this.onRowGroupOpened.bind(this);
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
  }

  ngOnDestroy(): void {
    if (this.gridApi) {
      this.gridApi.removeEventListener('rowGroupOpened', this.boundOnRowGroupOpened);
      this.gridApi.removeEventListener('firstDataRendered', this.boundOnFirstDataRendered);
    }
    document.removeEventListener('keydown', this.boundOnDocumentKeyDown);
  }

  onGridReady(params: GridReadyEvent<JobData | undefined | null>) {
    this.gridApi = params.api;

    if (this.rowData && this.rowData.length > 0 && this.originalRowData.length === 0) {
      this.originalRowData = [...this.rowData];
      this.gridStateService.setOriginalRowData(this.originalRowData);
    }

    if (this.isGridLoading) {
      this.gridApi.showLoadingOverlay();
    }

    this.gridApi.addEventListener('rowGroupOpened', this.boundOnRowGroupOpened);
    this.gridApi.addEventListener('firstDataRendered', this.boundOnFirstDataRendered);
  }

  private onFirstDataRendered(event: FirstDataRenderedEvent) {
    setTimeout(() => event.api.autoSizeAllColumns(), 0);
  }

  private onRowGroupOpened(event: RowGroupOpenedEvent) {
    // Auto-size columns
    setTimeout(() => event.api.autoSizeAllColumns(), 50);

    // Handle group expansion
    if (event.expanded) {
      const groupKey = event.node.key as string;
      const rowIndex = event.node.rowIndex === null ? undefined : event.node.rowIndex;
      // Check if we already have data for this group
      if (!this.expandedGroups.has(groupKey)) {
        this.expandGroup(groupKey, rowIndex);
      }
    }
  }

  private expandGroup(groupKey: string, rowIndex?: number): void {
    console.log('Expanding group:', groupKey);
    console.log('Current query:', this.currentQuery);
    console.log('Category key:', this.categoryKey);
    if (!this.currentQuery || !this.categoryKey) {
      console.warn('Cannot expand group: missing query or category');
      return;
    }
    // Mark group as expanded
    this.expandedGroups.add(groupKey);
    this.loadingGroups.add(groupKey);
    // Get visible column fields for the request
    const visibleColumns = this.getVisibleColumnFields();
    console.log('Visible columns:', visibleColumns);
    // Call the backend to expand the group
    this.searchService.expandGroup(
      this.currentQuery,
      this.categoryKey,
      groupKey,
      visibleColumns
    ).subscribe({
      next: (response) => {
        this.loadingGroups.delete(groupKey);
        console.log('Group expansion response:', response);
        // Update the grid data with expanded results
        this.updateGridDataWithExpandedGroup(groupKey, response, rowIndex);
      },
      error: (error) => {
        this.loadingGroups.delete(groupKey);
        console.error('Error expanding group:', error);
        this.snackBar.open('Failed to expand group. Please try again.', 'Close', {
          duration: 3000
        });
        // Remove from expanded groups on error
        this.expandedGroups.delete(groupKey);
      }
    });
  }

  private getVisibleColumnFields(): string[] {
    if (!this.columnDefs) return [];

    return this.columnDefs
      .filter(col => !col.hide)
      .map(col => col.field)
      .filter(field => field !== undefined) as string[];
  }

    private updateGridDataWithExpandedGroup(groupKey: string, response: any, rowIndex?: number): void {
    // Find the category data in the response
    const categoryData = response[this.categoryKey];
    if (!categoryData || !categoryData.data) {
      console.warn('No data found for category:', this.categoryKey);
      return;
    }
    // Emit the expanded data and rowIndex to parent component
    this.groupExpanded.emit({
      groupKey: groupKey,
      expandedData: categoryData.data,
      rowIndex: rowIndex
    });
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
