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
  const nameParts = (firstName || '').trim().split(/\s+/);
  const first = nameParts[0] || '';
  const last = nameParts.slice(1).join(' ') || '';
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
          { slug: 'first_name', value: first },
          { slug: 'surname', value: last }
        ]
      })
    });

    // 201 = created, 409/422 with "already used" = already exists — all fine
    if (res.status === 201 || res.status === 409 || res.ok) {
      const responseData = await res.json().catch(() => ({}));
      console.log('Systeme.io success response:', JSON.stringify(responseData));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }

    const errText = await res.text().catch(() => '');
    console.log('Systeme.io error:', res.status, errText);
    // If duplicate, find the contact and update their name
    if (errText.includes('already used')) {
      try {
        const searchRes = await fetch(`https://api.systeme.io/api/contacts?email=${encodeURIComponent(email)}`, {
          headers: { 'X-API-Key': API_KEY }
        });
        const searchData = await searchRes.json();
        const contact = searchData.items && searchData.items[0];
        if (contact && firstName) {
          await fetch(`https://api.systeme.io/api/contacts/${contact.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
            body: JSON.stringify({ firstName })
          });
        }
      } catch (e) {
        console.log('Could not update existing contact:', e.message);
      }
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
