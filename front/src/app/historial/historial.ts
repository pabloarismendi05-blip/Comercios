import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { TopBar } from '../shared/top-bar';
import { ApiService, VentasDia, VentaDetalle } from '../services/api.service';

@Component({
  selector: 'app-historial',
  imports: [FormsModule, CurrencyPipe, DatePipe, TopBar],
  templateUrl: './historial.html',
  styleUrl: './historial.scss',
})
export class Historial {
  private api = inject(ApiService);

  // Fecha elegida en formato AAAA-MM-DD (arranca en hoy).
  fecha = signal(this.hoyClave());
  datos = signal<VentasDia | null>(null);
  cargando = signal(true);

  // Detalle de la venta tocada.
  detalle = signal<VentaDetalle | null>(null);
  cargandoDetalle = signal(false);

  // Anulación de la venta abierta en el detalle.
  confirmandoAnular = signal(false);
  motivoAnular = signal('');
  anulando = signal(false);

  constructor() {
    this.cargar();
  }

  private hoyClave(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private claveConOffset(dias: number): string {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  esHoy(): boolean {
    return this.fecha() === this.hoyClave();
  }

  cambiarFecha(valor: string) {
    if (!valor) return;
    this.fecha.set(valor);
    this.cargar();
  }

  hoy() {
    this.fecha.set(this.hoyClave());
    this.cargar();
  }

  ayer() {
    this.fecha.set(this.claveConOffset(-1));
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.api.ventasDelDia(this.fecha()).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  // Etiqueta amigable para el medio de pago.
  iconoMedio(medio: string): string {
    if (medio === 'efectivo') return '💵';
    if (medio === 'transferencia') return '📲';
    return '📒';
  }

  abrirDetalle(id: number) {
    this.cargandoDetalle.set(true);
    this.detalle.set(null);
    this.api.ventaDetalle(id).subscribe({
      next: (d) => {
        this.detalle.set(d);
        this.cargandoDetalle.set(false);
      },
      error: () => this.cargandoDetalle.set(false),
    });
  }

  cerrarDetalle() {
    this.detalle.set(null);
    this.confirmandoAnular.set(false);
    this.motivoAnular.set('');
  }

  // Paso 1: mostrar la confirmación de anular.
  pedirAnular() {
    this.confirmandoAnular.set(true);
  }

  cancelarAnular() {
    this.confirmandoAnular.set(false);
    this.motivoAnular.set('');
  }

  // Paso 2: confirmar. Anula en el server y refresca detalle + lista del día.
  confirmarAnular() {
    const v = this.detalle();
    if (!v || this.anulando()) return;
    this.anulando.set(true);
    this.api.anularVenta(v.id, this.motivoAnular().trim() || undefined).subscribe({
      next: () => {
        this.anulando.set(false);
        this.confirmandoAnular.set(false);
        this.motivoAnular.set('');
        // Recargar el detalle (ahora marcado anulada) y la lista del día.
        this.abrirDetalle(v.id);
        this.cargar();
      },
      error: (e) => {
        this.anulando.set(false);
        alert(e?.error?.error ?? 'No se pudo anular la venta.');
      },
    });
  }
}
