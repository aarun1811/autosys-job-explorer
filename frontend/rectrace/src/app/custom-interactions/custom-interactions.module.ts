import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { AgChartsModule } from 'ag-charts-angular';

import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ExecutionOrderButtonComponent } from './components/renderers/execution-order-button.component';
import { AppIDCellRendererComponent } from './components/renderers/app-id-cell-renderer.component';
import { AppSupportCellRendererComponent } from './components/renderers/app-support-cell-renderer.component';
import { SetIdCellRendererComponent } from './components/renderers/set-id-cell-renderer.component';
import { ReconCellRendererComponent } from './components/renderers/recon-cell-renderer.component';
import { SetIdV2RendererComponent } from './components/renderers/v2/set-id-v2-renderer.component';
import { ReconV2RendererComponent } from './components/renderers/v2/recon-v2-renderer.component';
import { TlmInstanceV2RendererComponent } from './components/renderers/v2/tlm-instance-v2-renderer.component';
import { ExecutionOrderModalComponent } from './components/modals/execution-order-modal/execution-order-modal.component';
import { ExecutionOrderGraphComponent } from './components/modals/execution-order-graph/execution-order-graph.component';
import { TlmStatsModalComponent } from './components/modals/tlm-stats-modal/tlm-stats-modal.component';
import { TlmStatsModalV2Component } from './components/modals/tlm-stats-modal-v2/tlm-stats-modal-v2.component';
import { TlmFiltersV2Component } from './components/modals/tlm-stats-modal-v2/components/tlm-filters-v2/tlm-filters-v2.component';
import { TlmSummaryCardsV2Component } from './components/modals/tlm-stats-modal-v2/components/tlm-summary-cards-v2/tlm-summary-cards-v2.component';
import { TlmPieChartV2Component } from './components/modals/tlm-stats-modal-v2/components/tlm-pie-chart-v2/tlm-pie-chart-v2.component';
import { TlmBreaksTableV2Component } from './components/modals/tlm-stats-modal-v2/components/tlm-breaks-table-v2/tlm-breaks-table-v2.component';
import { TlmReconTableV2Component } from './components/modals/tlm-stats-modal-v2/components/tlm-recon-table-v2/tlm-recon-table-v2.component';
import { ReconIdRendererComponent } from './components/renderers/recon-id-renderer/recon-id-renderer.component';
import { RecPortalIdRendererComponent } from './components/renderers/rec-portal-id-renderer/rec-portal-id-renderer.component';
import { QuickRecStatsModalComponent } from './components/modals/quickrec-stats-modal/quickrec-stats-modal.component';
import { QuickRecFiltersComponent } from './components/modals/quickrec-stats-modal/components/quickrec-filters/quickrec-filters.component';
import { QuickRecSummaryComponent } from './components/modals/quickrec-stats-modal/components/quickrec-summary/quickrec-summary.component';
import { QuickRecAutomatchTableComponent } from './components/modals/quickrec-stats-modal/components/quickrec-automatch-table/quickrec-automatch-table.component';
import { QuickRecManualTableComponent } from './components/modals/quickrec-stats-modal/components/quickrec-manual-table/quickrec-manual-table.component';
import { RecvizEmbedDialogComponent } from './components/modals/recviz-embed-dialog/recviz-embed-dialog.component';

const DECLARATIONS_EXPORTS = [
  ExecutionOrderButtonComponent,
  AppIDCellRendererComponent,
  AppSupportCellRendererComponent,
  SetIdCellRendererComponent,
  ReconCellRendererComponent,
  SetIdV2RendererComponent,
  ReconV2RendererComponent,
  TlmInstanceV2RendererComponent,
  ExecutionOrderModalComponent,
  ExecutionOrderGraphComponent,
  TlmStatsModalComponent,
  TlmStatsModalV2Component,
  TlmFiltersV2Component,
  TlmSummaryCardsV2Component,
  TlmPieChartV2Component,
  TlmBreaksTableV2Component,
  TlmReconTableV2Component,
  ReconIdRendererComponent,
  RecPortalIdRendererComponent,
  QuickRecStatsModalComponent,
  QuickRecFiltersComponent,
  QuickRecSummaryComponent,
  QuickRecAutomatchTableComponent,
  QuickRecManualTableComponent,
  RecvizEmbedDialogComponent
];

const MATERIAL_MODULES = [
  MatDialogModule,
  MatIconModule,
  MatTooltipModule,
  MatProgressSpinnerModule,
  MatListModule,
  MatDividerModule,
  MatSnackBarModule,
  MatButtonModule,
  MatSelectModule,
  MatChipsModule,
  MatCardModule,
  MatTabsModule,
  MatFormFieldModule,
  MatInputModule
];

@NgModule({
  declarations: [
    ...DECLARATIONS_EXPORTS
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AgGridModule,
    AgChartsModule,
    ...MATERIAL_MODULES
  ],
  exports: [
    ...DECLARATIONS_EXPORTS
  ]
})
export class CustomInteractionsModule { }
