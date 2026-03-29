// api/upload-image.js
// base64画像をimgBBにアップロードして公開URLを返す
// imgBBは匿名アップロード対応・完全無料

export default async function handler(req, res) {
  // CORSヘッダー
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image } = req.body; // base64文字列（data:image/...;base64,XXX）
    if (!image) return res.status(400).json({ error: 'image is required' });

    // data:image/jpeg;base64, のプレフィックスを除去
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');

    // imgBB APIキー（無料プランで取得・環境変数に設定）
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      // APIキー未設定時はエラーを返す
      return res.status(500).json({ error: 'IMGBB_API_KEY not configured' });
    }

    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('image', base64Data);
    formData.append('expiration', '300'); // 5分後に自動削除（投稿後不要なため）

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = await response.json();

    if (!data.success) {
      return res.status(500).json({ error: 'imgBB upload failed', detail: data });
    }

    return res.status(200).json({
      success: true,
      url: data.data.url,
      delete_url: data.data.delete_url
    });

  } catch (err) {
    console.error('upload-image error:', err);
    return res.status(500).json({ error: err.message });
  }
}
