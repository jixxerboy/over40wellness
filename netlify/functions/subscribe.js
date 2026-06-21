exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const API_KEY = process.env.SYSTEME_API_KEY;
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { email, firstName } = body;
  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
  }

  try {
    const res = await fetch('https://api.systeme.io/api/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        email,
        fields: [
          { slug: 'first_name', value: firstName || '' }
        ]
      })
    });

    // 201 = created, 409/422 with "already used" = already exists — all fine
    if (res.status === 201 || res.status === 409 || res.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }

    const errText = await res.text().catch(() => '');
    console.log('Systeme.io error:', res.status, errText);
    // Treat duplicate email as success
    if (errText.includes('already used')) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }
    let errJson;
    try { errJson = JSON.parse(errText); } catch { errJson = { raw: errText }; }
    return {
      statusCode: res.status,
      body: JSON.stringify({ error: errJson, status: res.status, detail: errText })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
