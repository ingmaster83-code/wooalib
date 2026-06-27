#!/usr/bin/env python3
"""
generate_seo.py - DeepSeek API로 도서관별 SEO 설명문 생성

사용법:
  python scripts/generate_seo.py              # 전체 (seo_description 없는 것만)
  python scripts/generate_seo.py --limit 20   # 20건만 테스트
  python scripts/generate_seo.py --force      # 기존 것도 덮어쓰기
"""
import json
import sys
import time
import argparse
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding='utf-8')

API_KEY_PATH = Path(r"C:\개인\개인 프로젝트\blogwriter_new\blogger_seo_bot\config\deepseek_api_key.txt")
DATA_FILE    = Path(__file__).parent.parent / "_data" / "libraries.json"
DELAY        = 0.15

PROMPT_TMPL = """다음 도서관 정보를 바탕으로 네이버/구글 검색 최적화용 한국어 소개문을 120자 이내로 작성하세요.
도서관명, 위치, 유형, 운영시간을 자연스럽게 담아주세요. 문장으로 끝내세요. 따옴표나 특수기호 없이.

도서관명: {name}
위치: {sido} {sigungu}
유형: {lib_type}
평일운영: {hours_weekday}
소재지: {address}

소개문만 출력하세요 (설명 없이):"""


def get_api_key() -> str:
    return API_KEY_PATH.read_text(encoding='utf-8').strip()


def generate_desc(lib: dict, api_key: str) -> str:
    prompt = PROMPT_TMPL.format(
        name=lib.get('name', ''),
        sido=lib.get('sido', ''),
        sigungu=lib.get('sigungu', ''),
        lib_type=lib.get('type', ''),
        hours_weekday=lib.get('hours_weekday', ''),
        address=lib.get('address', ''),
    )
    resp = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 200,
            "temperature": 0.5,
        },
        timeout=30,
    )
    resp.raise_for_status()
    text = resp.json()["choices"][0]["message"]["content"].strip()
    return text[:155]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    libraries = json.loads(DATA_FILE.read_text(encoding='utf-8'))
    api_key = get_api_key()

    targets_idx = [
        i for i, lib in enumerate(libraries)
        if args.force or not lib.get('seo_description')
    ]
    if args.limit:
        targets_idx = targets_idx[:args.limit]

    total = len(targets_idx)
    print(f"생성 대상: {total}건\n")

    done = 0
    for idx in targets_idx:
        lib = libraries[idx]
        try:
            desc = generate_desc(lib, api_key)
            libraries[idx]['seo_description'] = desc
            done += 1
            try:
                print(f"  [{done}/{total}] {lib['name'][:20]}: {desc[:40]}...")
            except Exception:
                print(f"  [{done}/{total}] (출력 생략)")
        except Exception as e:
            print(f"  [실패] {lib.get('name', '')}: {e}")

        if done % 50 == 0:
            DATA_FILE.write_text(
                json.dumps(libraries, ensure_ascii=False, indent=2),
                encoding='utf-8'
            )
            print(f"  [저장] {done}건 완료")

        time.sleep(DELAY)

    DATA_FILE.write_text(
        json.dumps(libraries, ensure_ascii=False, indent=2),
        encoding='utf-8'
    )
    print(f"\n완료: {done}/{total}건 생성")


if __name__ == '__main__':
    main()
