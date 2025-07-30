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
    const duplicateRows: any[] = [];
    let duplicateCount = 0;

    // Collect all rows and identify duplicates
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
        duplicateRows.push(row);
        duplicateCount++;
      } else {
        seenRows.set(key, row);
      }
    });

    if (duplicateCount > 0) {
      // For SSRM, we need to refresh the data source to remove duplicates
      // This will trigger a new data fetch with the deduplication flag
      this.showMessage(`${duplicateCount} duplicate(s) found. Refreshing data...`);
      onDuplicatesRemoved(categoryKey);

      // Refresh the grid to show deduplicated data
      setTimeout(() => {
        gridApi.refreshServerSide({ purge: true });
      }, 100);
    } else {
      this.showMessage('No duplicate rows found based on visible columns.');
    }

    setTimeout(() => gridApi?.autoSizeAllColumns(), 50);
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}
