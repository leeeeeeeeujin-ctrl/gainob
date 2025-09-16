// 슬롯 그리드 컴포넌트
export function mountSlotsGrid(root, { host = false, onClaim, onRelease, onReady, onKick, onRoleChange }) {
  root.innerHTML = `
    <div class="card">
      <h4>플레이어 슬롯</h4>
      <div class="grid" style="grid-template-columns: repeat(4, 1fr); gap: 12px;" id="grid"></div>
    </div>
  `;
  
  const grid = root.querySelector('#grid');
  let isHost = host;

  function render(room, meId) {
  const locked = room.status === 'raid';
  grid.innerHTML = room.slots.map(slot => {
      const mine = slot.playerId === meId;
      const opened = room.openSlots.includes(slot.slotNo);
      
      const img = slot.char?.image ? 
        `<div style="width: 100%; aspect-ratio: 1/1; overflow: hidden; border-radius: 8px; background: #f6f6f6">
          <img src="${slot.char.image}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>` : 
        `<div style="width: 100%; aspect-ratio: 1/1; border: 1px dashed var(--border); border-radius: 8px; display: grid; place-items: center; color: var(--muted);">
          No Image
        </div>`;

      // 역할 표시 및 호스트일 때 역할 select UI
      // 역할 UI 제거
      const roleEdit = '';
      return `
        <div class="card" data-slot="${slot.slotNo}" style="padding: 12px;">
          <div class="row" style="justify-content: space-between; margin-bottom: 8px; align-items:center;">
            <b>#${slot.slotNo}</b>
            ${opened ? '' : '<span class="meta">잠금</span>'}
          </div>
          ${slot.playerId ? img : ''}
          <div class="meta" style="margin: 4px 0;">
            ${slot.playerName || ''}
          </div>
          ${slot.char ? `
            <div class="meta">${slot.char.name} — ${slot.char.title || ''}</div>
            <details style="margin-top: 4px;">
              <summary>스킬</summary>
              <div class="meta">
                ${(slot.char.abilities || []).map(ability => 
                  `<div>• <b>${ability.name}</b> — ${ability.text}</div>`
                ).join('')}
              </div>
            </details>
          ` : '<div class="meta">(빈 슬롯)</div>'}
          <div class="row" style="margin-top: 8px; gap: 4px; flex-wrap: wrap;">
            ${slot.playerId ? 
              `<button class="btn ${slot.ready ? 'primary' : ''}" data-act="ready"${locked?' disabled':''}>
                ${slot.ready ? '준비해제' : '준비'}
              </button>` : ''
            }
            ${mine ? 
              `<button class="btn" data-act="release"${locked?' disabled':''}>자리 비우기</button>` : 
              (!slot.playerId && opened ? 
                `<button class="btn primary" data-act="claim"${locked?' disabled':''}>앉기</button>` : ''
              )
            }
            ${isHost && slot.playerId ? 
              `<button class="btn danger" data-act="kick"${locked?' disabled':''}>×</button>` : ''
            }
          </div>
        </div>
      `;
  // 역할 select 이벤트(호스트만)

    }).join('');
  }

  grid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-slot]');
    if (!card) return;
    
    const slotNo = parseInt(card.getAttribute('data-slot'), 10);
    const action = event.target.dataset.act;
    
    if (!action) return;
    
    switch (action) {
      case 'claim':
        onClaim?.(slotNo);
        break;
      case 'release':
        onRelease?.(slotNo);
        break;
      case 'ready':
        onReady?.(slotNo);
        break;
      case 'kick':
        onKick?.(slotNo);
        break;
    }
  });

  return { 
    render,
    setHost: (host) => { isHost = host; }
  };
}
