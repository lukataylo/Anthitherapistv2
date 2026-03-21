/**
 * Landing page route.
 *
 * Serves the Reframe app landing page at GET /.
 * Detects the current request host so the Expo Go deep-link and QR code
 * point at the correct production domain.
 */

import { Router, type Request, type Response } from "express";

const router = Router();

function buildLandingPage(host: string): string {
  const protocol = "https";
  const expsUrl = `${host}`;
  const baseUrl = `${protocol}://${host}`;
  void baseUrl;

  return `<!doctype html>
<html>
  <head>
    <title>Reframe</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg width='180' height='180' viewBox='0 0 180 180' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='180' height='180' rx='36' fill='%23000'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-size='80' font-family='system-ui'%3E🧠%3C/text%3E%3C/svg%3E" />
    <style>
      *{box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:32px 20px;text-align:center;background:#000;color:#e0e0e0;line-height:1.5;min-height:100vh}
      .wrapper{max-width:480px;margin:0 auto}
      h1{font-size:32px;font-weight:700;margin:0;color:#fff;letter-spacing:-0.5px}
      .tagline{font-size:15px;color:#666;margin-top:8px;margin-bottom:36px}
      .steps-container{display:flex;flex-direction:column;gap:16px}
      .step{padding:24px;border:1px solid #222;border-radius:16px;text-align:center;background:#111}
      .step-header{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px}
      .step-number{width:26px;height:26px;border:1px solid #444;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;flex-shrink:0;color:#888}
      .step-title{font-size:17px;font-weight:600;margin:0;color:#f0f0f0}
      .step-description{font-size:13px;margin-bottom:16px;color:#666}
      .store-buttons{display:flex;flex-direction:column;gap:8px;justify-content:center}
      .store-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 20px;font-size:14px;font-weight:500;border:1px solid #333;border-radius:10px;text-decoration:none;color:#e0e0e0;background:#1a1a1a;transition:all .15s}
      .store-button:hover{background:#222;border-color:#555}
      .store-icon{width:18px;height:18px}
      .qr-section{background:#0a0a0a;border-color:#222}
      .qr-code{width:160px;height:160px;margin:0 auto 16px;background:#fff;border-radius:10px;padding:10px}
      .qr-code canvas{width:100%;height:100%}
      .open-button{display:inline-block;padding:11px 24px;font-size:14px;font-weight:500;border:1px solid rgba(255,255,255,.15);border-radius:10px;text-decoration:none;color:#111;background:#fff;transition:opacity .15s}
      .open-button:hover{opacity:.9}
      .api-pill{display:inline-block;margin-top:32px;padding:6px 14px;font-size:12px;border:1px solid #222;border-radius:100px;color:#555;font-family:monospace}
      @media(min-width:640px){body{display:flex;align-items:center;justify-content:center;padding:48px 32px}.wrapper{max-width:680px}.steps-container{flex-direction:row;align-items:stretch}.step{flex:1}.store-buttons{flex-direction:column;gap:10px}.qr-code{width:180px;height:180px}}
    </style>
  </head>
  <body>
    <div class="wrapper">
      <h1>🧠 Reframe</h1>
      <p class="tagline">Turn your negative thoughts into a game</p>

      <div class="steps-container">
        <div class="step">
          <div class="step-header">
            <div class="step-number">1</div>
            <h2 class="step-title">Download Expo Go</h2>
          </div>
          <p class="step-description">Free app to run the Reframe mobile experience</p>
          <div class="store-buttons">
            <a href="https://apps.apple.com/app/id982107779" class="store-button" target="_blank">
              <svg class="store-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              App Store
            </a>
            <a href="https://play.google.com/store/apps/details?id=host.exp.exponent" class="store-button" target="_blank">
              <svg class="store-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/></svg>
              Google Play
            </a>
          </div>
        </div>

        <div class="step qr-section">
          <div class="step-header">
            <div class="step-number">2</div>
            <h2 class="step-title">Scan QR Code</h2>
          </div>
          <p class="step-description">Open in Expo Go with your phone's camera</p>
          <div class="qr-code" id="qr-code"></div>
          <a href="exps://${expsUrl}" class="open-button">Open in Expo Go</a>
        </div>
      </div>

      <div class="api-pill">API: /api/healthz</div>
    </div>

    <script src="https://unpkg.com/qr-code-styling@1.6.0/lib/qr-code-styling.js"></script>
    <script>
      var qrCode = new QRCodeStyling({
        width:320,height:320,
        data:"exps://${expsUrl}",
        dotsOptions:{color:"#000",type:"rounded"},
        backgroundOptions:{color:"#ffffff"},
        cornersSquareOptions:{type:"extra-rounded"},
        cornersDotOptions:{type:"dot"},
        qrOptions:{errorCorrectionLevel:"H"}
      });
      qrCode.append(document.getElementById("qr-code"));
    </script>
  </body>
</html>`;
}

router.get("/", (req: Request, res: Response) => {
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    req.headers.host ||
    "localhost";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(buildLandingPage(host));
});

export default router;
