import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';

import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';

import { ExecutionOrderButtonComponent } from './components/renderers/execution-order-button.component';
import { AppIDCellRendererComponent } from './components/renderers/app-id-cell-renderer.component';
import { AppSupportCellRendererComponent } from './components/renderers/app-support-cell-renderer.component';
import { ExecutionOrderModalComponent } from './components/modals/execution-order-modal/execution-order-modal.component';
import { ExecutionOrderGraphComponent } from './components/modals/execution-order-graph/execution-order-graph.component';

const DECLARATIONS_EXPORTS = [
  ExecutionOrderButtonComponent,
  AppIDCellRendererComponent,
  AppSupportCellRendererComponent,
  ExecutionOrderModalComponent,
  ExecutionOrderGraphComponent
];

const MATERIAL_MODULES = [
  MatDialogModule,
  MatIconModule,
  MatTooltipModule,
  MatProgressSpinnerModule,
  MatListModule,
  MatDividerModule,
  MatSnackBarModule,
  MatButtonModule
];

@NgModule({
  declarations: [
    ...DECLARATIONS_EXPORTS
  ],
  imports: [
    CommonModule,
    AgGridModule,
    ...MATERIAL_MODULES
  ],
  exports: [
    ...DECLARATIONS_EXPORTS
  ]
})
export class CustomInteractionsModule { }