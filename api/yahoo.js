module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // 캐시 15분으로 늘려서 반복 요청 빠르게
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type } = req.query;

  try {
    if (type === 'sectors') {
      const sectors = [
        { ticker: 'XLK', name: '기술' },
        { ticker: 'XLF', name: '금융' },
        { ticker: 'XLV', name: '헬스케어' },
        { ticker: 'XLY', name: '임의소비재' },
        { ticker: 'XLP', name: '필수소비재' },
        { ticker: 'XLE', name: '에너지' },
        { ticker: 'XLI', name: '산업재' },
        { ticker: 'XLU', name: '유틸리티' },
        { ticker: 'XLRE', name: '부동산' },
        { ticker: 'XLB', name: '소재' },
        { ticker: 'XLC', name: '통신서비스' },
      ];
      // v8 chart API로 5일치 가져와서 전일 대비 계산
      const period2 = Math.floor(Date.now() / 1000);
      const period1 = period2 - 5 * 86400;
      const results = await Promise.all(sectors.map(async s => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${s.ticker}?interval=1d&period1=${period1}&period2=${period2}`;
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const d = await r.json();
          const result = d.chart?.result?.[0];
          if (!result) return { ticker: s.ticker, name: s.name, price: null, change: null };
          const closes = result.indicators?.quote?.[0]?.close || [];
          const valid = closes.filter(v => v != null);
          const price = valid.at(-1) ?? null;
          const prev = valid.at(-2) ?? null;
          const change = (price != null && prev != null && prev !== 0)
            ? +((price - prev) / prev * 100).toFixed(2) : null;
          return { ticker: s.ticker, name: s.name, price: price ? +price.toFixed(2) : null, change };
        } catch { return { ticker: s.ticker, name: s.name, price: null, change: null }; }
      }));
      return res.status(200).json({ ok: true, type: 'sectors', data: results });

    } else if (type === 'correlation') {
      const assets = [
        { ticker: '^GSPC',    name: 'S&P500' },
        { ticker: 'TLT',      name: '미국채' },
        { ticker: 'GC=F',     name: '금' },
        { ticker: 'DX-Y.NYB', name: 'DXY' },
        { ticker: 'CL=F',     name: 'WTI' },
        { ticker: 'BTC-USD',  name: 'BTC' },
      ];
      const period2 = Math.floor(Date.now() / 1000);
      const period1 = period2 - 90 * 86400;
      const closes = await Promise.all(assets.map(async a => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(a.ticker)}?interval=1d&period1=${period1}&period2=${period2}`;
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const d = await r.json();
          const c = d.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          return c.filter(v => v != null);
        } catch { return []; }
      }));
      const returns = closes.map(c => {
        const r = [];
        for (let i = 1; i < c.length; i++) r.push((c[i] - c[i-1]) / c[i-1]);
        return r;
      });
      function corr(a, b) {
        const n = Math.min(a.length, b.length);
        if (n < 5) return null;
        const ax = a.slice(-n), bx = b.slice(-n);
        const ma = ax.reduce((s,v)=>s+v,0)/n, mb = bx.reduce((s,v)=>s+v,0)/n;
        let num=0, da=0, db=0;
        for(let i=0;i<n;i++){ num+=(ax[i]-ma)*(bx[i]-mb); da+=(ax[i]-ma)**2; db+=(bx[i]-mb)**2; }
        if(da===0||db===0) return null;
        return +(num/Math.sqrt(da*db)).toFixed(3);
      }
      const names = assets.map(a => a.name);
      const matrix = assets.map((_, i) => assets.map((_, j) => corr(returns[i], returns[j])));
      return res.status(200).json({ ok: true, type: 'correlation', names, matrix });

    } else {
      // 단일/다중 티커 시세 — 병렬로 빠르게
      const symbols = req.query.symbols || req.query.symbol || '';
      const days = parseInt(req.query.days) || 30;
      const period2 = Math.floor(Date.now() / 1000);
      const period1 = period2 - days * 86400;
      const tickerList = symbols.split(',').map(s => s.trim()).filter(Boolean);

      const results = await Promise.all(tickerList.map(async ticker => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${period2}`;
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const d = await r.json();
          const result = d.chart?.result?.[0];
          if (!result) return { ticker, dates: [], vals: [] };
          const ts = result.timestamp || [];
          const cl = result.indicators?.quote?.[0]?.close || [];
          const dateMap = new Map();
          ts.forEach((t, i) => {
            if (cl[i] != null) {
              const date = new Date(t*1000).toISOString().slice(0,10);
              dateMap.set(date, +cl[i].toFixed(4)); // 중복 날짜 제거
            }
          });
          const dates = [...dateMap.keys()];
          const vals = [...dateMap.values()];
          return { ticker, dates, vals };
        } catch {
          return { ticker, dates: [], vals: [] };
        }
      }));

      return res.status(200).json({ ok: true, results });
    }
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
