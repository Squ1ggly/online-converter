const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms &amp; Conditions — Online Converter</title>
  <style>
    :root {
      --bg: #0c0c14; --surface: #12121c; --border: #2c2c48;
      --text: #e2e8f0; --muted: #8892a4; --accent: #6366f1;
      --font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--font);
           font-size: 15px; line-height: 1.7; -webkit-font-smoothing: antialiased; }
    .page { max-width: 740px; margin: 0 auto; padding: 48px 24px 80px; }
    header { display: flex; align-items: center; justify-content: space-between;
             margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
    .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text); }
    .brand-name { font-size: 17px; font-weight: 700; }
    .back { font-size: 13px; color: var(--accent); text-decoration: none; }
    .back:hover { text-decoration: underline; }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
    .updated { font-size: 13px; color: var(--muted); margin-bottom: 36px; }
    h2 { font-size: 15px; font-weight: 600; color: var(--text); margin: 28px 0 8px; }
    p { color: var(--muted); margin-bottom: 12px; }
    .warn { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25);
            border-radius: 8px; padding: 14px 16px; margin: 20px 0; }
    .warn p { color: #fca5a5; margin: 0; }
    footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--border);
             font-size: 12px; color: var(--muted); }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <a class="brand" href="/">
        <span class="brand-name">Online Converter</span>
      </a>
      <a class="back" href="/">← Back to converter</a>
    </header>

    <h1>Terms &amp; Conditions</h1>
    <p class="updated">Last updated: ${new Date().toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })}</p>

    <div class="warn">
      <p><strong>Privacy notice:</strong> Files uploaded to this service are not private and are not encrypted at rest or in transit. Do not upload sensitive, confidential, or personal data.</p>
    </div>

    <h2>1. Acceptance of Terms</h2>
    <p>By using Online Converter ("the Service") you agree to these terms. If you do not agree, do not use the Service.</p>

    <h2>2. Description of Service</h2>
    <p>Online Converter is a free, unauthenticated file conversion tool that converts images and video between common formats using open-source software (ImageMagick and FFmpeg) running on the server.</p>

    <h2>3. File Storage &amp; Retention</h2>
    <p>Uploaded files and converted outputs are stored temporarily on the server's local disk solely to facilitate your download. Files are automatically deleted within 30 minutes of upload. We do not back up, archive, or retain your files beyond this window.</p>
    <p>Because this service is unauthenticated, any person who obtains a valid job URL could access the associated files during the retention window. Do not share job URLs with untrusted parties.</p>

    <h2>4. No Privacy Guarantee</h2>
    <p>Files are not encrypted at rest or in transit. We make no representations about the confidentiality of files you upload. You use this service at your own risk.</p>

    <h2>5. Acceptable Use</h2>
    <p>You must not upload files that are illegal, infringe third-party intellectual property rights, contain malware, or violate any applicable law. You are solely responsible for the content you upload and any consequences arising from it.</p>

    <h2>6. No Warranty</h2>
    <p>The Service is provided "as is" without warranty of any kind, express or implied. We do not guarantee that conversions will be accurate, complete, or available at any given time. We are not liable for any loss of data or damages arising from use of the Service.</p>

    <h2>7. Limitation of Liability</h2>
    <p>To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, or consequential damages, including loss of data, revenue, or profits, arising from your use of the Service.</p>

    <h2>8. Changes to Terms</h2>
    <p>We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the revised terms.</p>

    <footer>
      <p>Online Converter — free, open-source image &amp; video conversion.</p>
    </footer>
  </div>
</body>
</html>`;

export function termsPage(): Response {
  return new Response(HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
