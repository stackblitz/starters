import { Component, signal, ChangeDetectionStrategy, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  template: `
    <h1>Hello from Angular!</h1>
    <a target="_blank" href="https://angular.dev/overview">
      Learn more about Angular
    </a>
    <br /><br />
    <button (click)="counter.update(value => value - 1)">--</button>
    <span> Counter: {{ counter() }} </span>
    <button (click)="counter.update(value => value + 1)">++</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly counter = signal(0);
}

bootstrapApplication(App, {
  providers: [provideZonelessChangeDetection()],
});
