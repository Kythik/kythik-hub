/* Arcana Board Dev Lab v3
   Deterministic 20-row visual QA board.
   Goal: show every major tile family plus rarity/style variants without touching production. */

const tileCycle = [
  {type:'start', label:'Start', icon:'✦', cls:'pos'},
  {type:'movement', label:'Move +1', move:'+1'},
  {type:'movement', label:'Move +2', move:'+2'},
  {type:'movement', label:'Move +3', move:'+3'},

  {type:'question', label:'Unknown'},
  {type:'chest', label:'Green Chest', rarity:'green'},
  {type:'chest', label:'Blue Chest', rarity:'blue'},
  {type:'chest', label:'Purple Chest', rarity:'purple'},

  {type:'chest', label:'Orange Chest', rarity:'orange'},
  {type:'chest', label:'Red Chest', rarity:'red'},
  {type:'chest', label:'Rainbow Chest', rarity:'rainbow'},
  {type:'upgrade', label:'Blue Card', upgrade:'blue'},

  {type:'upgrade', label:'Gold Card', upgrade:'gold'},
  {type:'life', label:'Life'},
  {type:'trap', label:'Trap'},
  {type:'empty', label:'Quiet Tile'},

  {type:'question', label:'Mystery +', variant:'premium'},
  {type:'chest', label:'Green+', rarity:'green', variant:'premium'},
  {type:'chest', label:'Blue+', rarity:'blue', variant:'premium'},
  {type:'chest', label:'Purple+', rarity:'purple', variant:'premium'},

  {type:'chest', label:'Orange+', rarity:'orange', variant:'premium'},
  {type:'chest', label:'Red+', rarity:'red', variant:'premium'},
  {type:'chest', label:'Rainbow+', rarity:'rainbow', variant:'premium'},
  {type:'upgrade', label:'Blue+', upgrade:'blue', variant:'premium'},

  {type:'upgrade', label:'Gold+', upgrade:'gold', variant:'premium'},
  {type:'movement', label:'Back +1', move:'+1', variant:'back'},
  {type:'movement', label:'Back +2', move:'+2', variant:'back'},
  {type:'movement', label:'Back +3', move:'+3', variant:'back'},

  {type:'empty', label:'Rune Tile', variant:'rune'},
  {type:'life', label:'Life+', variant:'premium'},
  {type:'trap', label:'Trap+', variant:'premium'},
  {type:'empty', label:'Quiet+', variant:'premium'}
];

const rows = Array.from({ length: 20 }, (_, rowIndex) => {
  return Array.from({ length: 4 }, (_, colIndex) => {
    const tileIndex = rowIndex * 4 + colIndex;
    const base = { ...tileCycle[tileIndex % tileCycle.length] };

    // Deliberately mark a few states so the visual lab shows overlays too.
    if (tileIndex === 0) base.cls = [base.cls, 'pos'].filter(Boolean).join(' ');
    if (tileIndex === 9) base.cls = [base.cls, 'reach'].filter(Boolean).join(' ');
    if (tileIndex === 18) base.cls = [base.cls, 'suggest'].filter(Boolean).join(' ');
    if (tileIndex === 27) base.land = 5;
    if (tileIndex === 45) base.land = 2;
    if (tileIndex === 63) base.cls = [base.cls, 'done'].filter(Boolean).join(' ');

    // Row-link samples every few rows, alternating with the snaking board.
    if (colIndex === 3 && rowIndex % 4 === 0) base.link = `${tileIndex + 1}→${tileIndex + 2}`;
    if (colIndex === 0 && rowIndex % 4 === 2) base.link = `${tileIndex + 1}→${tileIndex + 2}`;

    return base;
  });
});

function tileClass(t){
  const parts = ['tile'];
  if(t.type === 'chest') parts.push('chest', t.rarity || 'green');
  else parts.push(t.type);
  if(t.upgrade) parts.push(`upgrade-${t.upgrade}`);
  if(t.move) parts.push(`move-${t.move.replace('+','')}`);
  if(t.variant) parts.push(`variant-${t.variant}`);
  if(t.cls) parts.push(...String(t.cls).split(/\s+/).filter(Boolean));
  if(t.land) parts.push('landed');
  return parts.join(' ');
}
function tileIcon(t){
  if(t.type === 'chest') return `<span class="chestIcon" aria-hidden="true"><span class="chestLid"></span><span class="chestBody"></span><span class="chestLock"></span></span>`;
  if(t.type === 'question') return `<span class="tileIcon questionMark" aria-hidden="true">?</span>`;
  if(t.type === 'movement') return `<span class="tileIcon moveIcon" aria-hidden="true">${t.move || '+1'}</span>`;
  if(t.type === 'upgrade') return `<span class="tileIcon cardIcon" aria-hidden="true"></span>`;
  if(t.type === 'life') return `<span class="tileIcon lifeIcon" aria-hidden="true">✚</span>`;
  if(t.type === 'trap') return `<span class="tileIcon trapIcon" aria-hidden="true">◆</span>`;
  if(t.type === 'start') return `<span class="tileIcon startIcon" aria-hidden="true">✦</span>`;
  if(t.variant === 'rune') return `<span class="tileIcon emptyIcon runeIcon" aria-hidden="true">✧</span>`;
  return `<span class="tileIcon emptyIcon" aria-hidden="true">◇</span>`;
}
function render(){
  const board = document.getElementById('board');
  board.innerHTML = rows.map((row, rowIndex) => {
    const reverse = rowIndex % 2 === 1;
    const cells = row.map((t, i) => {
      const tileNum = rowIndex * 4 + i + 1;
      return `<button class="${tileClass(t)}" title="${t.label}">
        <span class="n">${tileNum}</span>
        <span class="tileArt">${tileIcon(t)}</span>
        <span class="c">${t.label}</span>
        ${t.land ? `<span class="land">${t.land}</span>` : ''}
      </button>`;
    }).join('');
    const link = row[row.length-1]?.link || row[0]?.link;
    const linkHtml = link ? `<span class="rowEndLink ${reverse ? 'left' : ''}"><span>${link}</span></span>` : '';
    return `<div class="boardRow ${reverse ? 'reverse' : ''}">${cells}${linkHtml}</div>`;
  }).join('');
}
render();
