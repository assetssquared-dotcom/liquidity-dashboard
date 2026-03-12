module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8676682662:AAFMgzGATR3GxmvczgurNaxyNPKdvOMZGGY';
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  try {
    // 봇 DM으로 포워드된 메시지 가져오기
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100&allowed_updates=["message"]`
    );
    const data = await r.json();
    if (!data.ok) throw new Error(data.description || 'Telegram error');

    const posts = (data.result || [])
      .filter(u => u.message && (u.message.forward_origin || u.message.forward_from_chat || u.message.text || u.message.caption))
      .map(u => u.message)
      .reverse()
      .slice(0, limit)
      .map(m => ({
        message_id: m.message_id,
        date: m.date,
        text: m.text || m.caption || '',
        // 포워드된 경우 원본 채널 정보
        forward_date: m.forward_date || m.forward_origin?.date || null,
        is_forward: !!(m.forward_origin || m.forward_from_chat || m.forward_date),
      }));

    return res.status(200).json({ ok: true, posts });
  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
