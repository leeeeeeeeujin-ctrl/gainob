// core/ws.js
const DEFAULT_WS_URL = 'wss://raid-api.leeeeeeeeujin.workers.dev/ws';
const WS_URL = localStorage.getItem('RSK_WS_URL') || DEFAULT_WS_URL;

export const WS = {
  _sock: null,
  _handlers: {},     // { TYPE: [fn, fn...] }
  _queue: [],        // open 전 송신 대기열
  _retries: 0,
  _maxRetries: 5,
  _retryTimer: null,

  connect() {
    // 이미 열렸거나 연결중이면 재사용
    if (this._sock && (this._sock.readyState === WebSocket.OPEN || this._sock.readyState === WebSocket.CONNECTING)) {
      return;
    }
    try { if (this._sock) this._sock.close(); } catch(_) {}
    clearTimeout(this._retryTimer);

    this._sock = new WebSocket(WS_URL);

    this._sock.onopen = () => {
      console.log('WebSocket connected');
      this._retries = 0;
      // 대기열 비우기
      while (this._queue.length) {
        try { this._sock.send(this._queue.shift()); } catch (e) { console.warn('WS flush fail:', e); break; }
      }
    };

    this._sock.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const t = msg?.type;
        const list = this._handlers[t] || [];
        list.forEach(fn => { try { fn(msg); } catch(_){} });
      } catch (err) {
        console.warn('WS onmessage parse error:', err);
      }
    };

    this._sock.onerror = (e) => {
      console.warn('WebSocket error:', e);
    };

    this._sock.onclose = (ev) => {
      console.log('WebSocket disconnected:', ev?.code || ev);
      if (this._retries < this._maxRetries) {
        const wait = Math.min(30000, 2000 * Math.pow(2, this._retries)); // 2s,4s,8s,16s,30s…
        this._retries++;
        console.log(`재연결 시도 ${this._retries}/${this._maxRetries} (${wait}ms 후)`);
        clearTimeout(this._retryTimer);
        this._retryTimer = setTimeout(() => this.connect(), wait);
      }
    };
  },

  _safeSend(obj) {
    const data = JSON.stringify(obj);
    if (this._sock && this._sock.readyState === WebSocket.OPEN) {
      try { this._sock.send(data); } catch (e) { console.warn('WS send fail:', e); }
    } else {
      // 아직 미연결이면 큐에 쌓고 connect 트리거
      this._queue.push(data);
      this.connect();
    }
  },

  // === 외부 API ===
  on(type, fn) {
    if (!this._handlers[type]) this._handlers[type] = [];
    this._handlers[type].push(fn);
  },

  off(type, fn) {
    const arr = this._handlers[type];
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  },

  emit(type, payload = {}) {
    this._safeSend({ type, ...payload });
  },

  join(roomId, clientId, name) {
    this._safeSend({ type: 'join', roomId, clientId, name });
  },

  // 로비/룸 공용 채팅 송신기 (로비는 roomId='lobby' 관례)
  chatSend(roomId, name, text, kind = 'gen') {
    // 서버 구현에 맞춰 필드명 조정 가능
    this._safeSend({
      type: 'CHAT',
      roomId,
      message: { name, text, kind }   // kind: 'ai' | 'gen'
    });
  },

  close() {
    try { this._sock?.close(); } catch(_) {}
    this._sock = null;
    clearTimeout(this._retryTimer);
  }
};
