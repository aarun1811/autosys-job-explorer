import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SearchV4Component } from './components/search-v4/search-v4.component';

const routes: Routes = [
  {
    path: '',
    component: SearchV4Component
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SearchV4RoutingModule { }