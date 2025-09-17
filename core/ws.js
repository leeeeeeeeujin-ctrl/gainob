// C:\Users\yujin\Videos\gf\frontend\public\core\ws.js

const DEFAULT_WS_URL = 'https://raid-api.leeeeeeeeujin.workers.dev'; // ← 배포 주소로 바꿔넣기
const WS_URL = localStorage.getItem('RSK_WS_URL') || DEFAULT_WS_URL;

export const WS = {
  _sock: null,
  _handlers: {},

  connect() {
    if (this._sock && (this._sock.readyState === 0 || this._sock.readyState === 1)) return;
    this._sock = new WebSocket(WS_URL);
    this._sock.onopen = () => console.log('WebSocket connected');
    this._sock.onclose = (e) => console.log('WebSocket disconnected:', e.code);
    this._sock.onerror = (e) => console.warn('WebSocket error:', e);
    this._sock.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg?.type && this._handlers[msg.type]) {
          this._handlers[msg.type].forEach(fn => fn(msg));
        }
      } catch (_) {}
    };
  },

  join(roomId, clientId, name) {
    this.connect();
    this._sock?.send(JSON.stringify({ type: 'join', roomId, clientId, name }));
  },

  on(type, fn) {
    if (!this._handlers[type]) this._handlers[type] = [];
    this._handlers[type].push(fn);
  },

  emit(type, payload) {
    this._sock?.send(JSON.stringify({ type, ...payload }));
  }
};
