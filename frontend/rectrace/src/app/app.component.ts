import { Component, OnInit } from '@angular/core';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'rectrace';

  constructor(private themeService: ThemeService) { }

  ngOnInit(): void {
    // Theme service will auto-initialize on construction
    // This ensures the theme is applied as soon as the app loads
    // Remove preload class after initialization to enable transitions
    setTimeout(() => {
      document.body.classList.remove('preload');
    }, 100);
  }
}
