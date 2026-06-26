import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

// Overlay de pantalla completa que abre la cámara y lee un código de barras.
// Emite (codigo) con el texto leído y (cerrar) cuando se cancela o falla.
@Component({
  selector: 'app-scanner',
  template: `
    <div class="scan-overlay">
      <video #video class="scan-video" autoplay muted playsinline></video>

      <div class="scan-marco"></div>

      @if (error()) {
        <div class="scan-error">
          <p>{{ error() }}</p>
        </div>
      } @else {
        <p class="scan-ayuda">Apuntá la cámara al código de barras</p>
      }

      <button type="button" class="scan-cerrar" (click)="cancelar()">Cancelar</button>
    </div>
  `,
  styles: [
    `
      .scan-overlay {
        position: fixed;
        inset: 0;
        z-index: 100;
        background: #000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .scan-video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .scan-marco {
        position: relative;
        width: 78%;
        max-width: 360px;
        height: 150px;
        border: 3px solid #0a8754;
        border-radius: 14px;
        box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.45);
      }
      .scan-ayuda,
      .scan-error {
        position: absolute;
        bottom: 110px;
        left: 1rem;
        right: 1rem;
        text-align: center;
        color: #fff;
        font-weight: 600;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
      }
      .scan-error {
        background: rgba(176, 70, 50, 0.92);
        padding: 0.85rem 1rem;
        border-radius: 12px;
      }
      .scan-error p {
        margin: 0;
      }
      .scan-cerrar {
        position: absolute;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%);
        border: none;
        border-radius: 12px;
        background: #fff;
        color: #1f2933;
        font-size: 1.05rem;
        font-weight: 700;
        padding: 0.85rem 2.5rem;
      }
    `,
  ],
})
export class Scanner implements AfterViewInit, OnDestroy {
  codigo = output<string>();
  cerrar = output<void>();

  private video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private controles: IScannerControls | null = null;
  error = signal('');

  async ngAfterViewInit() {
    // Solo códigos de barras de productos (1D): más rápido y preciso.
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
    ]);
    // delayBetweenScanAttempts bajo = intenta leer muchas veces por segundo,
    // así "toma" el código apenas entra en cuadro, sin esperar.
    const lector = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 100,
    });

    // Forzamos la cámara TRASERA y buena resolución; el enfoque continuo lo
    // pedimos después sobre el track (no todos los celus lo aceptan en constraints).
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    try {
      this.controles = await lector.decodeFromConstraints(
        constraints,
        this.video().nativeElement,
        (resultado) => {
          if (resultado) {
            const texto = resultado.getText();
            this.detener();
            this.codigo.emit(texto);
          }
        }
      );
      // Pedir enfoque automático continuo si la cámara lo soporta.
      this.activarEnfoqueContinuo();
    } catch (e: any) {
      // Permiso denegado, sin cámara, o contexto no seguro (sin HTTPS).
      if (e?.name === 'NotAllowedError') {
        this.error.set('No diste permiso para usar la cámara.');
      } else if (e?.name === 'NotFoundError') {
        this.error.set('No se encontró ninguna cámara.');
      } else {
        this.error.set('No se pudo abrir la cámara. Probá desde el celular.');
      }
    }
  }

  // Pide a la cámara enfoque automático continuo, así no hay que tocar la
  // pantalla para que enfoque. Si el dispositivo no lo soporta, no pasa nada.
  private async activarEnfoqueContinuo() {
    try {
      const stream = this.video().nativeElement.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks?.()[0];
      if (!track) return;
      const caps = track.getCapabilities?.() as any;
      if (caps?.focusMode?.includes?.('continuous')) {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as any],
        });
      }
    } catch {
      // Algunos celulares no permiten cambiar el enfoque: lo ignoramos.
    }
  }

  cancelar() {
    this.detener();
    this.cerrar.emit();
  }

  private detener() {
    this.controles?.stop();
    this.controles = null;
  }

  ngOnDestroy() {
    this.detener();
  }
}
