/**
 * Cloudflare Worker - 공공데이터포털 CORS 프록시
 * 배포 후 URL: https://wooalib-proxy.{your-subdomain}.workers.dev
 *
 * 허용 오리진: wooalib.wooahouse.com (배포 후 ALLOWED_ORIGIN 수정)
 */

const ALLOWED_ORIGIN = 'https://wooalib.wooahouse.com';
const TARGET_BASE    = 'https://apis.data.go.kr';

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(origin),
      });
    }

    const url = new URL(request.url);

    // /B551982/plr_v2/** 경로만 허용
    if (!url.pathname.startsWith('/B551982/plr_v2/')) {
      return new Response('Not allowed', { status: 403 });
    }

    const target = TARGET_BASE + url.pathname + url.search;

    try {
      const res = await fetch(target, {
        headers: { 'Accept': 'application/json' },
      });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders(origin),
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
  },
};

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN || origin === 'http://localhost:4002';
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
