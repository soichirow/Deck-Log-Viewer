// Cloudflare Worker - Deck Log API Proxy
// Deploy: https://workers.cloudflare.com/ で無料アカウントを作成し、このコードをデプロイ

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);
    const deckId = url.searchParams.get("deck_id");

    if (!deckId) {
      return jsonResponse({ error: "deck_id parameter is required" }, 400);
    }

    // Sanitize: only allow alphanumeric deck codes (max 10 chars)
    if (!/^[A-Za-z0-9]{1,10}$/.test(deckId)) {
      return jsonResponse({ error: "Invalid deck_id format" }, 400);
    }

    try {
      const apiUrl = `https://decklog.bushiroad.com/system/app/api/view/${deckId}`;
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Referer": "https://decklog.bushiroad.com/",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const data = await resp.text();
      return new Response(data, {
        status: resp.status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      });
    } catch (e) {
      return jsonResponse({ error: "Failed to fetch deck data" }, 502);
    }
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}
