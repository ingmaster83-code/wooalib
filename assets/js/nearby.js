/* nearby.js - 현재위치 기반 주변 도서관 + 실시간 좌석 */

const PROXY_BASE = 'https://wooalib-proxy.ingmaster83.workers.dev/B551982/plr_v2';
const API_KEY    = '9490b1d34e92aa9e25b32a4cff1438fc7b9c71e5d332413916a391e867f61e86';

// API가 실제로 사용하는 stdgCd 매핑 (지역명 → API코드)
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

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatDist(km) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

function buildHoursHtml(l) {
  if (!l.hours && !l.hours_saturday) return '';
  const lines = [];
  if (l.hours)          lines.push(`⏰ 평일 ${l.hours}`);
  if (l.hours_saturday && l.hours_saturday !== l.hours) lines.push(`⏰ 토요일 ${l.hours_saturday}`);
  if (l.hours_holiday)  lines.push(`⏰ 공휴일 ${l.hours_holiday}`);
  if (l.closed_days)    lines.push(`🚫 휴관 ${l.closed_days}`);
  return lines.join('<br>');
}

async function fetchSeats(sido, sigungu) {
  const stdgCd = SEAT_CD_MAP[`${sido} ${sigungu}`];
  if (!stdgCd) return null;
  try {
    const url = `${PROXY_BASE}/rlt_rdrm_info_v2?serviceKey=${encodeURIComponent(API_KEY)}&type=json&numOfRows=20&pageNo=1&stdgCd=${stdgCd}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.body?.item;
    if (!items) return null;
    const list = Array.isArray(items) ? items : [items];
    const totalRemain = list.reduce((s, i) => s + (parseInt(i.rmndSeatCnt) || 0), 0);
    const totalSeats  = list.reduce((s, i) => s + (parseInt(i.tseatCnt) || 0), 0);
    return { remain: totalRemain, total: totalSeats, rooms: list.length };
  } catch {
    return null;
  }
}

function seatBadge(seats) {
  if (!seats) return `<span class="seat-badge seat-unknown">좌석정보 없음</span>`;
  const { remain, total } = seats;
  const pct = total > 0 ? Math.round((remain / total) * 100) : 0;
  const cls = pct >= 70 ? 'good' : pct >= 30 ? 'ok' : 'full';
  const label = pct >= 70 ? '여유' : pct >= 30 ? '보통' : '혼잡';
  return `<span class="seat-badge seat-${cls}">${label} ${remain}/${total}석</span>`;
}

async function findNearby() {
  const statusEl  = document.getElementById('geo-status');
  const resultsEl = document.getElementById('geo-results');

  statusEl.innerHTML = '<p class="geo-loading">📍 위치를 확인하는 중...</p>';
  resultsEl.style.display = 'none';

  if (!navigator.geolocation) {
    statusEl.innerHTML = '<p class="geo-error">⚠️ 이 브라우저는 위치 서비스를 지원하지 않습니다.</p>';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const myLat = pos.coords.latitude;
      const myLng = pos.coords.longitude;

      statusEl.innerHTML = '<p class="geo-loading">🔍 가까운 도서관을 찾는 중...</p>';

      let libraries;
      try {
        const res = await fetch('/search_index.json');
        libraries = await res.json();
      } catch {
        statusEl.innerHTML = '<p class="geo-error">⚠️ 도서관 데이터를 불러올 수 없습니다.</p>';
        return;
      }

      // 좌표 있는 도서관만 거리 계산
      const withDist = libraries
        .filter(l => l.lat && l.lng && parseFloat(l.lat) && parseFloat(l.lng))
        .map(l => ({ ...l, dist: haversine(myLat, myLng, parseFloat(l.lat), parseFloat(l.lng)) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 5);

      if (!withDist.length) {
        statusEl.innerHTML = '<p class="geo-error">⚠️ 주변 도서관을 찾을 수 없습니다.</p>';
        return;
      }

      // 일단 거리 결과 먼저 표시
      statusEl.innerHTML = `<p class="geo-info">📍 현재 위치 기준 가까운 도서관 (좌석 정보 로딩 중...)</p>`;
      resultsEl.style.display = 'grid';
      resultsEl.innerHTML = withDist.map(l => `
        <div class="geo-card" id="geo-card-${l.slug}">
          <div class="geo-card-top">
            <a href="/library/${l.slug}/" class="geo-card-name">${l.name}</a>
            <span class="geo-dist">${formatDist(l.dist)}</span>
          </div>
          <div class="geo-card-region">${l.sido} ${l.sigungu}</div>
          <div class="geo-card-hours">${buildHoursHtml(l)}</div>
          <div class="geo-card-seat" id="seat-${l.slug}">
            <div class="mini-spinner"></div>
          </div>
        </div>
      `).join('');

      // 좌석 정보 병렬 로드
      await Promise.all(withDist.map(async (l) => {
        const seats = await fetchSeats(l.sido, l.sigungu);
        const el = document.getElementById(`seat-${l.slug}`);
        if (el) el.innerHTML = seatBadge(seats);
      }));

      statusEl.innerHTML = `<p class="geo-info">📍 현재 위치 기준 가까운 도서관 <button class="geo-refresh-btn" onclick="findNearby()">🔄 새로고침</button></p>`;
    },
    (err) => {
      const msg = err.code === 1 ? '위치 권한이 거부되었습니다.' : '위치를 가져올 수 없습니다.';
      statusEl.innerHTML = `<p class="geo-error">⚠️ ${msg}</p>
        <button class="geo-btn" onclick="findNearby()">📍 다시 시도</button>`;
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}
