import { Injectable } from '@angular/core';
import type { ColDef, SideBarDef } from 'ag-grid-enterprise';
import { JobData } from '../../models/job.model';
import { ExecutionOrderButtonComponent } from '../../custom-interactions/components/renderers/execution-order-button.component';
import { AppIDCellRendererComponent } from '../../custom-interactions/components/renderers/app-id-cell-renderer.component';
import { AppSupportCellRendererComponent } from '../../custom-interactions/components/renderers/app-support-cell-renderer.component';
import { SetIdCellRendererComponent } from '../../custom-interactions/components/renderers/set-id-cell-renderer.component';
import { ReconCellRendererComponent } from '../../custom-interactions/components/renderers/recon-cell-renderer.component';

@Injectable({
  providedIn: 'root'
})
export class GridConfigurationService {
  constructor() {}

  getSideBarConfig(): SideBarDef {
    return {
      toolPanels: [
        {
          id: 'columns',
          labelDefault: 'Columns',
          toolPanel: 'agColumnsToolPanel',
          labelKey: 'columnsToolPanelKey',
          iconKey: 'columns'
        },
        {
          id: 'filters',
          labelDefault: 'Filters',
          toolPanel: 'agFiltersToolPanel',
          labelKey: 'filtersToolPanelKey',
          iconKey: 'filter'
        }
      ],
      defaultToolPanel: ''
    };
  }

  getDefaultColDef(): ColDef<JobData | undefined | null> {
    return {
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
  }

  getAutoGroupColumnDef(context?: any): ColDef<JobData | undefined | null> {
    return {
      headerName: 'Group',
      minWidth: 200,
      cellRendererParams: {
        suppressCount: true,
        innerRenderer: (params: any) => params.value
      }
    };
  }

  getComponents() {
    return {
      executionOrderButtonRenderer: ExecutionOrderButtonComponent,
      appIDCellRenderer: AppIDCellRendererComponent,
      supportEmailCellRenderer: AppSupportCellRendererComponent,
      setIdCellRenderer: SetIdCellRendererComponent,
      reconCellRenderer: ReconCellRendererComponent,
    };
  }
}
