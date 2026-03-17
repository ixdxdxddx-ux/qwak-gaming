// netlify/functions/scan-virustotal.js
// Проксирует запросы к VirusTotal API с защитой ключа

exports.handler = async (event) => {
  const { hash } = JSON.parse(event.body || '{}');
  
  if (!hash) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Hash required' }),
    };
  }

  const apiKey = process.env.VT_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' }),
    };
  }

  try {
    const response = await fetch(`https://www.virustotal.com/api/v3/files/${hash}`, {
      method: 'GET',
      headers: {
        'x-apikey': apiKey,
      },
      timeout: 5000,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          statusCode: 200,
          body: JSON.stringify({ detected: 0, total: 0, notFound: true }),
        };
      }
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    const stats = data.data?.attributes?.last_analysis_stats;
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        detected: stats?.malicious || 0,
        total: stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 70,
        notFound: false,
      }),
    };
  } catch (error) {
    console.error('VT API Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        detected: 0,
        total: 0,
      }),
    };
  }
};
