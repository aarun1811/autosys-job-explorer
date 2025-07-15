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

  @Output() duplicatesRemoved = new EventEmitter<string>();

  // Grid configuration from service
  components = this.gridConfigService.getComponents();
  sideBarConfig = this.gridConfigService.getSideBarConfig();
  defaultColDef = this.gridConfigService.getDefaultColDef();
  autoGroupColumnDef = this.gridConfigService.getAutoGroupColumnDef();

  // Grid API
  private gridApi!: GridApi<JobData | undefined | null>;

  // State from service
  isCompactView: boolean = false;
  isDeduplicated: boolean = false;
  originalRowData: (JobData | null | undefined)[] = [];
  isProgrammaticChange: boolean = false;

  // Bound event handlers
  private boundOnRowGroupOpened = this.onRowGroupOpened.bind(this);
  private boundOnFirstDataRendered = this.onFirstDataRendered.bind(this);
  private boundOnDocumentKeyDown = this.onDocumentKeyDown.bind(this);

  constructor(
    private readonly snackBar: MatSnackBar,
    private gridStateService: GridStateService,
    private gridActionsService: GridActionsService,
    private gridConfigService: GridConfigurationService
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
    setTimeout(() => event.api.autoSizeAllColumns(), 50);
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
