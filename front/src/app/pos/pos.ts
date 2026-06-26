import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Scanner } from '../shared/scanner';
import {
  ApiService,
  Producto,
  Cliente,
  VentaInput,
} from '../services/api.service';

// Un ítem dentro del ticket que se está armando.
interface TicketItem {
  // id de producto, o null si es un ítem manual ("venta rápida").
  productoId: number | null;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  // Stock disponible al momento de agregarlo (null para ítems manuales).
  // Sirve solo para avisar visualmente; el backend es el que valida de verdad.
  stockActual: number | null;
}

type Paso = 'venta' | 'cobro' | 'fiado';

@Component({
  selector: 'app-pos',
  imports: [FormsModule, CurrencyPipe, RouterLink, Scanner],
  templateUrl: './pos.html',
  styleUrl: './pos.scss',
})
export class Pos {
  private api = inject(ApiService);

  // ── Estado de la búsqueda ──
  query = signal('');
  resultados = signal<Producto[]>([]);
  buscando = signal(false);
  private debounce: ReturnType<typeof setTimeout> | null = null;

  // ── Catálogo (lista para ojear al tocar el buscador, sin escribir) ──
  catalogo = signal<Producto[]>([]);
  // Si el buscador está enfocado: mostramos la lista de productos completa.
  enfocado = signal(false);

  // ── Escáner de código de barras (cámara) ──
  escaneando = signal(false);

  // ── Alta rápida de producto (cuando se escanea un código no cargado) ──
  codigoNuevo = signal<string | null>(null);
  nuevoNombre = signal('');
  nuevoPrecio = signal<number | null>(null);
  nuevoStock = signal<number | null>(null);
  creandoProd = signal(false);
  error = signal('');

  // ── Estado del ticket ──
  ticket = signal<TicketItem[]>([]);
  total = computed(() =>
    this.ticket().reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0)
  );
  cantidadItems = computed(() =>
    this.ticket().reduce((acc, it) => acc + it.cantidad, 0)
  );

  // ── Flujo de cobro ──
  paso = signal<Paso>('venta');
  guardando = signal(false);
  mensaje = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // ── Venta rápida (monto manual) ──
  mostrarManual = signal(false);
  montoManual = signal<number | null>(null);
  descManual = signal('');

  // ── Fiado ──
  clienteQuery = signal('');
  clientes = signal<Cliente[]>([]);
  clienteSeleccionado = signal<Cliente | null>(null);
  private debounceCli: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.cargarCatalogo();
  }

  // ─────────────────────────── Búsqueda ───────────────────────────

  // Trae todos los productos una vez, para mostrarlos como lista al tocar
  // el buscador (así el kiosquero los ve sin tener que escribir).
  private cargarCatalogo() {
    this.api.listarProductos().subscribe({
      next: (prods) => this.catalogo.set(prods),
      error: () => this.catalogo.set([]),
    });
  }

  // Al tocar el buscador, abrimos la lista de productos.
  onFocus() {
    this.enfocado.set(true);
    if (this.catalogo().length === 0) this.cargarCatalogo();
  }

  cerrarLista() {
    this.enfocado.set(false);
  }

  // ───────────────────── Escáner (cámara) ─────────────────────

  abrirScanner() {
    this.escaneando.set(true);
  }

  cerrarScanner() {
    this.escaneando.set(false);
  }

  // Llega un código leído por la cámara: busco el producto y lo agrego.
  onCodigoEscaneado(codigo: string) {
    this.escaneando.set(false);
    this.api.productoPorCodigo(codigo).subscribe({
      next: (p) => {
        this.agregar(p);
        this.notificar('ok', `✅ ${p.nombre} agregado`);
      },
      error: () => {
        // No está cargado: ofrezco crearlo al toque, con el código ya puesto.
        this.abrirAltaRapida(codigo);
      },
    });
  }

  // ───────────── Alta rápida de producto (desde el escáner) ─────────────

  abrirAltaRapida(codigo: string) {
    this.codigoNuevo.set(codigo);
    this.nuevoNombre.set('');
    this.nuevoPrecio.set(null);
    this.nuevoStock.set(null);
    this.error.set('');
  }

  cancelarAltaRapida() {
    this.codigoNuevo.set(null);
  }

  guardarNuevoProducto() {
    const codigo = this.codigoNuevo();
    if (!codigo) return;
    const nombre = this.nuevoNombre().trim();
    const precio = this.nuevoPrecio();
    const stock = this.nuevoStock() ?? 0;

    if (!nombre) {
      this.error.set('Ponele un nombre al producto.');
      return;
    }
    if (precio === null || !Number.isFinite(precio) || precio <= 0) {
      this.error.set('Ponele el precio de venta.');
      return;
    }

    this.creandoProd.set(true);
    this.error.set('');
    this.api
      .crearProducto({
        nombre,
        precioVenta: precio,
        precioCosto: 0, // se completa después en Productos si hace falta
        stockActual: Number.isInteger(stock) && stock > 0 ? stock : 0,
        stockMinimo: 0,
        codigoBarras: codigo,
      })
      .subscribe({
        next: (p) => {
          this.creandoProd.set(false);
          this.codigoNuevo.set(null);
          this.agregar(p);
          this.catalogo.update((c) => [...c, p]);
          this.notificar('ok', `✅ ${p.nombre} creado y agregado`);
        },
        error: (e) => {
          this.creandoProd.set(false);
          this.error.set(e?.error?.error ?? 'No se pudo crear el producto.');
        },
      });
  }

  onBuscar(valor: string) {
    this.query.set(valor);
    if (this.debounce) clearTimeout(this.debounce);
    const q = valor.trim();
    if (!q) {
      this.resultados.set([]);
      return;
    }
    this.buscando.set(true);
    this.debounce = setTimeout(() => {
      this.api.buscarProductos(q).subscribe({
        next: (prods) => {
          this.resultados.set(prods);
          this.buscando.set(false);
        },
        error: () => this.buscando.set(false),
      });
    }, 200);
  }

  // ─────────────────────────── Ticket ───────────────────────────

  agregar(p: Producto) {
    this.ticket.update((items) => {
      const existente = items.find((it) => it.productoId === p.id);
      if (existente) {
        return items.map((it) =>
          it.productoId === p.id ? { ...it, cantidad: it.cantidad + 1 } : it
        );
      }
      return [
        ...items,
        {
          productoId: p.id,
          nombre: p.nombre,
          precioUnitario: p.precioVenta,
          cantidad: 1,
          stockActual: p.stockActual,
        },
      ];
    });
    // Limpiar la búsqueda para que el foco vuelva a vender lo siguiente.
    this.query.set('');
    this.resultados.set([]);
  }

  mas(item: TicketItem) {
    this.ticket.update((items) =>
      items.map((it) => (it === item ? { ...it, cantidad: it.cantidad + 1 } : it))
    );
  }

  menos(item: TicketItem) {
    this.ticket.update((items) =>
      items
        .map((it) => (it === item ? { ...it, cantidad: it.cantidad - 1 } : it))
        .filter((it) => it.cantidad > 0)
    );
  }

  quitar(item: TicketItem) {
    this.ticket.update((items) => items.filter((it) => it !== item));
  }

  // ¿Este ítem se está vendiendo por encima del stock disponible?
  sinStock(item: TicketItem): boolean {
    return item.stockActual !== null && item.cantidad > item.stockActual;
  }

  // ───────────────────── Venta rápida (manual) ─────────────────────

  abrirManual() {
    this.montoManual.set(null);
    this.descManual.set('');
    this.mostrarManual.set(true);
  }

  agregarManual() {
    const monto = Number(this.montoManual());
    if (!Number.isFinite(monto) || monto <= 0) {
      this.notificar('error', 'Poné un monto mayor a cero.');
      return;
    }
    this.ticket.update((items) => [
      ...items,
      {
        productoId: null,
        nombre: this.descManual().trim() || 'Varios',
        precioUnitario: monto,
        cantidad: 1,
        stockActual: null,
      },
    ]);
    this.mostrarManual.set(false);
  }

  // ─────────────────────────── Cobro ───────────────────────────

  abrirCobro() {
    if (this.ticket().length === 0) {
      this.notificar('error', 'El ticket está vacío.');
      return;
    }
    this.paso.set('cobro');
  }

  cancelarCobro() {
    this.paso.set('venta');
    this.clienteSeleccionado.set(null);
    this.clienteQuery.set('');
    this.clientes.set([]);
  }

  cobrarEfectivo() {
    this.confirmarVenta('efectivo');
  }

  cobrarTransferencia() {
    this.confirmarVenta('transferencia');
  }

  irAFiado() {
    this.paso.set('fiado');
    this.buscarClientes('');
  }

  // ─────────────────────────── Fiado ───────────────────────────

  onBuscarCliente(valor: string) {
    this.clienteQuery.set(valor);
    if (this.debounceCli) clearTimeout(this.debounceCli);
    this.debounceCli = setTimeout(() => this.buscarClientes(valor), 200);
  }

  private buscarClientes(q: string) {
    this.api.buscarClientes(q.trim()).subscribe({
      next: (cli) => this.clientes.set(cli),
      error: () => this.clientes.set([]),
    });
  }

  elegirCliente(c: Cliente) {
    this.clienteSeleccionado.set(c);
  }

  crearClienteRapido() {
    const nombre = this.clienteQuery().trim();
    if (!nombre) {
      this.notificar('error', 'Escribí el nombre del cliente.');
      return;
    }
    this.api.crearCliente(nombre).subscribe({
      next: (c) => {
        this.clienteSeleccionado.set(c);
        this.buscarClientes('');
      },
      error: () => this.notificar('error', 'No se pudo crear el cliente.'),
    });
  }

  confirmarFiado() {
    const cliente = this.clienteSeleccionado();
    if (!cliente) {
      this.notificar('error', 'Elegí o creá un cliente para el fiado.');
      return;
    }
    this.confirmarVenta('fiado', cliente.id);
  }

  // ────────────────────── Registrar la venta ──────────────────────

  private confirmarVenta(
    medioPago: VentaInput['medioPago'],
    clienteId?: number
  ) {
    if (this.guardando()) return;
    this.guardando.set(true);

    const venta: VentaInput = {
      medioPago,
      clienteId: clienteId ?? null,
      items: this.ticket().map((it) =>
        it.productoId !== null
          ? { productoId: it.productoId, cantidad: it.cantidad }
          : {
              cantidad: it.cantidad,
              precioUnitario: it.precioUnitario,
              descripcion: it.nombre,
            }
      ),
    };

    this.api.registrarVenta(venta).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.limpiarTodo();
        this.notificar(
          'ok',
          `✅ Venta registrada — Total ${this.formatear(r.total)}`
        );
      },
      error: (err) => {
        this.guardando.set(false);
        const texto =
          err?.error?.error ?? 'No se pudo registrar la venta. Probá de nuevo.';
        this.notificar('error', texto);
      },
    });
  }

  private limpiarTodo() {
    this.ticket.set([]);
    this.query.set('');
    this.resultados.set([]);
    this.enfocado.set(false);
    this.paso.set('venta');
    this.clienteSeleccionado.set(null);
    this.clienteQuery.set('');
    this.clientes.set([]);
    // Releer el catálogo para reflejar el stock descontado por la venta.
    this.cargarCatalogo();
  }

  private notificar(tipo: 'ok' | 'error', texto: string) {
    this.mensaje.set({ tipo, texto });
    setTimeout(() => this.mensaje.set(null), 3500);
  }

  private formatear(n: number): string {
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }
}
