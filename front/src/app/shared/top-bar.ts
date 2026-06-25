import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

// Barra superior reutilizable: flecha para volver al inicio + título.
@Component({
  selector: 'app-top-bar',
  imports: [RouterLink],
  template: `
    <header class="top-bar">
      <a class="volver" routerLink="/" aria-label="Volver al inicio">←</a>
      <h1>{{ titulo() }}</h1>
    </header>
  `,
  styles: [
    `
      .top-bar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: #fff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
      }
      .volver {
        font-size: 1.6rem;
        line-height: 1;
        text-decoration: none;
        color: #1664a8;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        background: #e8f1fb;
      }
      h1 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
      }
    `,
  ],
})
export class TopBar {
  titulo = input<string>('');
}
