// WebSocket 통신 모듈
export const WS = (() => {
  let ws;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const handlers = {};
  const pendingQueue = [];
  let isOpen = false;

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts = 0; // 연결 성공 시 재시도 횟수 리셋
      isOpen = true;
      // 연결되면 큐에 쌓인 메시지 전송
      while (pendingQueue.length) {
        try {
          ws.send(JSON.stringify(pendingQueue.shift()));
        } catch (e) {
          console.error('WS send failed after open:', e);
          break;
        }
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const handlerList = handlers[message.type] || [];
        handlerList.forEach(fn => fn(message));
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      isOpen = false;
      
      // 정상 종료가 아닌 경우에만 재연결 시도
      if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // 지수 백오프
        console.log(`재연결 시도 ${reconnectAttempts}/${maxReconnectAttempts} (${delay}ms 후)`);
        setTimeout(connect, delay);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('최대 재연결 시도 횟수 초과. 수동으로 새로고침하세요.');
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  function on(type, handler) {
    if (!handlers[type]) {
      handlers[type] = [];
    }
    handlers[type].push(handler);
  }

  function enqueueOrSend(obj) {
    if (ws && ws.readyState === WebSocket.OPEN && isOpen) {
      try { ws.send(JSON.stringify(obj)); } catch (e) { console.error('WS send error:', e); }
    } else {
      pendingQueue.push(obj);
    }
  }

  function join(roomId, clientId, name) {
    enqueueOrSend({ type: 'JOIN', roomId, clientId, name });
  }

  function chatSend(clientId, kind, name, text) {
    enqueueOrSend({ type: 'CHAT_SEND', clientId, kind, name, text });
  }

  return {
    connect,
    on,
    join,
    chatSend
  };
})();
