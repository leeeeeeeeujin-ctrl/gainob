// AI 채팅 컴포넌트
import { WS } from '../core/ws.js';
import { mountChatLog } from './chat-log.js';

export function mountAiChat(root, { roomId, clientId, nameGetter, canSpeak }) {
  root.innerHTML = `
    <div class="card">
      <h4>AI 채팅</h4>
      <div id="box"></div>
      <div class="row" style="margin-top: 8px">
        <input id="txt" class="input grow" placeholder="발화권이 있어야 보낼 수 있습니다">
        <button id="send" class="btn primary">전송</button>
      </div>
      <div class="meta" id="hint" style="margin-top: 4px"></div>
    </div>
  `;

  const log = mountChatLog(root.querySelector('#box'));
  const txt = root.querySelector('#txt');
  const sendBtn = root.querySelector('#send');
  const hint = root.querySelector('#hint');

  function updateSpeak(ok, mode, speaker) {
    txt.disabled = sendBtn.disabled = !ok;
    hint.textContent = ok ? 
      '입력 가능합니다' : 
      (mode === 'queue' ? 
        `대기 중 (현재 발화 슬롯: ${speaker})` : 
        '자유 모드가 아닙니다');
  }

  function sendMessage() {
    const message = txt.value.trim();
    if (!message) return;
    
    txt.value = '';
    WS.chatSend(clientId, 'ai', nameGetter(), message);
  }

  sendBtn.addEventListener('click', sendMessage);
  txt.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  return { log, updateSpeak };
}
