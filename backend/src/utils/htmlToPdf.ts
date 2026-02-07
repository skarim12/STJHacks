import puppeteer from "puppeteer-core";
import { findChromeExecutablePath } from "./chromePath";

export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const executablePath = findChromeExecutablePath();

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      // safe defaults; required on some Linux hosts, harmless on Windows
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--font-render-hinting=medium",
    ],
  });

  try {
    const page = await browser.newPage();

    // 16:9 slide canvas in pixels
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      printBackground: true,
      width: "1920px",
      height: "1080px",
      pageRanges: "1-",
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
