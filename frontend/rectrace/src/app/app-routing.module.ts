import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
// *** Verify this import path is correct relative to app-routing.module.ts ***
import { SearchComponent } from './search/search.component';

// This is the configuration array for your routes
const routes: Routes = [
  {
    path: 'search',
    component: SearchComponent // The component to load for the '/search' path
  },
  {
    path: '', // The default path (e.g., http://localhost:4200/)
    redirectTo: '/search', // Redirects the default path to '/search'
    pathMatch: 'full' // Requires the full path to be empty for the redirect
  },
  // Optional: Add a wildcard route later
  // { path: '**', component: PageNotFoundComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule] // Makes RouterModule available to the importing module (AppModule)
})
export class AppRoutingModule { }