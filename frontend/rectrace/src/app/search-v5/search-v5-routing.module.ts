import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SearchV5Component } from './components/search-v5/search-v5.component';

const routes: Routes = [
  {
    path: '',
    component: SearchV5Component
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SearchV5RoutingModule { }
