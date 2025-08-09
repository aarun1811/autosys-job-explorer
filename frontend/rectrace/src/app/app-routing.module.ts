import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SearchComponent } from './search-feature/components/search/search.component';

const routes: Routes = [
  // Route for the main search functionality
  {
    path: 'search',
    component: SearchComponent
  },
  // Route for the new V4 search functionality
  {
    path: 'search-v4',
    loadChildren: () => import('./search-v4/search-v4.module').then(m => m.SearchV4Module)
  },
  // Default route: Redirect any empty path to '/search'
  {
    path: '', // The default path (e.g., http://localhost:4200/)
    redirectTo: '/search', // Redirects the default path to '/search'
    pathMatch: 'full' // Requires the full path to be empty for the redirect
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule] // Makes RouterModule available to the importing module (AppModule)
})
export class AppRoutingModule { }
