import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

// Material imports
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

// AG-Grid
import { AgGridModule } from 'ag-grid-angular';

// Custom modules
import { CustomInteractionsModule } from '../custom-interactions/custom-interactions.module';

import { SearchV5RoutingModule } from './search-v5-routing.module';
import { SearchV5Component } from './components/search-v5/search-v5.component';
import { SearchV5GridComponent } from './components/search-v5-grid/search-v5-grid.component';


@NgModule({
  declarations: [
    SearchV5Component,
    SearchV5GridComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    SearchV5RoutingModule,
    // Material modules
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatAutocompleteModule,
    // AG-Grid
    AgGridModule,
    // Custom modules
    CustomInteractionsModule
  ]
})
export class SearchV5Module { }
