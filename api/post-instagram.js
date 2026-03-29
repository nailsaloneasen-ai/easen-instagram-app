// api/post-instagram.js
// 公開URLを受け取りInstagram Graph APIで投稿する

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageUrl, caption, accessToken, igAccountId } = req.body;

    if (!imageUrl || !caption || !accessToken || !igAccountId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Step1: メディアコンテナ作成
    const createRes = await fetch(
      `https://graph.facebook.com/v23.0/${igAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,  // 公開URLが必須
          caption: caption,
          access_token: accessToken
        })
      }
    );
    const createData = await createRes.json();

    if (!createData.id) {
      console.error('Media container creation failed:', createData);
      return res.status(500).json({ error: 'Media container creation failed', detail: createData });
    }

    // Step2: 公開（publish）
    const publishRes = await fetch(
      `https://graph.facebook.com/v23.0/${igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: accessToken
        })
      }
    );
    const publishData = await publishRes.json();

    if (!publishData.id) {
      console.error('Publish failed:', publishData);
      return res.status(500).json({ error: 'Publish failed', detail: publishData });
    }

    return res.status(200).json({ success: true, postId: publishData.id });

  } catch (err) {
    console.error('post-instagram error:', err);
    return res.status(500).json({ error: err.message });
  }
}
