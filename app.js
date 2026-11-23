// ===================================================
// Inspección Visual PWA - JavaScript Vanilla
// Asincronía resuelta solo con .then() / .catch() / .finally()
// ===================================================

// ---------- Referencias del DOM ----------
const btnInstalar = document.getElementById('btn-instalar');
const btnPrepararCamara = document.getElementById('btn-preparar-camara');
const btnConfirmarPermiso = document.getElementById('btn-confirmar-permiso');
const btnCancelarPermiso = document.getElementById('btn-cancelar-permiso');
const btnAlternarCamara = document.getElementById('btn-alternar-camara');
const btnApagarCamara = document.getElementById('btn-apagar-camara');
const avisoPermiso = document.getElementById('aviso-permiso');
const visorVideo = document.getElementById('visor-camara');
const visorVacio = document.getElementById('visor-vacio');
const mensajeEstado = document.getElementById('mensaje-estado');

// ---------- Estado ----------
let eventoInstalacionDiferido = null;
let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = trasera | 'user' = frontal
let cambiandoCamara = false;

// ---------- Utilidades de UI ----------
function actualizarMensajeEstado(texto) {
  mensajeEstado.textContent = texto;
}

function actualizarControles(camaraEncendida) {
  btnAlternarCamara.disabled = !camaraEncendida;
  btnApagarCamara.disabled = !camaraEncendida;
  btnPrepararCamara.hidden = camaraEncendida;
  visorVacio.hidden = camaraEncendida;
}

// ===================================================
// FASE 1: Service Worker e Instalabilidad
// ===================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registro) => {
        console.log('Service Worker registrado con scope:', registro.scope);
      })
      .catch((error) => {
        console.error('Error al registrar el Service Worker:', error);
      });
  });
}

function estaEnModoInstalado() {
  return window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
}

// Capturar el evento de instalación (Chrome / Android)
window.addEventListener('beforeinstallprompt', (event) => {
  // Evita que el mini-banner automático aparezca antes de tiempo
  event.preventDefault();
  eventoInstalacionDiferido = event;
  // Muestra el botón personalizado de instalación
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacionDiferido) return;

  eventoInstalacionDiferido.prompt();
  eventoInstalacionDiferido.userChoice
    .then((resultado) => {
      if (resultado.outcome === 'accepted') {
        btnInstalar.hidden = true;
        actualizarMensajeEstado('Instalando la aplicación en tu pantalla de inicio...');
      } else {
        actualizarMensajeEstado('Instalación cancelada. Puedes instalarla más tarde.');
      }
    })
    .finally(() => {
      // El evento solo puede usarse una vez
      eventoInstalacionDiferido = null;
    });
});

window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
  eventoInstalacionDiferido = null;
  actualizarMensajeEstado('Aplicación instalada correctamente.');
});

// Guía manual para iPhone (beforeinstallprompt no existe en iOS)
function verificarEntornoIOS() {
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (esIOS && !estaEnModoInstalado()) {
    const guiaIOS = document.getElementById('instrucciones-ios');
    if (guiaIOS) guiaIOS.hidden = false;
  }
}

verificarEntornoIOS();

// ===================================================
// FASE 2: Control de Cámara
// ===================================================

// Liberar el sensor antes de cualquier cambio
function detenerCamaraActiva() {
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

function iniciarCamara(modo) {
  detenerCamaraActiva();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    actualizarMensajeEstado('Tu navegador no permite acceder a la cámara (se requiere HTTPS).');
    return Promise.resolve();
  }

  const restricciones = {
    video: { facingMode: modo },
    audio: false
  };

  actualizarMensajeEstado('Encendiendo cámara...');

  return navigator.mediaDevices.getUserMedia(restricciones)
    .then((stream) => {
      streamActual = stream;
      visorVideo.srcObject = stream;
      // Efecto espejo solo para la cámara frontal
      visorVideo.classList.toggle('espejo', modo === 'user');
      actualizarControles(true);
      actualizarMensajeEstado(`Cámara activa (${modo === 'environment' ? 'Trasera' : 'Frontal'})`);
    })
    .catch((error) => {
      actualizarControles(false);
      visorVideo.srcObject = null;
      if (error.name === 'NotAllowedError') {
        actualizarMensajeEstado('Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.');
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        actualizarMensajeEstado('No se detectó el sensor de cámara solicitado en este dispositivo.');
      } else if (error.name === 'NotReadableError') {
        actualizarMensajeEstado('La cámara está ocupada por otra aplicación. Ciérrala e inténtalo de nuevo.');
      } else {
        actualizarMensajeEstado(`Error al acceder al hardware: ${error.message}`);
      }
    });
}

// ---------- Flujo de Pre-Permiso (UX Ética) ----------

// Paso 1: El usuario pulsa "Solicitar Acceso a Cámara" -> Mostramos aviso explicativo
btnPrepararCamara.addEventListener('click', () => {
  avisoPermiso.hidden = false;
  btnPrepararCamara.hidden = true;
  avisoPermiso.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// Paso 2: El usuario lee el motivo y pulsa "Aceptar y Encender Cámara"
btnConfirmarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  iniciarCamara(modoCamaraActual);
});

// Opción para rechazar sin disparar el diálogo nativo
btnCancelarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  btnPrepararCamara.hidden = false;
  actualizarMensajeEstado('No se solicitó el permiso. Puedes activarla cuando quieras.');
});

// ---------- Alternar lente trasera / frontal ----------
btnAlternarCamara.addEventListener('click', () => {
  if (cambiandoCamara) return;
  cambiandoCamara = true;
  btnAlternarCamara.disabled = true;

  modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';

  iniciarCamara(modoCamaraActual)
    .finally(() => {
      cambiandoCamara = false;
      if (streamActual) btnAlternarCamara.disabled = false;
    });
});

// ---------- Apagar cámara ----------
btnApagarCamara.addEventListener('click', () => {
  detenerCamaraActiva();
  visorVideo.srcObject = null;
  actualizarControles(false);
  actualizarMensajeEstado('Cámara apagada. El sensor fue liberado.');
});

// Liberar el sensor si la app pasa a segundo plano
document.addEventListener('visibilitychange', () => {
  if (document.hidden && streamActual) {
    detenerCamaraActiva();
    visorVideo.srcObject = null;
    actualizarControles(false);
    actualizarMensajeEstado('Cámara apagada al salir de la app. Pulsa el botón para volver a encenderla.');
  }
});
