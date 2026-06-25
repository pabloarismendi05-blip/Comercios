import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TopBar } from '../shared/top-bar';
import { ApiService, ClienteDetalle as Detalle } from '../services/api.service';

@Component({
  selector: 'app-cliente-detalle',
  imports: [FormsModule, CurrencyPipe, DatePipe, TopBar],
  templateUrl: './cliente-detalle.html',
  styleUrl: './cliente-detalle.scss',
})
export class ClienteDetalle {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  private id = Number(this.route.snapshot.paramMap.get('id'));

  detalle = signal<Detalle | null>(null);
  cargando = signal(true);
  mensaje = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Pago
  mostrarPago = signal(false);
  montoPago = signal<number | null>(null);
  procesando = signal(false);

  // Editar nombre
  mostrarEdit = signal(false);
  nombreEdit = signal('');

  constructor() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.api.clienteDetalle(this.id).subscribe({
      next: (d) => {
        this.detalle.set(d);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  // ── Pago ──
  abrirPago() {
    this.montoPago.set(this.detalle()?.saldo ?? null);
    this.mostrarPago.set(true);
  }

  pagarTodo() {
    this.montoPago.set(this.detalle()?.saldo ?? null);
  }

  registrarPago() {
    const monto = Number(this.montoPago());
    const saldo = this.detalle()?.saldo ?? 0;
    if (!Number.isFinite(monto) || monto <= 0) {
      this.notificar('error', 'Poné un monto mayor a cero.');
      return;
    }
    if (monto > saldo) {
      this.notificar('error', 'El pago no puede ser mayor a la deuda.');
      return;
    }
    this.procesando.set(true);
    this.api.registrarPago(this.id, monto).subscribe({
      next: () => {
        this.procesando.set(false);
        this.mostrarPago.set(false);
        this.notificar('ok', 'Pago registrado.');
        this.cargar();
      },
      error: (err) => {
        this.procesando.set(false);
        this.notificar('error', err?.error?.error ?? 'No se pudo registrar el pago.');
      },
    });
  }

  // ── Editar nombre ──
  abrirEdit() {
    this.nombreEdit.set(this.detalle()?.nombre ?? '');
    this.mostrarEdit.set(true);
  }

  guardarNombre() {
    const nombre = this.nombreEdit().trim();
    if (!nombre) {
      this.notificar('error', 'Poné un nombre.');
      return;
    }
    this.api.editarCliente(this.id, nombre).subscribe({
      next: () => {
        this.mostrarEdit.set(false);
        this.notificar('ok', 'Nombre actualizado.');
        this.cargar();
      },
      error: () => this.notificar('error', 'No se pudo guardar.'),
    });
  }

  private notificar(tipo: 'ok' | 'error', texto: string) {
    this.mensaje.set({ tipo, texto });
    setTimeout(() => this.mensaje.set(null), 3000);
  }
}
