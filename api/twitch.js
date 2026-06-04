export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`
    });
    const { access_token } = await tokenRes.json();
    const headers = {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${access_token}`
    };
    const streamRes = await fetch('https://api.twitch.tv/helix/streams?user_login=kythikx', { headers });
    const streamData = await streamRes.json();
    const isLive = streamData.data && streamData.data.length > 0;
    if (isLive) return res.json({ isLive: true, vodId: null });
    const userRes = await fetch('https://api.twitch.tv/helix/users?login=kythikx', { headers });
    const userData = await userRes.json();
    const userId = userData.data[0].id;
    const vodRes = await fetch(`https://api.twitch.tv/helix/videos?user_id=${userId}&type=archive&first=1`, { headers });
    const vodData = await vodRes.json();
    const vodId = vodData.data && vodData.data.length > 0 ? vodData.data[0].id : null;
    return res.json({ isLive: false, vodId });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
