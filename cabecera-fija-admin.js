// Mantiene la cabecera y sus controles anclados sin usar alturas fijas.
(() => {
  const cabecera = document.querySelector('body > header.cabecera-fija-app');
  if (!cabecera) return;
  const medir = () => {
    const alto = Math.ceil(cabecera.getBoundingClientRect().height);
    if (alto > 0) document.documentElement.style.setProperty('--cabecera-alto', alto + 'px');
    const canales = document.querySelector('.recepcion-canales');
    if (canales) {
      const altoCanales = Math.ceil(canales.getBoundingClientRect().height);
      if (altoCanales > 0) document.documentElement.style.setProperty('--recepcion-canales-alto', altoCanales + 'px');
    }
  };
  medir();
  if ('ResizeObserver' in window) {
    const observador = new ResizeObserver(medir);
    observador.observe(cabecera);
    const canales = document.querySelector('.recepcion-canales');
    if (canales) observador.observe(canales);
  } else {
    window.addEventListener('resize', medir, {passive: true});
  }
  window.addEventListener('pageshow', medir, {passive: true});
})();
