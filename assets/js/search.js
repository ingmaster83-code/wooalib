/* search.js - 메인 페이지 검색 (Fuse.js 기반 + 초성 검색) */

const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function getChosung(str) {
  return [...str].map(ch => {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return ch;
    return CHOSUNG[Math.floor(code / 28 / 21)];
  }).join('');
}

function isChosungOnly(str) {
  return [...str].every(ch => CHOSUNG.includes(ch));
}

let fuseInstance = null;
let searchData = [];

async function initSearch() {
  try {
    const res = await fetch('/search_index.json');
    searchData = await res.json();
    fuseInstance = new Fuse(searchData, {
      keys: ['name', 'sido', 'sigungu', 'address'],
      threshold: 0.35,
      minMatchCharLength: 1,
    });
  } catch (e) {
    console.warn('검색 인덱스 로드 실패', e);
  }
}

function doSearch(query) {
  const box = document.getElementById('search-results');
  if (!box) return;

  const q = query.trim();
  if (!q || !fuseInstance) { box.style.display = 'none'; return; }

  let results;
  if (isChosungOnly(q)) {
    const matched = searchData.filter(l =>
      getChosung(l.name).includes(q) ||
      getChosung(l.sigungu).includes(q)
    ).slice(0, 8).map(item => ({ item }));
    results = matched;
  } else {
    results = fuseInstance.search(q).slice(0, 8);
  }
  if (!results.length) { box.style.display = 'none'; return; }

  box.innerHTML = results.map(r => {
    const l = r.item;
    return `<div class="search-result-item" onclick="location.href='/library/${l.slug}/'">
      <div class="sr-name">${l.name}</div>
      <div class="sr-region">${l.sido} ${l.sigungu} · ${l.type || ''}</div>
    </div>`;
  }).join('');
  box.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  initSearch();

  const input = document.getElementById('search-input');
  const box   = document.getElementById('search-results');
  if (!input) return;

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => doSearch(input.value), 200);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && input.value.trim()) {
      const first = box && box.querySelector('.search-result-item');
      if (first) first.click();
    }
  });

  document.addEventListener('click', e => {
    if (!box) return;
    if (!box.contains(e.target) && e.target !== input) box.style.display = 'none';
  });
});
