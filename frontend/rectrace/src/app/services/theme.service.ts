import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'rectrace-theme';
  private readonly DEFAULT_THEME: Theme = 'light';
  
  private currentTheme$ = new BehaviorSubject<Theme>(this.DEFAULT_THEME);

  constructor() {
    this.initializeTheme();
  }

  private initializeTheme(): void {
    const savedTheme = this.getSavedTheme();
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    this.setTheme(initialTheme, false);
    
    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!this.getSavedTheme()) {
          this.setTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }
  }

  private getSavedTheme(): Theme | null {
    const saved = localStorage.getItem(this.THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  }

  private saveTheme(theme: Theme): void {
    localStorage.setItem(this.THEME_KEY, theme);
  }

  private applyTheme(theme: Theme): void {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    } else {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    }
  }

  public setTheme(theme: Theme, save: boolean = true): void {
    this.applyTheme(theme);
    this.currentTheme$.next(theme);
    
    if (save) {
      this.saveTheme(theme);
    }
  }

  public toggleTheme(): void {
    const newTheme = this.currentTheme$.value === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  public getTheme(): Observable<Theme> {
    return this.currentTheme$.asObservable();
  }

  public getCurrentTheme(): Theme {
    return this.currentTheme$.value;
  }

  public isDarkMode(): boolean {
    return this.currentTheme$.value === 'dark';
  }

  public clearSavedTheme(): void {
    localStorage.removeItem(this.THEME_KEY);
    this.initializeTheme();
  }
}