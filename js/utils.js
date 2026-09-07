/* ============================================================
   PROMPTSTUDIO — Utilities
   DOM helpers, escape, toast, confetti, debounce
   ============================================================ */

/**
 * Query a single element.
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Query all matching elements.
 */
export function $$(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * Escape HTML entities to prevent XSS.
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Create a DOM element with attributes and children.
 * createEl('div', { class: 'foo', id: 'bar' }, 'text', childEl)
 */
export function createEl(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, val]) => {
    if (key === 'className') el.className = val;
    else if (key === 'dataset') Object.entries(val).forEach(([k, v]) => { el.dataset[k] = v; });
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else el.setAttribute(key, val);
  });
  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child instanceof Node) el.appendChild(child);
  });
  return el;
}

/**
 * Debounce a function.
 */
export function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle a function.
 */
export function throttle(fn, limit = 50) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

/**
 * Toast notification system.
 */
export function toast(msg, duration = 2500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.style.cssText = `
    background: var(--surface-2, #18181F);
    border: 1px solid var(--border-light, #333348);
    padding: 10px 16px;
    border-radius: var(--radius-md, 8px);
    font-size: 12px;
    color: var(--text-primary, #E8E8ED);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    animation: fadeInUp 0.3s cubic-bezier(0.16,1,0.3,1) both;
    pointer-events: auto;
    max-width: 320px;
    backdrop-filter: blur(8px);
  `;
  el.textContent = msg;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/**
 * Confetti celebration animation.
 */
export function spawnConfetti() {
  const colors = ['#6366F1', '#16A34A', '#4ADE80', '#FBBF24', '#60A5FA', '#F87171', '#818CF8'];
  for (let i = 0; i < 60; i++) {
    const particle = document.createElement('div');
    const size = 6 + Math.random() * 10;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
    const startY = window.innerHeight / 2;

    particle.style.cssText = `
      position: fixed; z-index: 9999; pointer-events: none;
      width: ${size}px; height: ${size * (0.4 + Math.random() * 0.6)}px;
      background: ${color}; border-radius: 2px;
      left: ${startX}px; top: ${startY}px; opacity: 1;
    `;
    document.body.appendChild(particle);

    const angle = Math.random() * Math.PI * 2;
    const velocity = 200 + Math.random() * 400;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity - 200;
    const rotation = (Math.random() - 0.5) * 1440;
    const duration = 800 + Math.random() * 1200;
    const startTime = performance.now();

    function animate(time) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const gravity = 300 * progress * progress;
      particle.style.transform = `
        translate(${vx * easeOut * (elapsed / 1000)}px, ${vy * easeOut * (elapsed / 1000) + gravity * progress}px)
        rotate(${rotation * progress}deg)
      `;
      particle.style.opacity = 1 - progress;
      if (progress < 1) requestAnimationFrame(animate);
      else particle.remove();
    }
    requestAnimationFrame(animate);
  }
}
