// 채팅 로그 컴포넌트
export function mountChatLog(root) {
  root.innerHTML = `<div id="log" style="height: 240px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; padding: 8px; background: #fafafa;"></div>`;
  
  const log = root.querySelector('#log');

  function push(name, text) {
    const div = document.createElement('div');
    div.style.marginBottom = '4px';
    div.innerHTML = `<b>${escapeHtml(name)}:</b> ${escapeHtml(text)}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function sys(text) {
    const div = document.createElement('div');
    div.className = 'meta';
    div.style.marginBottom = '4px';
    div.style.fontStyle = 'italic';
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"]/g, match => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[match]));
  }

  return { push, sys };
}
