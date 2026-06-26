import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { TopBar } from '../shared/top-bar';
import { Scanner } from '../shared/scanner';
import { ApiService, Producto, ProductoInput } from '../services/api.service';

// Estado del formulario (alta o edición).
interface FormProducto {
  id: number | null;
  nombre: string;
  precioVenta: number | null;
  precioCosto: number | null;
  stockActual: number | null;
  stockMinimo: number | null;
  codigoBarras: string;
}

@Component({
  selector: 'app-productos',
  imports: [FormsModule, CurrencyPipe, TopBar, Scanner],
  templateUrl: './productos.html',
  styleUrl: './productos.scss',
})
export class Productos {
  private api = inject(ApiService);

  productos = signal<Producto[]>([]);
  filtro = signal('');
  soloReponer = signal(false);
  cargando = signal(true);
  mensaje = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Formulario
  mostrarForm = signal(false);
  form = signal<FormProducto | null>(null);
  guardando = signal(false);

  // Escáner de código de barras (cámara).
  escaneando = signal(false);

  // Filtrado en vivo por nombre sobre lo que ya trajimos.
  visibles = computed(() => {
    const q = this.filtro().trim().toLowerCase();
    if (!q) return this.productos();
    return this.productos().filter((p) => p.nombre.toLowerCase().includes(q));
  });

  cantReponer = computed(
    () => this.productos().filter((p) => p.stockActual <= p.stockMinimo).length
  );

  constructor() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.api.listarProductos(this.soloReponer()).subscribe({
      next: (p) => {
        this.productos.set(p);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  toggleReponer() {
    this.soloReponer.update((v) => !v);
    this.cargar();
  }

  hayQueReponer(p: Producto): boolean {
    return p.stockActual <= p.stockMinimo;
  }

  // ── Formulario ──
  nuevo() {
    this.form.set({
      id: null,
      nombre: '',
      precioVenta: null,
      precioCosto: null,
      stockActual: null,
      stockMinimo: null,
      codigoBarras: '',
    });
    this.mostrarForm.set(true);
  }

  // ── Escáner (cámara): dar de alta o editar escaneando el código ──
  abrirScanner() {
    this.escaneando.set(true);
  }

  cerrarScanner() {
    this.escaneando.set(false);
  }

  onCodigoEscaneado(codigo: string) {
    this.escaneando.set(false);
    this.api.productoPorCodigo(codigo).subscribe({
      // Ya existe: abro su ficha para editarlo.
      next: (p) => {
        this.notificar('ok', `Ese código ya es de "${p.nombre}".`);
        this.editar(p);
      },
      // No existe: abro el alta con el código ya cargado.
      error: () => {
        this.form.set({
          id: null,
          nombre: '',
          precioVenta: null,
          precioCosto: null,
          stockActual: null,
          stockMinimo: null,
          codigoBarras: codigo,
        });
        this.mostrarForm.set(true);
      },
    });
  }

  editar(p: Producto) {
    this.form.set({
      id: p.id,
      nombre: p.nombre,
      precioVenta: p.precioVenta,
      precioCosto: p.precioCosto,
      stockActual: p.stockActual,
      stockMinimo: p.stockMinimo,
      codigoBarras: p.codigoBarras ?? '',
    });
    this.mostrarForm.set(true);
  }

  guardar() {
    const f = this.form();
    if (!f) return;
    if (!f.nombre.trim()) {
      this.notificar('error', 'Poné un nombre.');
      return;
    }
    const datos: ProductoInput = {
      nombre: f.nombre.trim(),
      precioVenta: Number(f.precioVenta) || 0,
      precioCosto: Number(f.precioCosto) || 0,
      stockActual: Number(f.stockActual) || 0,
      stockMinimo: Number(f.stockMinimo) || 0,
      codigoBarras: f.codigoBarras.trim() || null,
    };

    this.guardando.set(true);
    const obs = f.id
      ? this.api.editarProducto(f.id, datos)
      : this.api.crearProducto(datos);

    obs.subscribe({
      next: () => {
        this.guardando.set(false);
        this.mostrarForm.set(false);
        this.notificar('ok', f.id ? 'Producto actualizado.' : 'Producto agregado.');
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.notificar('error', err?.error?.error ?? 'No se pudo guardar.');
      },
    });
  }

  private notificar(tipo: 'ok' | 'error', texto: string) {
    this.mensaje.set({ tipo, texto });
    setTimeout(() => this.mensaje.set(null), 3000);
  }
}
