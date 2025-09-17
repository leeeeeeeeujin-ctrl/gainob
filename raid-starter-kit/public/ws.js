// ✅ 배포 주소로 교체
const DEFAULT_WS_URL = 'wss://raid-api.leeeeeeeeujin.workers.dev/ws';
const WS_URL = localStorage.getItem('RSK_WS_URL') || DEFAULT_WS_URL;

export const WS = {
  _sock: null,
  _handlers: {},
  _queue: [],               // ← 열리기 전 보낼 메시지 큐

  connect() {
    if (this._sock && (this._sock.readyState === 0 || this._sock.readyState === 1)) return;

    this._sock = new WebSocket(WS_URL);

    this._sock.onopen = () => {
      console.log('WebSocket connected');
      // 열리기 전에 쌓인 메시지 모두 전송
      while (this._queue.length) {
        this._sock.send(this._queue.shift());
      }
    };

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

  // 소켓이 아직 안 열렸으면 큐에 넣었다가 onopen에서 보냄
  _safeSend(obj) {
    const data = JSON.stringify(obj);
    if (this._sock && this._sock.readyState === 1) this._sock.send(data);
    else {
      this.connect();
      this._queue.push(data);
    }
  },

  join(roomId, clientId, name) {
    this._safeSend({ type: 'join', roomId, clientId, name });
  },

  on(type, fn) {
    if (!this._handlers[type]) this._handlers[type] = [];
    this._handlers[type].push(fn);
  },

  emit(type, payload) {
    this._safeSend({ type, ...payload });
  }
};
