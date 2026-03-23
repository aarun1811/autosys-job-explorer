import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-recviz-embed-dialog',
  template: `
    <div mat-dialog-content
         style="padding: 0; height: 100%; overflow: hidden; margin: 0;">
      <iframe
        [src]="safeUrl"
        style="width: 100%; height: 100%; border: none;"
      ></iframe>
    </div>
  `,
  styles: [`
    :host ::ng-deep .mat-mdc-dialog-content {
      max-height: unset;
      padding: 0;
      margin: 0;
    }
  `]
})
export class RecvizEmbedDialogComponent {
  safeUrl: SafeResourceUrl;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { url: string },
    private sanitizer: DomSanitizer,
  ) {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(data.url);
  }
}
