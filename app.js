// 교실 서랍: apps.js 의 목록을 읽어 탭과 카드를 그립니다.
(() => {
  'use strict';

  const tabs = (window.HUB && window.HUB.tabs && window.HUB.tabs.length)
    ? window.HUB.tabs
    : [{ id: 'all', label: '전체' }];
  const apps = window.APPS || [];
  const firstTab = tabs[0].id;
  const tabOf = (a) => a.tab || firstTab;

  const tablist = document.getElementById('tabs');
  const grid = document.getElementById('grid');

  const ARROW =
    '<svg class="arrow" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">' +
    '<path d="M6 14 14 6M7.5 6H14v6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const LINK =
    '<svg class="link-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">' +
    '<g transform="rotate(-45 12 12)" fill="none" stroke="currentColor" stroke-width="1.8">' +
    '<rect x="2.5" y="8.5" width="10" height="7" rx="3.5"/><rect x="11.5" y="8.5" width="10" height="7" rx="3.5"/></g></svg>';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // 카드에 보여 줄 짧은 주소: https:// 와 ?뒤 꼬리표를 빼고, 한글 주소는 읽을 수 있게 풀어서
  function shortAddress(url) {
    try {
      const u = new URL(url);
      const path = decodeURIComponent(u.pathname).replace(/\/$/, '');
      return u.host + path;
    } catch (e) {
      return url;
    }
  }

  function cardHTML(a, i) {
    const src = a.shot || ('shots/' + a.id + '.jpg');
    const initial = [...String(a.name || '')][0] || '';
    return (
      '<a class="card" href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="shot" data-initial="' + esc(initial) + '">' +
          '<img src="' + esc(src) + '" alt="" width="960" height="600" decoding="async"' + (i < 3 ? '' : ' loading="lazy"') + '>' +
        '</div>' +
        '<div class="cap">' +
          '<div class="name-row"><h2 class="name">' + esc(a.name) + '<span class="sr"> (새 창에서 열림)</span></h2>' + ARROW + '</div>' +
          (a.desc ? '<p class="desc">' + esc(a.desc) + '</p>' : '') +
          '<p class="addr">' + LINK + '<span>' + esc(shortAddress(a.url)) + '</span></p>' +
        '</div>' +
      '</a>'
    );
  }

  // 사진 파일이 없거나 못 불러오면 자리표시(이름 첫 글자)로 바꿈. error 는 버블링되지 않아 캡처로 받음.
  grid.addEventListener('error', (e) => {
    const img = e.target;
    if (img && img.tagName === 'IMG') {
      const shot = img.closest('.shot');
      if (shot) shot.classList.add('noshot');
      img.remove();
    }
  }, true);

  // 탭 버튼은 한 번만 만들고, 이후에는 선택 상태만 바꿈
  tablist.innerHTML = tabs.map((t) => {
    const n = apps.filter((a) => tabOf(a) === t.id).length;
    return '<button type="button" role="tab" id="tab-' + esc(t.id) + '" data-tab="' + esc(t.id) +
      '" aria-controls="grid">' + esc(t.label) + '<span class="count">' + n + '</span></button>';
  }).join('');
  const buttons = [...tablist.querySelectorAll('[role="tab"]')];

  function select(id, opts) {
    opts = opts || {};
    if (!tabs.some((t) => t.id === id)) id = firstTab;

    buttons.forEach((b) => {
      const on = b.dataset.tab === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    grid.setAttribute('aria-labelledby', 'tab-' + id);

    const list = apps.filter((a) => tabOf(a) === id);
    grid.innerHTML = list.length ? list.map(cardHTML).join('') : '<p class="empty">아직 앱이 없어요.</p>';

    grid.classList.remove('swap');
    void grid.offsetWidth; // 애니메이션을 처음부터 다시 재생
    grid.classList.add('swap');

    if (opts.updateHash) {
      try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// 등에서는 무시 */ }
    }
  }

  tablist.addEventListener('click', (e) => {
    const b = e.target.closest('[role="tab"]');
    if (b) select(b.dataset.tab, { updateHash: true });
  });

  // 방향키·Home·End 로 탭 이동
  tablist.addEventListener('keydown', (e) => {
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % buttons.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + buttons.length) % buttons.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = buttons.length - 1;
    if (next < 0) return;
    e.preventDefault();
    buttons[next].focus();
    select(buttons[next].dataset.tab, { updateHash: true });
  });

  const fromHash = () => location.hash.replace(/^#/, '');
  window.addEventListener('hashchange', () => select(fromHash()));
  select(fromHash());
})();
