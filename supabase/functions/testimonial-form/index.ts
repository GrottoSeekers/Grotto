import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return html(notFoundPage('Invalid link — no token provided.'));
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── GET — serve the form ────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('request_token', token)
      .single();

    if (error || !data) {
      return html(notFoundPage('This link is invalid or has expired. Please ask the sitter to send a new one.'));
    }

    if (data.status === 'published') {
      return html(alreadySubmittedPage(data.sitter_name));
    }

    return html(formPage(data, token));
  }

  // ── POST — handle submission ────────────────────────────────────────────
  if (req.method === 'POST') {
    let body = '';
    let rating: number | null = null;

    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = await req.json();
      body = (json.body ?? '').trim();
      rating = json.rating ? parseInt(json.rating) : null;
    } else {
      const formData = await req.formData();
      body = (formData.get('body')?.toString() ?? '').trim();
      const r = parseInt(formData.get('rating')?.toString() ?? '0');
      rating = r > 0 ? r : null;
    }

    if (!body) {
      return html(notFoundPage('Please write a review and try again.'));
    }

    if (rating !== null && (rating < 1 || rating > 5)) {
      rating = null;
    }

    const { error } = await supabase
      .from('testimonials')
      .update({
        body,
        rating,
        status: 'published',
        submitted_at: new Date().toISOString(),
      })
      .eq('request_token', token)
      .eq('status', 'pending');

    if (error) {
      console.error(error);
      return html(notFoundPage('Something went wrong. Please try again.'));
    }

    return html(thankYouPage());
  }

  return new Response('Method not allowed', { status: 405 });
});

// ── HTML helpers ────────────────────────────────────────────────────────────

function html(body: string) {
  return new Response(body, {
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function baseStyles(): string {
  return `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #F7F5F0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .card {
        background: #fff;
        border-radius: 24px;
        padding: 40px 36px;
        max-width: 540px;
        width: 100%;
        box-shadow: 0 8px 40px rgba(0,0,0,0.08);
      }
      .logo {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 20px;
        font-weight: bold;
        color: #C9A84C;
        letter-spacing: 1.5px;
        text-align: center;
        margin-bottom: 28px;
      }
      @media (max-width: 480px) {
        .card { padding: 28px 20px; }
      }
    </style>
  `;
}

function formPage(data: Record<string, string>, token: string): string {
  const firstName = data.sitter_name?.split(' ')[0] ?? data.sitter_name;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${baseStyles()}
  <title>Leave a testimonial for ${esc(data.sitter_name)}</title>
  <style>
    h1 { font-family: Georgia, serif; font-size: 26px; color: #1A1A1A; margin-bottom: 8px; line-height: 1.3; }
    .subtitle { color: #666; font-size: 15px; line-height: 1.6; margin-bottom: 28px; }
    .context-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #F5EDD6;
      border-radius: 50px;
      padding: 8px 16px;
      font-size: 13px;
      color: #7A6B3A;
      margin-bottom: 28px;
    }
    .field { margin-bottom: 24px; }
    label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
    }
    .stars {
      display: flex;
      gap: 10px;
      margin-bottom: 4px;
    }
    .star {
      font-size: 40px;
      cursor: pointer;
      color: #E8D5A3;
      transition: color 0.1s, transform 0.1s;
      user-select: none;
      line-height: 1;
    }
    .star.active { color: #C9A84C; }
    .star:hover { transform: scale(1.15); }
    .stars-hint { font-size: 12px; color: #B0A898; margin-top: 6px; }
    textarea {
      width: 100%;
      border: 1.5px solid #E8E3DA;
      border-radius: 14px;
      padding: 14px 16px;
      font-size: 15px;
      font-family: inherit;
      line-height: 1.65;
      min-height: 150px;
      resize: vertical;
      color: #1A1A1A;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: #FDFCFA;
    }
    textarea:focus {
      border-color: #C9A84C;
      box-shadow: 0 0 0 3px rgba(201,168,76,0.12);
    }
    textarea::placeholder { color: #C0B8AE; }
    .hint { font-size: 12px; color: #B0A898; margin-top: 8px; line-height: 1.5; }
    .submit-btn {
      width: 100%;
      background: #C9A84C;
      color: white;
      border: none;
      border-radius: 50px;
      padding: 17px;
      font-size: 16px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      margin-top: 8px;
      box-shadow: 0 6px 20px rgba(201,168,76,0.35);
    }
    .submit-btn:hover { opacity: 0.92; transform: translateY(-1px); }
    .submit-btn:active { transform: translateY(0); }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .privacy { text-align: center; font-size: 12px; color: #C0B8AE; margin-top: 18px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Grotto</div>
    <h1>Leave a testimonial for ${esc(data.sitter_name)}</h1>
    <p class="subtitle">
      Your review helps ${esc(firstName)} build their house sitting profile. It only takes a minute and means a lot — even a sentence or two is incredibly helpful.
    </p>
    ${data.sit_description ? `<div class="context-pill">🏡 ${esc(data.sit_description)}</div>` : ''}

    <div class="field">
      <label>Star rating <span style="color:#C0B8AE;font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label>
      <div class="stars" id="stars">
        <span class="star" data-value="1">★</span>
        <span class="star" data-value="2">★</span>
        <span class="star" data-value="3">★</span>
        <span class="star" data-value="4">★</span>
        <span class="star" data-value="5">★</span>
      </div>
      <p class="stars-hint" id="starsHint">Tap a star to rate</p>
      <input type="hidden" id="ratingVal" value="0">
    </div>

    <div class="field">
      <label>Your review *</label>
      <textarea
        id="reviewBody"
        placeholder="Share your experience with ${esc(firstName)} as a house sitter. How was their communication? How did they look after your home and pets? Would you have them sit again?"
        required
      ></textarea>
      <p class="hint">No specific format needed — just write what comes naturally. Honest, personal reviews are the most helpful.</p>
    </div>

    <button class="submit-btn" id="submitBtn" onclick="submitForm()">
      Submit testimonial
    </button>
    <p class="privacy">
      Your review will appear on ${esc(firstName)}'s Grotto profile and may be visible to others.
    </p>
  </div>

  <script>
    const STAR_LABELS = ['', 'Poor', 'Below average', 'Good', 'Very good', 'Excellent'];
    let selectedRating = 0;

    document.querySelectorAll('.star').forEach(star => {
      const v = parseInt(star.dataset.value);

      star.addEventListener('click', () => {
        selectedRating = v;
        document.getElementById('ratingVal').value = v;
        document.getElementById('starsHint').textContent = STAR_LABELS[v] + ' — ' + v + '/5';
        updateStars(v);
      });
      star.addEventListener('mouseover', () => updateStars(v));
      star.addEventListener('mouseout', () => updateStars(selectedRating));
    });

    function updateStars(upTo) {
      document.querySelectorAll('.star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.value) <= upTo);
      });
    }

    async function submitForm() {
      const body = document.getElementById('reviewBody').value.trim();
      const rating = parseInt(document.getElementById('ratingVal').value) || null;
      const btn = document.getElementById('submitBtn');

      if (!body) {
        document.getElementById('reviewBody').focus();
        document.getElementById('reviewBody').style.borderColor = '#E53E3E';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Submitting…';

      try {
        const res = await fetch(window.location.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body, rating }),
        });

        if (res.ok) {
          const html = await res.text();
          document.open();
          document.write(html);
          document.close();
        } else {
          btn.disabled = false;
          btn.textContent = 'Submit testimonial';
          alert('Something went wrong — please try again.');
        }
      } catch {
        btn.disabled = false;
        btn.textContent = 'Submit testimonial';
        alert('Something went wrong — please check your connection and try again.');
      }
    }
  </script>
</body>
</html>`;
}

function thankYouPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${baseStyles()}
  <title>Thank you!</title>
  <style>
    .card { text-align: center; }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { font-family: Georgia, serif; font-size: 28px; color: #1A1A1A; margin-bottom: 14px; }
    p { color: #666; font-size: 15px; line-height: 1.7; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Grotto</div>
    <div class="icon">🎉</div>
    <h1>Thank you so much!</h1>
    <p>Your testimonial has been submitted and will now appear on their Grotto profile. Your kind words make a real difference to their house sitting journey!</p>
  </div>
</body>
</html>`;
}

function notFoundPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${baseStyles()}
  <title>Not found</title>
  <style>
    .card { text-align: center; }
    h1 { font-family: Georgia, serif; font-size: 24px; color: #1A1A1A; margin-bottom: 12px; }
    p { color: #666; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Grotto</div>
    <h1>Oops</h1>
    <p>${esc(message)}</p>
  </div>
</body>
</html>`;
}

function alreadySubmittedPage(sitterName: string): string {
  const firstName = sitterName?.split(' ')[0] ?? sitterName;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${baseStyles()}
  <title>Already submitted</title>
  <style>
    .card { text-align: center; }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { font-family: Georgia, serif; font-size: 24px; color: #1A1A1A; margin-bottom: 12px; }
    p { color: #666; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Grotto</div>
    <div class="icon">✅</div>
    <h1>Already submitted</h1>
    <p>You've already left a testimonial for ${esc(firstName)} — thank you! It's now live on their profile.</p>
  </div>
</body>
</html>`;
}
