import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { AppRoutingModule } from './app-routing.module';

import { AppComponent } from './app.component';
import { AllJobsComponent } from './all-jobs/all-jobs.component';
import { SearchComponent } from './search/search.component';
import { ExecutionOrderModalComponent } from './all-jobs/execution-order-modal/execution-order-modal.component';
import { ExecutionOrderGraphComponent } from './all-jobs/execution-order-modal/execution-order-graph/execution-order-graph.component';
import { ExecutionOrderButtonComponent } from './all-jobs/execution-order-modal/execution-order-button.component';
import { AppIDCellRendererComponent } from './all-jobs/app-id-cell-renderer.component';
import { AppSupportCellRendererComponent } from './all-jobs/app-support-cell-renderer.component';

@NgModule({
  declarations: [
    AppComponent,
    AllJobsComponent,
    SearchComponent,
    ExecutionOrderModalComponent,
    ExecutionOrderGraphComponent,
    ExecutionOrderButtonComponent,
    AppIDCellRendererComponent,
    AppSupportCellRendererComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatExpansionModule,
    MatTableModule,
    HttpClientModule,
    CommonModule,
    AgGridModule,
    MatTabsModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatDividerModule,
    MatListModule,
    MatTooltipModule,
    MatSnackBarModule,
    AppRoutingModule,
    MatAutocompleteModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
