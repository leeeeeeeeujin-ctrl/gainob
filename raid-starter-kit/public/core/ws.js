// core/ws.js

// 기본값: 반드시 /ws 포함
const DEFAULT_WS_URL = 'wss://raid-api.leeeeeeeeujin.workers.dev/ws';

// URL 정규화: https → wss, /ws 미포함이면 붙여줌
function normalizeWS(raw) {
  try {
    let u = (raw || '').trim();
    if (!u) u = DEFAULT_WS_URL;

    // 스킴 보정
    if (u.startsWith('http://')) u = 'ws://'  + u.slice(7);
    if (u.startsWith('https://')) u = 'wss://' + u.slice(8);

    // 프로토콜 없으면 wss:// 붙이기
    if (!/^wss?:\/\//i.test(u)) u = 'wss://' + u.replace(/^\/+/, '');

    // 경로에 /ws 없으면 추가
    const url = new URL(u);
    if (!url.pathname || url.pathname === '/' ) url.pathname = '/ws';
    if (!/\/ws$/i.test(url.pathname)) url.pathname = url.pathname.replace(/\/+$/, '') + '/ws';

    return url.toString();
  } catch (_) {
    return DEFAULT_WS_URL;
  }
}

const RAW_WS_URL = localStorage.getItem('RSK_WS_URL') || DEFAULT_WS_URL;
const WS_URL = normalizeWS(RAW_WS_URL);

export const WS = {
  _sock: null,
  _handlers: {},      // { TYPE: [fn...] }
  _queue: [],         // open 전에 보낼 메시지들
  _retries: 0,
  _maxRetries: 5,
  _retryTimer: null,

  connect() {
    // 이미 OPEN/CONNECTING이면 재사용
    if (this._sock && (this._sock.readyState === WebSocket.OPEN || this._sock.readyState === WebSocket.CONNECTING)) {
      return;
    }
    try { this._sock?.close(); } catch(_) {}
    clearTimeout(this._retryTimer);

    console.log('[WS] connecting to', WS_URL);
    this._sock = new WebSocket(WS_URL);

    this._sock.onopen = () => {
      console.log('[WS] connected');
      this._retries = 0;
      // 대기열 비우기
      while (this._queue.length) {
        const data = this._queue.shift();
        try { this._sock.send(data); } catch (e) { console.warn('[WS] flush fail:', e); break; }
      }
    };

    this._sock.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const list = this._handlers[msg?.type] || [];
        list.forEach(fn => { try { fn(msg); } catch(_){} });
      } catch (err) {
        console.warn('[WS] onmessage parse error:', err);
      }
    };

    this._sock.onerror = (e) => {
      console.warn('[WS] error:', e);
    };

    this._sock.onclose = (ev) => {
      console.log('[WS] disconnected:', ev?.code || ev);
      if (this._retries < this._maxRetries) {
        const wait = Math.min(30000, 2000 * Math.pow(2, this._retries)); // 2s→4s→8s→16s→30s
        this._retries++;
        console.log(`[WS] reconnect ${this._retries}/${this._maxRetries} in ${wait}ms`);
        clearTimeout(this._retryTimer);
        this._retryTimer = setTimeout(() => this.connect(), wait);
      }
    };
  },

  _safeSend(obj) {
    const data = JSON.stringify(obj);
    if (this._sock && this._sock.readyState === WebSocket.OPEN) {
      try { this._sock.send(data); } catch (e) { console.warn('[WS] send fail:', e); }
    } else {
      // CONNECTING/나머지 상태 → 큐에 쌓고 connect 보장
      this._queue.push(data);
      this.connect();
    }
  },

  // 외부 API
  on(type, fn) {
    (this._handlers[type] ||= []).push(fn);
  },
  off(type, fn) {
    const arr = this._handlers[type]; if (!arr) return;
    const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1);
  },
  emit(type, payload = {}) {
    this._safeSend({ type, ...payload });
  },
  join(roomId, clientId, name) {
    this._safeSend({ type: 'join', roomId, clientId, name });
  },
  // 로비/룸 공용 채팅 전송 (로비는 roomId='lobby')
chatSend(roomId, name, text, kind = 'gen') {
  // 서버는 평면형을 기대하므로 이 포맷으로 보냄
  // - type: 'chat'
  // - fields: name, text, kind
  // roomId는 server 측에서 join 시점에 기억하므로 따로 보내지 않아도 됨
  this._safeSend({ type: 'chat', name, text, kind });
},
  close() {
    try { this._sock?.close(); } catch(_) {}
    this._sock = null;
    clearTimeout(this._retryTimer);
  }
};
