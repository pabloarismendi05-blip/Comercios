import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// La URL del backend sale de la config: en local apunta a localhost:3000,
// en producción a la URL pública (ver src/environments/).
const API = environment.apiBase;

export interface Producto {
  id: number;
  nombre: string;
  codigoBarras: string | null;
  precioVenta: number;
  precioCosto: number;
  stockActual: number;
  stockMinimo: number;
}

// Datos para crear/editar un producto.
export interface ProductoInput {
  nombre: string;
  precioVenta: number;
  precioCosto: number;
  stockActual: number;
  stockMinimo: number;
  codigoBarras?: string | null;
}

export interface Cliente {
  id: number;
  nombre: string;
  saldo: number;
}

export interface MovimientoHistorial {
  tipo: 'compra' | 'pago';
  fecha: string;
  monto: number;
}

export interface ClienteDetalle extends Cliente {
  historial: MovimientoHistorial[];
}

export interface VentaItemInput {
  productoId?: number | null;
  cantidad: number;
  precioUnitario?: number;
  descripcion?: string;
}

export interface VentaInput {
  items: VentaItemInput[];
  medioPago: 'efectivo' | 'transferencia' | 'fiado';
  clienteId?: number | null;
}

export interface VentaResultado {
  ok: boolean;
  ventaId: number;
  total: number;
}

export interface DiaResumen {
  fecha: string;
  etiqueta: string;
  total: number;
  esHoy: boolean;
}

export interface Resumen {
  hoy: {
    total: number;
    cantidad: number;
    porMedio: { efectivo: number; transferencia: number; fiado: number };
  };
  semana: { total: number; cantidad: number };
  porDia: DiaResumen[];
}

export interface VentaResumen {
  id: number;
  fechaHora: string;
  total: number;
  medioPago: string;
  clienteNombre: string | null;
  anulada: boolean;
}

export interface VentasDia {
  fecha: string;
  total: number;
  cantidad: number;
  ventas: VentaResumen[];
}

export interface VentaItemDetalle {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface VentaDetalle {
  id: number;
  fechaHora: string;
  total: number;
  medioPago: string;
  clienteNombre: string | null;
  anulada: boolean;
  anuladaEn: string | null;
  motivoAnulacion: string | null;
  items: VentaItemDetalle[];
}

// ── Caja / cierre ──
export type TipoMovimientoCaja = 'apertura' | 'gasto' | 'retiro';

// Un cierre ya hecho (snapshot congelado).
export interface CierreInfo {
  fecha: string;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  createdAt: string;
}

// La caja "abierta" = todo lo que pasó desde el último cierre.
export interface CajaAbierta {
  desde: string | null;
  apertura: number;
  ventasEfectivo: number;
  ventasTransferencia: number;
  ventasFiado: number;
  cobrosFiado: number;
  gastos: number;
  retiros: number;
  totalVendido: number;
  efectivoEsperado: number;
  hayActividad: boolean;
}

export interface EstadoCaja {
  abierta: CajaAbierta;
  ultimoCierre: CierreInfo | null;
}

export interface CierreResultado extends CierreInfo {
  ok: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // ── Resumen ──
  resumen(): Observable<Resumen> {
    return this.http.get<Resumen>(`${API}/resumen`);
  }

  // ── Productos ──
  buscarProductos(q: string): Observable<Producto[]> {
    return this.http.get<Producto[]>(`${API}/productos`, { params: { q } });
  }
  listarProductos(soloReponer = false): Observable<Producto[]> {
    const params: Record<string, string> = {};
    if (soloReponer) params['soloReponer'] = '1';
    return this.http.get<Producto[]>(`${API}/productos`, { params });
  }
  productoPorCodigo(codigo: string): Observable<Producto> {
    return this.http.get<Producto>(`${API}/productos/codigo/${encodeURIComponent(codigo)}`);
  }
  crearProducto(p: ProductoInput): Observable<Producto> {
    return this.http.post<Producto>(`${API}/productos`, p);
  }
  editarProducto(id: number, p: ProductoInput): Observable<Producto> {
    return this.http.put<Producto>(`${API}/productos/${id}`, p);
  }

  // ── Clientes ──
  buscarClientes(q: string): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(`${API}/clientes`, { params: { q } });
  }
  listarClientes(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(`${API}/clientes`);
  }
  clienteDetalle(id: number): Observable<ClienteDetalle> {
    return this.http.get<ClienteDetalle>(`${API}/clientes/${id}`);
  }
  crearCliente(nombre: string): Observable<Cliente> {
    return this.http.post<Cliente>(`${API}/clientes`, { nombre });
  }
  editarCliente(id: number, nombre: string): Observable<Cliente> {
    return this.http.put<Cliente>(`${API}/clientes/${id}`, { nombre });
  }
  registrarPago(id: number, monto: number): Observable<{ ok: boolean; saldo: number }> {
    return this.http.post<{ ok: boolean; saldo: number }>(
      `${API}/clientes/${id}/pagos`,
      { monto }
    );
  }

  // ── Ventas ──
  registrarVenta(venta: VentaInput): Observable<VentaResultado> {
    return this.http.post<VentaResultado>(`${API}/ventas`, venta);
  }
  ventasDelDia(fecha?: string): Observable<VentasDia> {
    const params: Record<string, string> = {};
    if (fecha) params['fecha'] = fecha;
    return this.http.get<VentasDia>(`${API}/ventas`, { params });
  }
  ventaDetalle(id: number): Observable<VentaDetalle> {
    return this.http.get<VentaDetalle>(`${API}/ventas/${id}`);
  }
  anularVenta(id: number, motivo?: string): Observable<{ ok: boolean; ventaId: number }> {
    return this.http.post<{ ok: boolean; ventaId: number }>(
      `${API}/ventas/${id}/anular`,
      { motivo }
    );
  }

  // ── Caja / cierre ──
  estadoCaja(): Observable<EstadoCaja> {
    return this.http.get<EstadoCaja>(`${API}/caja/cierre`);
  }
  registrarMovimientoCaja(
    tipo: TipoMovimientoCaja,
    monto: number,
    descripcion?: string
  ): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${API}/caja/movimiento`, {
      tipo,
      monto,
      descripcion,
    });
  }
  cerrarCaja(efectivoContado: number): Observable<CierreResultado> {
    return this.http.post<CierreResultado>(`${API}/caja/cierre`, {
      efectivoContado,
    });
  }
}
