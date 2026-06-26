import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { TopBar } from '../shared/top-bar';
import {
  ApiService,
  EstadoCaja,
  CierreInfo,
  TipoMovimientoCaja,
} from '../services/api.service';

@Component({
  selector: 'app-cierre',
  imports: [FormsModule, CurrencyPipe, DatePipe, TopBar],
  templateUrl: './cierre.html',
  styleUrl: './cierre.scss',
})
export class Cierre {
  private api = inject(ApiService);

  estado = signal<EstadoCaja | null>(null);
  cargando = signal(true);

  // Cuánto contó el kiosquero. El input type=number entrega number | null.
  contado = signal<number | null>(null);

  // Resultado del cierre que se acaba de hacer en esta pantalla (confirmación).
  recienCerrado = signal<CierreInfo | null>(null);

  // Formulario de movimiento manual (apertura / gasto / retiro).
  movAbierto = signal<TipoMovimientoCaja | null>(null);
  movMonto = signal<number | null>(null);
  movDescripcion = signal('');
  guardando = signal(false);
  error = signal('');

  // Atajo a la caja abierta.
  abierta = computed(() => this.estado()?.abierta ?? null);

  // Diferencia en vivo entre lo contado y lo esperado.
  diferencia = computed(() => {
    const a = this.abierta();
    const c = this.contado();
    if (!a || c === null || !Number.isFinite(c)) return null;
    return c - a.efectivoEsperado;
  });

  constructor() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.api.estadoCaja().subscribe({
      next: (e) => {
        this.estado.set(e);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  // ── Movimiento manual ──
  abrirMov(tipo: TipoMovimientoCaja) {
    this.movAbierto.set(tipo);
    this.movMonto.set(null);
    this.movDescripcion.set('');
    this.error.set('');
  }

  cerrarMov() {
    this.movAbierto.set(null);
  }

  tituloMov(): string {
    const t = this.movAbierto();
    if (t === 'apertura') return 'Fondo de caja (apertura)';
    if (t === 'gasto') return 'Registrar gasto';
    if (t === 'retiro') return 'Retiro de caja';
    return '';
  }

  guardarMov() {
    const tipo = this.movAbierto();
    if (!tipo) return;
    const monto = this.movMonto();
    if (monto === null || !Number.isFinite(monto) || monto <= 0) {
      this.error.set('Poné un monto mayor a cero.');
      return;
    }
    this.guardando.set(true);
    this.error.set('');
    this.api
      .registrarMovimientoCaja(tipo, monto, this.movDescripcion().trim() || undefined)
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.movAbierto.set(null);
          this.cargar();
        },
        error: (e) => {
          this.guardando.set(false);
          this.error.set(e?.error?.error ?? 'No se pudo guardar.');
        },
      });
  }

  // ── Cerrar la caja ──
  cerrarCaja() {
    const c = this.contado();
    if (c === null || !Number.isFinite(c) || c < 0) {
      this.error.set('Ingresá cuánto contaste de efectivo.');
      return;
    }
    this.guardando.set(true);
    this.error.set('');
    this.api.cerrarCaja(c).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.recienCerrado.set(r);
        this.contado.set(null);
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.error.set(e?.error?.error ?? 'No se pudo cerrar la caja.');
      },
    });
  }

  // Cierra la confirmación y sigue con la caja nueva.
  ocultarConfirmacion() {
    this.recienCerrado.set(null);
  }
}
