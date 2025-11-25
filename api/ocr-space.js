// api/ocr-space.js
// Endpoint serverless para reenviar la imagen a OCR.space y devolver el JSON
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.OCR_SPACE_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'OCR_SPACE_API_KEY not configured' });

  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    // OCR.space acepta application/x-www-form-urlencoded con base64Image
    const bodyParams = new URLSearchParams();
    // imageBase64 should include data:<mime>;base64,.... If user sent raw base64, normalize it
    const normalized = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
    bodyParams.append('apikey', API_KEY);
    bodyParams.append('base64Image', normalized);
    bodyParams.append('language', 'spa');
    bodyParams.append('isOverlayRequired', 'false');

    const resp = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    const json = await resp.json();
    return res.status(200).json(json);
  } catch (err) {
    console.error('ocr-space proxy error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
