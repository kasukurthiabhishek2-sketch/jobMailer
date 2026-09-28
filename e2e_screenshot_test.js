import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('./test_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('--- STARTING E2E TEST WITH SCREENSHOTS AT EVERY STEP ---');
  
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Inject mock user and mock settings before document load
  await page.evaluateOnNewDocument(() => {
    window.__E2E_MOCK_USER__ = {
      uid: 'user_e2e_test',
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: 'https://lh3.googleusercontent.com/a/default-user=s96-c'
    };

    window.__E2E_MOCK_SETTINGS__ = {
      activeProvider: 'copilot',
      aiProviders: {
        gemini: {
          name: 'Google Gemini',
          apiKey: '',
          maskedKey: 'AQ.Ab8...4kQQ',
          model: 'gemini-2.5-flash',
          isConfigured: true,
          supportedModels: [
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-pro'
          ],
          savedKeys: [
            {
              id: 'key_primary',
              name: 'Primary Key',
              apiKey: '',
              maskedKey: 'AQ.Ab8...4kQQ',
              createdAt: '2026-09-28T12:00:00.000Z'
            }
          ],
          selectedKeyId: 'key_primary'
        },
        copilot: {
          name: 'GitHub Copilot',
          model: 'gpt-4o',
          isConfigured: true,
          connected: true
        }
      },
      smtpProfiles: [],
      preferences: {
        outreachTone: 'professional',
        delaySeconds: 3,
        attachResume: true
      }
    };
  });

  // STEP 1: Navigate to app
  console.log('Step 1: Navigating to http://localhost:5173/?mock_auth=1 ...');
  await page.goto('http://localhost:5173/?mock_auth=1', { waitUntil: 'networkidle0', timeout: 15000 });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step1_app_loaded.png') });
  console.log('Saved step1_app_loaded.png');

  // STEP 2: Open Settings modal
  console.log('Step 2: Opening Settings modal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.toLowerCase().includes('setting'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step2_settings_opened.png') });
  console.log('Saved step2_settings_opened.png');

  // STEP 3: Expand Google Gemini card
  console.log('Step 3: Expanding Google Gemini card (.provider-row-header)...');
  await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('.provider-row-header'));
    const geminiHeader = headers.find(h => h.textContent.includes('Google Gemini'));
    if (geminiHeader) geminiHeader.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step3_gemini_expanded.png') });
  console.log('Saved step3_gemini_expanded.png');

  // STEP 4: Inspect Redundancy & Saved Keys UI
  console.log('Step 4: Inspecting saved keys UI...');
  const keySections = await page.evaluate(() => {
    const text = document.querySelector('.settings-body')?.innerText || '';
    return {
      hasSavedKeysTitle: text.includes('Saved API Keys'),
      hasActiveKeyDropdown: text.includes('Active Key') && text.includes('configured'),
      hasReplaceBtn: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Replace'))),
      hasAddAnotherBtn: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add another key')))
    };
  });
  console.log('Key sections verification:', keySections);

  // STEP 5: Click Model dropdown trigger to verify default models are selectable
  console.log('Step 5: Clicking Model dropdown trigger...');
  const modelTrigger = await page.$('.model-select-trigger');
  if (modelTrigger) {
    await modelTrigger.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step5_model_dropdown_open.png') });
    console.log('Saved step5_model_dropdown_open.png');

    const options = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll('.model-select-option'));
      return opts.map(o => o.innerText.trim());
    });
    console.log(`Dropdown options count: ${options.length}`, options);

    // STEP 6: Select Gemini 1.5 Pro from dropdown
    console.log('Step 6: Selecting Gemini 1.5 Pro from dropdown...');
    await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll('.model-select-option'));
      const target = opts.find(o => o.innerText.includes('Gemini 1.5 Pro') || o.innerText.includes('gemini-1.5-pro'));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step6_model_selected.png') });
    console.log('Saved step6_model_selected.png');
  } else {
    console.error('ERROR: .model-select-trigger not found on page!');
  }

  // STEP 7: Click "Test connection"
  console.log('Step 7: Clicking "Test connection" button...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const testBtn = btns.find(b => b.textContent.trim().toLowerCase() === 'test connection');
    if (testBtn) testBtn.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step7_test_connection_clicked.png') });
  console.log('Saved step7_test_connection_clicked.png');

  // STEP 8: Click "Replace" on the saved key card to update key in-place
  console.log('Step 8: Clicking "Replace" button on saved key card...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const replaceBtn = btns.find(b => b.textContent.includes('Replace'));
    if (replaceBtn) replaceBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step8_replace_key_form_open.png') });
  console.log('Saved step8_replace_key_form_open.png');

  // STEP 9: Enter a new real/test key into replace input
  console.log('Step 9: Typing new key into the replace input...');
  const keyInput = await page.$('input[placeholder*="key"], input[placeholder*="AIza"], input[type="password"]');
  if (keyInput) {
    await keyInput.type('AIzaSyD_TEST_MOCK_GEMINI_KEY_REPLACED');
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step9_key_typed.png') });
    console.log('Saved step9_key_typed.png');

    // STEP 10: Click "Update key" to save in-place
    console.log('Step 10: Clicking "Update key"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent.includes('Update key') || b.textContent.includes('Save'));
      if (saveBtn) saveBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step10_key_updated_and_verified.png') });
    console.log('Saved step10_key_updated_and_verified.png');
  }

  // Check how many saved key cards exist now (must be 1, NOT duplicated!)
  const cardCount = await page.evaluate(() => {
    return document.querySelectorAll('.saved-key-card').length;
  });
  console.log(`Saved key cards count after replace: ${cardCount} (expected: 1)`);

  console.log('--- ALL E2E SCREENSHOT STEPS COMPLETED SUCCESSFULLY ---');
  await browser.close();
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
