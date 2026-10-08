
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1451, height: 1271 });
  
  console.log("Navigiere zur Seite...");
  await page.goto('https://redesigned-bassoon-9666q66vwr5gc9rj9-3000.app.github.dev/', { waitUntil: 'networkidle0' });
  
  console.log("Klicke Nichts davon...");
  await page.click("button:has-text('Nichts davon'), text/Nichts davon").catch(() => {});
  
  console.log("Klicke Auswahl speichern...");
  await page.click("button:has-text('Auswahl speichern'), text/Auswahl speichern").catch(() => {});
  
  console.log("Test erfolgreich durchgelaufen!");
  await browser.close();
})();
