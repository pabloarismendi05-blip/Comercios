import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Kiosco');
  private swUpdate = inject(SwUpdate);

  // Se prende cuando hay una versión nueva descargada y lista para usar.
  hayActualizacion = signal(false);

  constructor() {
    if (this.swUpdate.isEnabled) {
      // Avisar cuando una versión nueva quedó lista.
      this.swUpdate.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => this.hayActualizacion.set(true));

      // Buscar versión nueva al arrancar y cada 60 segundos, así no hay que
      // cerrar y reabrir la app a mano para que se actualice.
      this.swUpdate.checkForUpdate();
      setInterval(() => this.swUpdate.checkForUpdate(), 60_000);
    }
  }

  async actualizar() {
    await this.swUpdate.activateUpdate();
    document.location.reload();
  }
}
