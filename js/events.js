/* ============================================================
   PROMPTSTUDIO — Event Bus
   Lightweight pub/sub for cross-component communication
   ============================================================ */

const _events = {};

export const Events = {
  /**
   * Register an event handler.
   * Events.on('diff:block-selected', (data) => { ... })
   */
  on(event, handler) {
    if (!_events[event]) _events[event] = [];
    _events[event].push(handler);
    return () => this.off(event, handler);
  },

  /**
   * Remove an event handler.
   */
  off(event, handler) {
    if (_events[event]) {
      _events[event] = _events[event].filter(fn => fn !== handler);
    }
  },

  /**
   * Emit an event with data.
   * Events.emit('version:created', { id: 4 })
   */
  emit(event, data) {
    if (_events[event]) {
      _events[event].forEach(fn => {
        try { fn(data); } catch (e) { console.error(`[Events] Error in handler for "${event}":`, e); }
      });
    }
  },

  /**
   * Remove all handlers for an event, or all events.
   */
  clear(event) {
    if (event) {
      delete _events[event];
    } else {
      Object.keys(_events).forEach(k => delete _events[k]);
    }
  },
};

export default Events;
