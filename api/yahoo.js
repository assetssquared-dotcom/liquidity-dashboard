module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type } = req.query;

  try {
    if (type === 'sectors') {
      // S&P500 11개 섹터 ETF 당일 등락률
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

      const tickers = sectors.map(s => s.ticker).join(',');
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketChange`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error(`Yahoo ${r.status}`);
      const data = await r.json();
      const quotes = data.quoteResponse?.result || [];

      const result = sectors.map(s => {
        const q = quotes.find(q => q.symbol === s.ticker);
        return {
          ticker: s.ticker,
          name: s.name,
          price: q?.regularMarketPrice ?? null,
          change: q?.regularMarketChangePercent ?? null,
          changeAbs: q?.regularMarketChange ?? null,
        };
      });

      return res.status(200).json({ ok: true, type: 'sectors', data: result });

    } else if (type === 'correlation') {
      // 주요 자산 90일 수익률 (상관관계 계산용)
      const assets = [
        { ticker: '^GSPC',   name: 'S&P500' },
        { ticker: 'TLT',     name: '미국채(20Y)' },
        { ticker: 'GC=F',    name: '금' },
        { ticker: 'DX-Y.NYB',name: '달러(DXY)' },
        { ticker: 'CL=F',    name: 'WTI 원유' },
        { ticker: 'BTC-USD', name: '비트코인' },
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

      // 수익률 계산
      const returns = closes.map(c => {
        const r = [];
        for (let i = 1; i < c.length; i++) r.push((c[i] - c[i-1]) / c[i-1]);
        return r;
      });

      // 상관계수 계산
      function corr(a, b) {
        const n = Math.min(a.length, b.length);
        if (n < 5) return null;
        const ax = a.slice(-n), bx = b.slice(-n);
        const ma = ax.reduce((s,v)=>s+v,0)/n;
        const mb = bx.reduce((s,v)=>s+v,0)/n;
        let num=0, da=0, db=0;
        for(let i=0;i<n;i++){
          num += (ax[i]-ma)*(bx[i]-mb);
          da += (ax[i]-ma)**2;
          db += (bx[i]-mb)**2;
        }
        if(da===0||db===0) return null;
        return +(num/Math.sqrt(da*db)).toFixed(3);
      }

      const names = assets.map(a => a.name);
      const matrix = assets.map((_, i) =>
        assets.map((_, j) => corr(returns[i], returns[j]))
      );

      return res.status(200).json({ ok: true, type: 'correlation', names, matrix });

    } else {
      // 단일/다중 티커 시세
      const symbols = req.query.symbols || req.query.symbol || '';
      const days = parseInt(req.query.days) || 30;
      const period2 = Math.floor(Date.now() / 1000);
      const period1 = period2 - days * 86400;

      const tickerList = symbols.split(',').map(s => s.trim()).filter(Boolean);
      const results = await Promise.all(tickerList.map(async ticker => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${period2}`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const d = await r.json();
        const result = d.chart?.result?.[0];
        if (!result) return { ticker, dates: [], vals: [] };
        const ts = result.timestamp || [];
        const cl = result.indicators?.quote?.[0]?.close || [];
        const dates = [], vals = [];
        ts.forEach((t, i) => {
          if (cl[i] != null) {
            dates.push(new Date(t*1000).toISOString().slice(0,10));
            vals.push(+cl[i].toFixed(4));
          }
        });
        return { ticker, dates, vals };
      }));

      return res.status(200).json({ ok: true, results });
    }
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
