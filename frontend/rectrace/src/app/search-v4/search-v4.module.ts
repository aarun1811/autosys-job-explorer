import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';

// Material imports
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

// Custom modules
import { CustomInteractionsModule } from '../custom-interactions/custom-interactions.module';

// Components
import { SearchV4Component } from './components/search-v4/search-v4.component';
import { SearchV4GridComponent } from './components/search-v4-grid/search-v4-grid.component';

// Routing
import { SearchV4RoutingModule } from './search-v4-routing.module';

@NgModule({
  declarations: [
    SearchV4Component,
    SearchV4GridComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AgGridModule,
    MatTabsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatTooltipModule,
    CustomInteractionsModule,
    SearchV4RoutingModule
  ]
})
export class SearchV4Module { }