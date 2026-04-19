import { readable } from 'svelte/store';

/** Retorna true se o dispositivo é mobile (touch + tela pequena ou UA móvel) */
function checkMobile() {
  if (typeof window === 'undefined') return false;

  const isTouch   = window.matchMedia('(pointer: coarse)').matches;
  const isNarrow  = window.innerWidth < 768;
  const isUA      = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  return isUA || (isTouch && isNarrow) || (!isTouch && isNarrow);
}

export const isMobile = readable(checkMobile(), (set) => {
  if (typeof window === 'undefined') return;

  function update() {
    set(checkMobile());
  }

  const mq = window.matchMedia('(max-width: 767px)');
  mq.addEventListener('change', update);
  window.addEventListener('resize', update, { passive: true });

  return () => {
    mq.removeEventListener('change', update);
    window.removeEventListener('resize', update);
  };
});
