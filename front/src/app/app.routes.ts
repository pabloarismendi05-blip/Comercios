import { Routes } from '@angular/router';
import { Resumen } from './resumen/resumen';
import { Pos } from './pos/pos';
import { Productos } from './productos/productos';
import { Clientes } from './clientes/clientes';
import { ClienteDetalle } from './cliente-detalle/cliente-detalle';
import { Historial } from './historial/historial';

export const routes: Routes = [
  // El inicio es el resumen del día (lo primero que mira el dueño).
  { path: '', component: Resumen },
  { path: 'venta', component: Pos },
  { path: 'productos', component: Productos },
  { path: 'clientes', component: Clientes },
  { path: 'clientes/:id', component: ClienteDetalle },
  { path: 'historial', component: Historial },
  { path: '**', redirectTo: '' },
];
