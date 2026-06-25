import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Resumen as ResumenData } from '../services/api.service';

@Component({
  selector: 'app-resumen',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './resumen.html',
  styleUrl: './resumen.scss',
})
export class Resumen {
  private api = inject(ApiService);

  datos = signal<ResumenData | null>(null);
  cargando = signal(true);

  // Mayor venta diaria de la semana, para escalar el largo de las barras.
  maxDia = computed(() => {
    const dias = this.datos()?.porDia ?? [];
    return Math.max(1, ...dias.map((d) => d.total));
  });

  anchoBarra(total: number): string {
    return Math.round((total / this.maxDia()) * 100) + '%';
  }

  constructor() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.api.resumen().subscribe({
      next: (d) => {
        this.datos.set(d);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }
}
