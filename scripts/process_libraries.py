#!/usr/bin/env python3
"""
process_libraries.py - 전국도서관표준데이터 JSON을 Jekyll용 _data/libraries.json으로 가공

사용법:
  python scripts/process_libraries.py
"""
import json
import re
import sys
from pathlib import Path
from unicodedata import normalize

sys.stdout.reconfigure(encoding='utf-8')

SRC  = Path(__file__).parent.parent / "manual" / "전국도서관표준데이터.json"
DEST = Path(__file__).parent.parent / "_data" / "libraries.json"


def slugify(text: str) -> str:
    text = normalize('NFC', text)
    text = re.sub(r'[^\w\s가-힣\-]', '', text)
    text = re.sub(r'[\s]+', '-', text.strip())
    return text.lower()


def make_slug(name: str, sido: str, sigungu: str) -> str:
    safe = name.replace(' ', '-').replace('/', '-').replace('(', '').replace(')', '')
    safe = re.sub(r'[^\w가-힣\-]', '', safe)
    region = (sido + '-' + sigungu).replace(' ', '-')
    region = re.sub(r'[^\w가-힣\-]', '', region)
    return f"{region}-{safe}".lower()


def parse_time(start: str, end: str) -> str:
    s = (start or '').strip()
    e = (end or '').strip()
    if not s and not e:
        return ''
    if s == '00:00' and e == '00:00':
        return '휴무'
    return f"{s}~{e}"


def main():
    raw = json.loads(SRC.read_text(encoding='utf-8'))
    records = raw.get('records', [])
    print(f"원본 레코드: {len(records)}건")

    slug_counter: dict[str, int] = {}
    libraries = []

    for r in records:
        name    = (r.get('도서관명') or '').strip()
        sido    = (r.get('시도명') or '').strip()
        sigungu = (r.get('시군구명') or '').strip()
        if not name or not sido:
            continue

        base_slug = make_slug(name, sido, sigungu)
        # 중복 슬러그 처리
        if base_slug in slug_counter:
            slug_counter[base_slug] += 1
            slug = f"{base_slug}-{slug_counter[base_slug]}"
        else:
            slug_counter[base_slug] = 0
            slug = base_slug

        lib = {
            'slug': slug,
            'name': name,
            'sido': sido,
            'sigungu': sigungu,
            'type': (r.get('도서관유형') or '').strip(),
            'closed_days': (r.get('휴관일') or '').strip(),
            'hours_weekday': parse_time(r.get('평일운영시작시각'), r.get('평일운영종료시각')),
            'hours_saturday': parse_time(r.get('토요일운영시작시각'), r.get('토요일운영종료시각')),
            'hours_holiday': parse_time(r.get('공휴일운영시작시각'), r.get('공휴일운영종료시각')),
            'seats': (r.get('열람좌석수') or '').strip(),
            'books': (r.get('자료수(도서)') or '').strip(),
            'loan_limit': (r.get('대출가능권수') or '').strip(),
            'loan_days': (r.get('대출가능일수') or '').strip(),
            'address': (r.get('소재지도로명주소') or '').strip(),
            'tel': (r.get('도서관전화번호') or '').strip(),
            'website': (r.get('홈페이지주소') or '').strip(),
            'lat': (r.get('위도') or '').strip(),
            'lng': (r.get('경도') or '').strip(),
            'seo_description': '',
        }
        libraries.append(lib)

    DEST.parent.mkdir(exist_ok=True)
    DEST.write_text(json.dumps(libraries, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"저장 완료: {DEST} ({len(libraries)}건)")

    # 시도/시군구 통계
    sido_map: dict[str, dict[str, int]] = {}
    for lib in libraries:
        s = lib['sido']
        sg = lib['sigungu']
        sido_map.setdefault(s, {}).setdefault(sg, 0)
        sido_map[s][sg] += 1

    regions_path = Path(__file__).parent.parent / "_data" / "regions.json"
    regions = []
    for sido, sigungu_map in sorted(sido_map.items()):
        entry = {
            'sido': sido,
            'slug': slugify(sido),
            'total': sum(sigungu_map.values()),
            'sigungu': [
                {'name': sg, 'slug': slugify(sg), 'count': cnt}
                for sg, cnt in sorted(sigungu_map.items())
            ]
        }
        regions.append(entry)
    regions_path.write_text(json.dumps(regions, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"지역 데이터 저장: {regions_path} ({len(regions)}개 시도)")


if __name__ == '__main__':
    main()
