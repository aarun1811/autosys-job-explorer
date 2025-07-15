import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { GridApi } from 'ag-grid-enterprise';
import { JobData } from '../../models/job.model';

@Injectable({
  providedIn: 'root'
})
export class GridActionsService {
  constructor(private snackBar: MatSnackBar) {}

  expandAllGroups(gridApi: GridApi<JobData | undefined | null>): void {
    if (gridApi) {
      gridApi.expandAll();
      setTimeout(() => gridApi?.autoSizeAllColumns(), 100);
      this.showMessage('All groups expanded');
    }
  }

  collapseAllGroups(gridApi: GridApi<JobData | undefined | null>): void {
    if (gridApi) {
      gridApi.collapseAll();
      this.showMessage('All groups collapsed');
    }
  }

  toggleColumns(gridApi: GridApi<JobData | undefined | null>): void {
    if (!gridApi) return;

    const isColumnsToolPanelOpen = gridApi.isToolPanelShowing() && gridApi.getOpenedToolPanel() === 'columns';
    if (isColumnsToolPanelOpen) {
      gridApi.closeToolPanel();
    } else {
      gridApi.openToolPanel('columns');
    }
  }

  resetView(
    gridApi: GridApi<JobData | undefined | null>,
    columnDefs: any[] | undefined | null,
    originalRowData: (JobData | null | undefined)[],
    isDeduplicated: boolean,
    categoryKey: string,
    onOriginalDataRestored: (categoryKey: string) => void
  ): void {
    if (!gridApi) return;

    // Reset filters
    gridApi.setFilterModel(null);

    // Reset sorting, grouping, pivot, pinning for all columns
    const colStatesToReset = gridApi.getColumnState().map(s => ({
      colId: s.colId,
      sort: null,
      rowGroup: false,
      pivot: false,
      pinned: null,
    }));
    gridApi.applyColumnState({ state: colStatesToReset, defaultState: { hide: false } });

    // Re-apply initial hide state from original columnDefs
    const initialColumnHideStates = columnDefs
      ?.map(colDef => {
        if (colDef.field) {
          return { colId: colDef.field, hide: !!colDef.hide };
        }
        return null;
      })
      .filter(state => state !== null) as { colId: string; hide: boolean }[];

    if (initialColumnHideStates && initialColumnHideStates.length > 0) {
      gridApi.applyColumnState({ state: initialColumnHideStates, applyOrder: true });
    }

    // Restore original data if it was deduplicated or if current data count differs
    if (originalRowData) {
      if (isDeduplicated || gridApi.getDisplayedRowCount() !== originalRowData.length) {
        gridApi.setGridOption('rowData', originalRowData);
        onOriginalDataRestored(categoryKey);
      }
    }

    gridApi.collapseAll();

    setTimeout(() => {
      if (gridApi) gridApi.autoSizeAllColumns();
      this.showMessage('View reset successfully');
    }, 100);
  }

  toggleDensity(
    gridApi: GridApi<JobData | undefined | null>,
    isCompactView: boolean,
    onCompactViewChange: (isCompact: boolean) => void
  ): void {
    if (!gridApi) return;

    const newCompactView = !isCompactView;
    const newRowHeight = newCompactView ? 28 : 32;

    gridApi.setGridOption('rowHeight', newRowHeight);
    onCompactViewChange(newCompactView);

    this.showMessage(`Density set to ${newCompactView ? 'compact' : 'default'}.`);
  }

  exportToExcel(gridApi: GridApi<JobData | undefined | null>, categoryKey: string): void {
    if (gridApi) {
      gridApi.exportDataAsExcel({
        fileName: `${categoryKey}_export_${new Date().toISOString().slice(0, 10)}.xlsx`
      });
    }
  }

  copyToClipboard(gridApi: GridApi<JobData | undefined | null>): void {
    if (gridApi) {
      const selectedData = gridApi.getSelectedRows();
      const params = {
        onlySelected: selectedData.length > 0
      };
      const csvData = gridApi.getDataAsCsv(params);

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

  removeDuplicates(
    gridApi: GridApi<JobData | undefined | null>,
    batchSize: number = 500,
    onDuplicatesRemoved: (categoryKey: string) => void,
    categoryKey: string
  ): void {
    if (!gridApi) return;

    const currentColumnDefs = gridApi.getColumnDefs();
    if (!currentColumnDefs) return;

    const visibleColumnsFields = gridApi.getColumnState()
      .filter(state => !state.hide && state.colId)
      .map(state => state.colId as string)
      .filter(field => field !== 'execution_order');

    if (visibleColumnsFields.length === 0) {
      this.showMessage('No visible columns to check for duplicates.');
      return;
    }

    const rowGroupColsFields = gridApi.getColumnState()
      .filter(state => state.rowGroup && state.colId)
      .map(state => state.colId as string);

    const seenRows = new Map<string, any>();
    const duplicateNodesToRemove: any[] = [];
    let duplicateCount = 0;

    const processBatch = () => {
      if (duplicateNodesToRemove.length > 0 && gridApi) {
        const nodesToRemove = [...duplicateNodesToRemove];
        duplicateNodesToRemove.length = 0;
        gridApi.applyTransactionAsync({ remove: nodesToRemove });
      }
    };

    gridApi.forEachNode(node => {
      const row = node.data as JobData;
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
      this.showMessage(`${duplicateCount} duplicate(s) removed.`);
      onDuplicatesRemoved(categoryKey);
    } else {
      this.showMessage('No duplicate rows found based on visible columns.');
    }

    setTimeout(() => gridApi?.autoSizeAllColumns(), 50);
  }

  restoreOriginalData(
    gridApi: GridApi<JobData | undefined | null>,
    originalRowData: (JobData | null | undefined)[],
    isDeduplicated: boolean,
    categoryKey: string,
    onOriginalDataRestored: (categoryKey: string) => void
  ): void {
    if (!gridApi) return;

    if (isDeduplicated && originalRowData) {
      gridApi.setGridOption('rowData', originalRowData);
      this.showMessage('Original data restored.');
      onOriginalDataRestored(categoryKey);
    } else if (!isDeduplicated) {
      this.showMessage('Data is already in its original state.');
    } else {
      this.showMessage('No original data to restore or inconsistent state.');
    }

    setTimeout(() => {
      if (gridApi) gridApi.autoSizeAllColumns();
    }, 50);
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}
