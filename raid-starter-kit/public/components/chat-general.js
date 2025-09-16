// 일반 채팅 컴포넌트
import { WS } from '../core/ws.js';
import { mountChatLog } from './chat-log.js';

export function mountGeneralChat(root, { roomId, clientId, nameGetter }) {
  root.innerHTML = `
    <div class="card">
      <h4>일반 채팅</h4>
      <div id="box"></div>
      <div class="row" style="margin-top: 8px">
        <input id="txt" class="input grow" placeholder="메시지를 입력하세요...">
        <button id="send" class="btn primary">전송</button>
      </div>
    </div>
  `;

  const log = mountChatLog(root.querySelector('#box'));
  const txt = root.querySelector('#txt');
  const sendBtn = root.querySelector('#send');

  function sendMessage() {
    const message = txt.value.trim();
    if (!message) return;
    
    txt.value = '';
    WS.chatSend(clientId, 'general', nameGetter(), message);
  }

  sendBtn.addEventListener('click', sendMessage);
  txt.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  return log;
}
