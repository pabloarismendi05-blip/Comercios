import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TopBar } from '../shared/top-bar';
import { ApiService, Cliente } from '../services/api.service';

@Component({
  selector: 'app-clientes',
  imports: [FormsModule, CurrencyPipe, RouterLink, TopBar],
  templateUrl: './clientes.html',
  styleUrl: './clientes.scss',
})
export class Clientes {
  private api = inject(ApiService);

  clientes = signal<Cliente[]>([]);
  filtro = signal('');
  cargando = signal(true);
  mensaje = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Alta rápida
  mostrarForm = signal(false);
  nombreNuevo = signal('');
  guardando = signal(false);

  visibles = computed(() => {
    const q = this.filtro().trim().toLowerCase();
    if (!q) return this.clientes();
    return this.clientes().filter((c) => c.nombre.toLowerCase().includes(q));
  });

  totalAdeudado = computed(() =>
    this.clientes().reduce((acc, c) => acc + c.saldo, 0)
  );

  constructor() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.api.listarClientes().subscribe({
      next: (c) => {
        this.clientes.set(c);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  crear() {
    const nombre = this.nombreNuevo().trim();
    if (!nombre) {
      this.notificar('error', 'Poné un nombre.');
      return;
    }
    this.guardando.set(true);
    this.api.crearCliente(nombre).subscribe({
      next: () => {
        this.guardando.set(false);
        this.mostrarForm.set(false);
        this.nombreNuevo.set('');
        this.notificar('ok', 'Cliente agregado.');
        this.cargar();
      },
      error: () => {
        this.guardando.set(false);
        this.notificar('error', 'No se pudo crear.');
      },
    });
  }

  private notificar(tipo: 'ok' | 'error', texto: string) {
    this.mensaje.set({ tipo, texto });
    setTimeout(() => this.mensaje.set(null), 3000);
  }
}
