import { Component, Input, OnChanges, OnInit, Output, SimpleChanges, EventEmitter, OnDestroy } from '@angular/core';
import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  SideBarDef,
  RowGroupOpenedEvent,
  ColumnVisibleEvent as AgColumnVisibleEvent,
  FirstDataRenderedEvent,
  IFilter
} from 'ag-grid-enterprise';
import 'ag-grid-enterprise';
import { ExecutionOrderButtonComponent } from '../../../custom-interactions/components/renderers/execution-order-button.component';
import { AppIDCellRendererComponent } from '../../../custom-interactions/components/renderers/app-id-cell-renderer.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { JobData, SearchColumnDefinition } from '../../../models/job.model';
import { AppSupportCellRendererComponent } from '../../../custom-interactions/components/renderers/app-support-cell-renderer.component';
import { LicenseManager } from "ag-grid-enterprise";

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

  @Output() columnVisibilityChanged = new EventEmitter<ColumnVisibleEvent>();
  @Output() duplicatesRemoved = new EventEmitter<string>();
  @Output() originalDataRestored = new EventEmitter<string>();

  components = {
    executionOrderButtonRenderer: ExecutionOrderButtonComponent,
    appIDCellRenderer: AppIDCellRendererComponent,
    supportEmailCellRenderer: AppSupportCellRendererComponent,
  };

  private gridApi!: GridApi<JobData | undefined | null>;
  isCompactView = false;
  isDeduplicated: boolean = false;
  private originalRowData: (JobData | null | undefined)[] = [];
  private isProgrammaticChange: boolean = false;

  private boundOnRowGroupOpened = this.onRowGroupOpened.bind(this);
  private boundOnAgColumnVisibilityChanged = this.onAgColumnVisibilityChanged.bind(this);
  private boundOnFirstDataRendered = this.onFirstDataRendered.bind(this);
  private boundOnDocumentKeyDown = this.onDocumentKeyDown.bind(this);

  sideBarConfig: SideBarDef = {
    toolPanels: [
      {id: 'columns', labelDefault: 'Columns', toolPanel: 'agColumnsToolPanel', labelKey: 'columnsToolPanelKey', iconKey: 'columns'},
      {id: 'filters', labelDefault: 'Filters', toolPanel: 'agFiltersToolPanel', labelKey: 'filtersToolPanelKey', iconKey: 'filter'}
    ],
    defaultToolPanel: ''
  };

  defaultColDef: ColDef<JobData | undefined | null> = {
    resizable: true,
    sortable: true,
    filter: true,
    enableRowGroup: true,
    filterParams: {
      buttons: ['apply', 'clear'],
      closeOnApply: true,
      debounceMs: 200
    },
  };

  autoGroupColumnDef: ColDef<JobData | undefined | null> = {
    headerName: 'Group',
    minWidth: 200,
    cellRendererParams: {
      suppressCount: true,
      innerRenderer: (params: any) => params.value
    }
  };

  constructor(private readonly snackBar: MatSnackBar) { }

  ngOnInit(): void {
    if (this.rowData && this.rowData.length > 0) {
      this.originalRowData = [...this.rowData];
    }
    document.addEventListener('keydown', this.boundOnDocumentKeyDown);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rowData'] && this.gridApi) { // Check gridApi to ensure it's ready
      this.isDeduplicated = false; // When parent sends new data, assume it's not deduplicated
      this.originalRowData = this.rowData ? [...this.rowData] : [];
      // AG-Grid updates automatically due to [rowData] binding.
      // If it was a programmatic change
      // AG-Grid would also pick it up.
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
      this.gridApi.removeEventListener('columnVisible', this.boundOnAgColumnVisibilityChanged);
      this.gridApi.removeEventListener('firstDataRendered', this.boundOnFirstDataRendered);
      // AG-Grid's destroy method 
    }
    document.removeEventListener('keydown', this.boundOnDocumentKeyDown);
  }

  onGridReady(params: GridReadyEvent<JobData | undefined | null>) {
    this.gridApi = params.api;

    if (this.rowData && this.rowData.length > 0 && this.originalRowData.length === 0) {
      this.originalRowData = [...this.rowData];
    }

    if (this.isGridLoading) { 
      this.gridApi.showLoadingOverlay();
    }

    this.gridApi.addEventListener('rowGroupOpened', this.boundOnRowGroupOpened);
    this.gridApi.addEventListener('columnVisible', this.boundOnAgColumnVisibilityChanged);
    this.gridApi.addEventListener('firstDataRendered', this.boundOnFirstDataRendered);
  }

  private onFirstDataRendered(event: FirstDataRenderedEvent) {
    setTimeout(() => event.api.autoSizeAllColumns(), 0); // Ensure it runs after render cycle
  }

  private onRowGroupOpened(event: RowGroupOpenedEvent) {
    setTimeout(() => event.api.autoSizeAllColumns(), 50);
  }

  private onAgColumnVisibilityChanged(event: AgColumnVisibleEvent): void {
    if (this.isProgrammaticChange) return;

    if (event.column && event.column.getColDef().field) {
      const eventSource = event.source as string;
      if (eventSource === 'toolPanelUi' || eventSource === 'columnMenu') {
        this.columnVisibilityChanged.emit({
          categoryKey: this.categoryKey,
          columnField: event.column.getColDef().field as string,
          isVisible: !!event.visible,
        });
      }
    }
    if (event.api) {
      setTimeout(() => event.api.autoSizeAllColumns(), 50);
    }
  }

  private onDocumentKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const activeElement = document.activeElement;
      if (this.gridApi && activeElement instanceof HTMLElement && activeElement.tagName === 'INPUT' && activeElement.closest('.ag-filter-wrapper')) {
        const columnDefs = this.gridApi.getColumnDefs();
        if (columnDefs) {
          columnDefs.forEach(colDef => {
            // Ensure colDef.field is a string before using it with getFilterInstance
            const field = (colDef as ColDef).field; // Type assertion might be needed if colDef is too generic
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

  restoreOriginalData() {
    if (!this.gridApi) return;

    this.isProgrammaticChange = true;
    if (this.isDeduplicated && this.originalRowData) {
      this.gridApi.setGridOption('rowData', this.originalRowData);
      this.isDeduplicated = false;
      this.showMessage('Original data restored.');
      this.originalDataRestored.emit(this.categoryKey);
    } else if (!this.isDeduplicated) {
        this.showMessage('Data is already in its original state.');
    } else { // isDeduplicated is true but no originalRowData (shouldn't happen if logic is sound)
        this.showMessage('No original data to restore or inconsistent state.');
    }
    setTimeout(() => {
      if (this.gridApi) this.gridApi.autoSizeAllColumns();
      this.isProgrammaticChange = false;
    }, 50);
  }

  removeDuplicates(batchSize: number = 500) {
    if (!this.gridApi) return;

    const currentColumnDefs = this.gridApi.getColumnDefs();
    if (!currentColumnDefs) return;

    const visibleColumnsFields = this.gridApi.getColumnState()
        .filter(state => !state.hide && state.colId)
        .map(state => state.colId as string) // Assume colId is the field name or can be mapped
        .filter(field => field !== 'execution_order');


    if (visibleColumnsFields.length === 0) {
      this.showMessage('No visible columns to check for duplicates.');
      return;
    }

    const rowGroupColsFields = this.gridApi.getColumnState()
        .filter(state => state.rowGroup && state.colId)
        .map(state => state.colId as string);

    const seenRows = new Map<string, any>();
    const duplicateNodesToRemove: any[] = [];
    let duplicateCount = 0;

    const processBatch = () => {
     if (duplicateNodesToRemove.length > 0 && this.gridApi) {
      const nodesToRemove = [...duplicateNodesToRemove]; // Create a copy to avoid issues if more duplicates are found
      duplicateNodesToRemove.length = 0;
      this.gridApi.applyTransactionAsync({ remove: nodesToRemove }); 
     }
    };
  
    const currentRowNodes: any[] = []; // Using any for node temporarily
  
  this.gridApi.forEachNode(node => {
    const row = node.data as JobData; // Type assertion
      if (!row) return;
    
      const groupKey = rowGroupColsFields.map(field => row[field as keyof JobData]).join('|');
      const valueKey = visibleColumnsFields
        .filter(field => !rowGroupColsFields.includes(field))
        .map(field => row[field as keyof JobData])
        .join('|');
      const key = `${groupKey}|${valueKey}`;

      if (seenRows.has(key)) {
        duplicateNodesToRemove.push(row);
        duplicateCount++;
        if (duplicateNodesToRemove.length >= batchSize) {
          processBatch();
        }
      } else {
      seenRows.set(key, row);
    }   
  });
  
  processBatch();

    if (duplicateCount > 0) {
      this.isDeduplicated = true;
      this.showMessage(`${duplicateCount} duplicate(s) removed.`);
      this.duplicatesRemoved.emit(this.categoryKey);
    } else {
      this.showMessage('No duplicate rows found based on visible columns.');
    }
    setTimeout(() => this.gridApi?.autoSizeAllColumns(), 50);
  }

  expandAllGroups() {
    if (this.gridApi) {
      this.gridApi.expandAll();
      setTimeout(() => this.gridApi?.autoSizeAllColumns(), 100);
      this.showMessage('All groups expanded');
    }
  }

  collapseAllGroups() {
    if (this.gridApi) {
      this.gridApi.collapseAll();
      this.showMessage('All groups collapsed');
    }
  }

  toggleColumns() {
    if (!this.gridApi) return;
    const isColumnsToolPanelOpen = this.gridApi.isToolPanelShowing() && this.gridApi.getOpenedToolPanel() === 'columns';
    if (isColumnsToolPanelOpen) {
        this.gridApi.closeToolPanel();
    } else {
        this.gridApi.openToolPanel('columns');
    }
  }

  resetView() {
    if (this.gridApi) {
      this.isProgrammaticChange = true;

      this.gridApi.setFilterModel(null);
      // Reset sorting, grouping, pivot, pinning for all columns
      const colStatesToReset = this.gridApi.getColumnState().map(s => ({
          colId: s.colId,
          sort: null,
          rowGroup: false,
          pivot: false,
          pinned: null,
      }));
      this.gridApi.applyColumnState({ state: colStatesToReset, defaultState: { hide: false } });


      // Re-apply initial hide state from original columnDefs
      const initialColumnHideStates = this.columnDefs
        ?.map(colDef => {
            if(colDef.field){
                return { colId: colDef.field, hide: !!colDef.hide };
            }
            return null;
        })
        .filter(state => state !== null) as {colId: string; hide: boolean}[];

      if (initialColumnHideStates && initialColumnHideStates.length > 0) {
        this.gridApi.applyColumnState({ state: initialColumnHideStates, applyOrder: true });
      }

      // Restore original data if it was deduplicated or if current data count differs
      if (this.originalRowData) { // Ensure originalRowData is not null/undefined
        if (this.isDeduplicated || this.gridApi.getDisplayedRowCount() !== this.originalRowData.length) {
            this.gridApi.setGridOption('rowData', this.originalRowData);
            this.isDeduplicated = false;
            this.originalDataRestored.emit(this.categoryKey);
        }
      }


      this.gridApi.collapseAll();

      setTimeout(() => {
        if (this.gridApi) this.gridApi.autoSizeAllColumns();
        this.isProgrammaticChange = false;
        this.showMessage('View reset successfully');
      }, 100);
    }
  }

  toggleDensity() {
    if (!this.gridApi) return;
    this.isCompactView = !this.isCompactView;
    const newRowHeight = this.isCompactView ? 28 : 32; // Or your theme's default
    this.gridApi.setGridOption('rowHeight', newRowHeight);
    // If header height also changes with density:
    // const newHeaderHeight = this.isCompactView ? 30 : 36; // example
    // this.gridApi.setGridOption('headerHeight', newHeaderHeight);
    this.showMessage(`Density set to ${this.isCompactView ? 'compact' : 'default'}.`);
  }

  onExportClick() {
    if (this.gridApi) {
      this.gridApi.exportDataAsExcel({
        fileName: `${this.categoryKey}_export_${new Date().toISOString().slice(0, 10)}.xlsx`
      });
    }
  }

  copyToClipboard() {
    if (this.gridApi) {
      const selectedData = this.gridApi.getSelectedRows();
      const params = {
        onlySelected: selectedData.length > 0
      };
      const csvData = this.gridApi.getDataAsCsv(params);

      if (csvData) {
        navigator.clipboard.writeText(csvData)
          .then(() => this.showMessage('Data copied to clipboard'))
          .catch(err => {
            this.showMessage('Failed to copy data.');
            console.error('Clipboard copy failed:', err);
          });
      } else {
        this.showMessage('No data to copy.');
      }
    }
  }

  private showMessage(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}       