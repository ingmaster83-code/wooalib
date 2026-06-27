/* library.js - 도서관 상세 페이지: 실시간 좌석 + 인근 도서관 */

const BASE_URL = 'https://wooalib-proxy.ingmaster83.workers.dev/B551982/plr_v2';

const SEAT_CD_MAP = {
  '서울특별시 광진구':         '1121500000',
  '서울특별시 중랑구':         '1126000000',
  '서울특별시 노원구':         '1135000000',
  '서울특별시 마포구':         '1144000000',
  '서울특별시 강서구':         '1150000000',
  '서울특별시 관악구':         '1162000000',
  '서울특별시 강남구':         '1168000000',
  '부산광역시 기장군':         '2671000000',
  '대구광역시 수성구':         '2726000000',
  '인천광역시 연수구':         '2818500000',
  '인천광역시 남동구':         '2820000000',
  '인천광역시 서구':           '2826000000',
  '인천광역시 강화군':         '2871000000',
  '광주광역시 남구':           '2915500000',
  '경기도 수원시':             '4111000000',
  '경기도 성남시':             '4113000000',
  '경기도 안양시':             '4117000000',
  '경기도 부천시':             '4119000000',
  '경기도 광명시':             '4121000000',
  '경기도 동두천시':           '4125000000',
  '경기도 안산시':             '4127000000',
  '경기도 고양시':             '4128000000',
  '경기도 구리시':             '4131000000',
  '경기도 남양주시':           '4136000000',
  '경기도 오산시':             '4137000000',
  '경기도 군포시':             '4141000000',
  '경기도 용인시':             '4146000000',
  '경기도 이천시':             '4150000000',
  '경기도 화성시':             '4159000000',
  '경기도 광주시':             '4161000000',
  '충청북도 음성군':           '4377000000',
  '충청남도 보령시':           '4418000000',
  '충청남도 서산시':           '4421000000',
  '충청남도 당진시':           '4427000000',
  '전라남도 순천시':           '4615000000',
  '강원특별자치도 춘천시':     '5111000000',
  '전북특별자치도 전주시':     '5211000000',
  '전북특별자치도 군산시':     '5213000000',
  '전북특별자치도 익산시':     '5214000000',
};

async function loadSeatInfo() {
  const el = document.getElementById('seat-status');
  if (!el) return;
  el.innerHTML = '<div class="loading-spinner"></div><p>좌석 정보를 불러오는 중...</p>';

  try {
    const stdgCd = SEAT_CD_MAP[`${LIBRARY_SIDO} ${LIBRARY_SIGUNGU}`];
    if (!stdgCd) throw new Error('stdgCd 없음');
    const url = `${BASE_URL}/rlt_rdrm_info_v2?serviceKey=${encodeURIComponent(API_KEY)}&type=json&numOfRows=50&pageNo=1&stdgCd=${stdgCd}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const items = data?.body?.item;
    if (!items) throw new Error('데이터 없음');

    const list = Array.isArray(items) ? items : [items];
    const matched = list;

    if (!matched.length) {
      el.innerHTML = '<div class="seat-unavailable">⚠️ 이 도서관의 실시간 좌석 정보를 제공하지 않습니다.</div>';
      return;
    }

    let html = '<table class="seat-table"><thead><tr><th>열람실</th><th>총좌석</th><th>잔여</th><th>현황</th></tr></thead><tbody>';
    for (const item of matched) {
      const total = parseInt(item.tseatCnt) || 0;
      const remain = parseInt(item.rmndSeatCnt) || 0;
      const used = total - remain;
      const pct = total > 0 ? Math.round((used / total) * 100) : 0;
      const cls = pct < 30 ? 'good' : pct < 70 ? 'ok' : 'full';
      html += `<tr>
        <td>${item.rdrmNm || '-'}</td>
        <td>${total}</td>
        <td class="seats-${cls === 'good' ? 'good' : cls === 'ok' ? 'ok' : 'full'}">${remain}</td>
        <td><div class="seat-bar-wrap"><div class="seat-bar ${cls}" style="width:${pct}%"></div></div></td>
      </tr>`;
    }
    html += '</tbody></table>';
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<div class="seat-unavailable">⚠️ 실시간 좌석 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.</div>';
  }
}

async function loadNearby() {
  const el = document.getElementById('nearby-list');
  if (!el) return;

  try {
    const res = await fetch('/search_index.json');
    const data = await res.json();
    const nearby = data
      .filter(l => l.sigungu === LIBRARY_SIGUNGU && l.name !== LIBRARY_NAME)
      .slice(0, 8);

    if (!nearby.length) {
      el.innerHTML = '<p class="loading-text">같은 지역 다른 도서관 정보가 없습니다.</p>';
      return;
    }

    el.innerHTML = nearby.map(l => `
      <a href="/library/${l.slug}/" class="nearby-item">
        <div>
          <div class="ni-name">${l.name}</div>
          <div class="ni-hours">${l.hours || ''}</div>
        </div>
        <span class="tag tag-type">${l.type || ''}</span>
      </a>
    `).join('');
  } catch (e) {
    el.innerHTML = '<p class="loading-text">불러오기 실패</p>';
  }
}

function parseHours(hoursStr) {
  if (!hoursStr || hoursStr === '휴무' || hoursStr === '-') return null;
  const m = hoursStr.match(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { open: parseInt(m[1]) * 60 + parseInt(m[2]), close: parseInt(m[3]) * 60 + parseInt(m[4]) };
}

function showOpenStatus() {
  const el = document.getElementById('open-status');
  if (!el) return;

  const now = new Date();
  const dow = now.getDay(); // 0=일, 1-5=평일, 6=토
  const cur = now.getHours() * 60 + now.getMinutes();

  const closedKeywords = (LIBRARY_CLOSED_DAYS || '').split(/[+,\/\s]+/).map(s => s.trim()).filter(Boolean);
  const dowNames = ['일','월','화','수','목','금','토'];
  const todayName = dowNames[dow];

  if (closedKeywords.some(k => k === todayName || (k === '공휴일' && false))) {
    el.innerHTML = '<div class="open-badge closed">🔴 오늘 휴관일</div>';
    return;
  }

  let range;
  if (dow === 0) range = parseHours(LIBRARY_HOURS_HOLIDAY);
  else if (dow === 6) range = parseHours(LIBRARY_HOURS_SATURDAY);
  else range = parseHours(LIBRARY_HOURS_WEEKDAY);

  if (!range) {
    el.innerHTML = '<div class="open-badge closed">🔴 오늘 휴무</div>';
    return;
  }

  if (cur >= range.open && cur < range.close) {
    const closeH = Math.floor(range.close / 60);
    const closeM = String(range.close % 60).padStart(2, '0');
    el.innerHTML = `<div class="open-badge open">🟢 지금 운영 중 · ${closeH}:${closeM}에 닫힘</div>`;
  } else if (cur < range.open) {
    const openH = Math.floor(range.open / 60);
    const openM = String(range.open % 60).padStart(2, '0');
    el.innerHTML = `<div class="open-badge upcoming">🟡 오늘 ${openH}:${openM}에 열림</div>`;
  } else {
    el.innerHTML = '<div class="open-badge closed">🔴 오늘 운영 종료</div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  showOpenStatus();
  loadSeatInfo();
  loadNearby();
});
