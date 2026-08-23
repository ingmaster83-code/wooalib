# -*- coding: utf-8 -*-
"""
전국 도서관 실시간 열람실 좌석 정보(B551982/plr_v2/rlt_rdrm_info_v2)를 주기적으로 가져와
assets/data/seat_info.json으로 저장한다.

Cloudflare Worker 프록시(wooalib-proxy)를 거치면 원인 불명의 HTTP_ERROR가 발생해
(직접 호출·배포코드 확인 둘 다 문제 없음 확인됨, 2026-08-23) 대신
GitHub Actions 서버에서 직접 호출 → 정적 JSON으로 저장하는 방식으로 전환.
클라이언트는 이 JSON을 fetch해서 도서관명으로 매칭한다.
"""
import json, os, re, sys, time, urllib.request, urllib.parse

KEY = '9490b1d34e92aa9e25b32a4cff1438fc7b9c71e5d332413916a391e867f61e86'
BASE = 'https://apis.data.go.kr/B551982/plr_v2/rlt_rdrm_info_v2'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# library.js의 SEAT_CD_MAP과 동일한 목록 (실시간 열람실 좌석 정보 제공 지역)
SEAT_CD_MAP = {
    '서울특별시 광진구': '1121500000', '서울특별시 중랑구': '1126000000',
    '서울특별시 노원구': '1135000000', '서울특별시 마포구': '1144000000',
    '서울특별시 강서구': '1150000000', '서울특별시 관악구': '1162000000',
    '서울특별시 강남구': '1168000000', '부산광역시 기장군': '2671000000',
    '대구광역시 수성구': '2726000000', '인천광역시 연수구': '2818500000',
    '인천광역시 남동구': '2820000000', '인천광역시 서구': '2826000000',
    '인천광역시 강화군': '2871000000', '광주광역시 남구': '2915500000',
    '경기도 수원시': '4111000000', '경기도 성남시': '4113000000',
    '경기도 안양시': '4117000000', '경기도 부천시': '4119000000',
    '경기도 광명시': '4121000000', '경기도 동두천시': '4125000000',
    '경기도 안산시': '4127000000', '경기도 고양시': '4128000000',
    '경기도 구리시': '4131000000', '경기도 남양주시': '4136000000',
    '경기도 오산시': '4137000000', '경기도 군포시': '4141000000',
    '경기도 용인시': '4146000000', '경기도 이천시': '4150000000',
    '경기도 화성시': '4159000000', '경기도 광주시': '4161000000',
    '충청북도 음성군': '4377000000', '충청남도 보령시': '4418000000',
    '충청남도 서산시': '4421000000', '충청남도 당진시': '4427000000',
    '전라남도 순천시': '4615000000', '강원특별자치도 춘천시': '5111000000',
    '전북특별자치도 전주시': '5211000000', '전북특별자치도 군산시': '5213000000',
    '전북특별자치도 익산시': '5214000000',
}


def call(stdg_cd, retries=3):
    params = {'serviceKey': KEY, 'type': 'json', 'numOfRows': '200', 'pageNo': '1', 'stdgCd': stdg_cd}
    url = BASE + '?' + urllib.parse.urlencode(params)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=20) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            if attempt == retries - 1:
                print(f'  실패({stdg_cd}): {e}')
                return None
            time.sleep(2)


def main():
    by_library = {}
    ok, fail = 0, 0

    for region, stdg_cd in SEAT_CD_MAP.items():
        data = call(stdg_cd)
        if not data:
            fail += 1
            continue
        items = data.get('body', {}).get('item', [])
        if isinstance(items, dict):
            items = [items]
        if not items:
            ok += 1
            continue
        for it in items:
            name = it.get('pblibNm', '').strip()
            if not name:
                continue
            by_library.setdefault(name, []).append({
                'rdrmNm': it.get('rdrmNm', ''),
                'total': int(it.get('tseatCnt') or 0),
                'used': int(it.get('useSeatCnt') or 0),
                'remain': int(it.get('rmndSeatCnt') or 0),
            })
        ok += 1
        time.sleep(0.2)

    out_dir = os.path.join(ROOT, 'assets', 'data')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'seat_info.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({'updatedAt': time.strftime('%Y-%m-%d %H:%M:%S'), 'libraries': by_library}, f, ensure_ascii=False, indent=1)

    print(f'지역 {ok}개 성공, {fail}개 실패')
    print(f'도서관 {len(by_library)}곳 좌석 정보 저장: {out_path}')


if __name__ == '__main__':
    main()
