/* ============================================================
   PROMPTSTUDIO — State Management
   Lightweight observable store (vanilla Zustand-like pattern)
   ============================================================ */

/**
 * Deep get a nested property via dot-path string.
 * Example: State.get('diff.changeBlocks') returns array.
 */
function deepGet(obj, path) {
  if (!path) return obj;
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Deep set a nested property via dot-path string.
 * Example: State.set('diff.active', true)
 */
function deepSet(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== 'object' || current[keys[i]] === null) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}

const _state = {};
const _subscribers = {};

export const State = {
  /**
   * Initialize the entire state tree.
   * @param {Object} initialState
   */
  init(initialState) {
    Object.assign(_state, JSON.parse(JSON.stringify(initialState)));
  },

  /**
   * Get a value by dot-path.
   * State.get('editor.content') → string
   * State.get() → entire state
   */
  get(path) {
    if (!path) return _state;
    return deepGet(_state, path);
  },

  /**
   * Set a value by dot-path and notify subscribers.
   * State.set('editor.content', newContent)
   * State.set({ editor: { content: '...' } }) — shallow merge at root
   */
  set(path, value) {
    if (typeof path === 'object') {
      // Batch set: State.set({ key: val, ... })
      Object.entries(path).forEach(([k, v]) => {
        deepSet(_state, k, v);
        _notify(k, v);
      });
      return;
    }
    deepSet(_state, path, value);
    _notify(path, value);
  },

  /**
   * Subscribe to changes on a specific path prefix.
   * State.subscribe('editor', (newVal, path) => { ... })
   * Returns unsubscribe function.
   */
  subscribe(path, callback) {
    if (!_subscribers[path]) _subscribers[path] = [];
    _subscribers[path].push(callback);
    return () => {
      _subscribers[path] = _subscribers[path].filter(fn => fn !== callback);
    };
  },

  /**
   * Unsubscribe a specific callback.
   */
  unsubscribe(path, callback) {
    if (_subscribers[path]) {
      _subscribers[path] = _subscribers[path].filter(fn => fn !== callback);
    }
  },
};

function _notify(path, value) {
  // Notify exact path subscribers
  if (_subscribers[path]) {
    _subscribers[path].forEach(fn => fn(value, path));
  }
  // Notify parent path subscribers (e.g., setting 'editor.content' notifies 'editor' subscribers)
  const parts = path.split('.');
  for (let i = parts.length - 1; i >= 0; i--) {
    const prefix = parts.slice(0, i).join('.');
    if (prefix && _subscribers[prefix]) {
      const prefixVal = deepGet(_state, prefix);
      _subscribers[prefix].forEach(fn => fn(prefixVal, path));
    }
  }
  // Notify global subscribers
  if (_subscribers['*']) {
    _subscribers['*'].forEach(fn => fn(_state, path));
  }
}

export default State;
