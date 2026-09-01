const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function main() {
    console.log('Generating AI Pipeline Video Presentation PDF...');
    const htmlPath = path.resolve('c:/Users/vamsh/OneDrive/Documents/Demo_project/AI_PIPELINE_EXPLAINER_VIDEO_PRESENTATION.html');
    const pdfPath = path.resolve('c:/Users/vamsh/OneDrive/Documents/Demo_project/AI_PIPELINE_EXPLAINER_VIDEO_PRESENTATION.pdf');

    if (!fs.existsSync(htmlPath)) {
        console.error('HTML file not found at:', htmlPath);
        process.exit(1);
    }

    let browser;
    try {
        console.log('Launching Playwright Chromium browser...');
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        
        console.log('Loading HTML file...');
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
        
        console.log('Rendering high-resolution PDF...');
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '15mm',
                bottom: '15mm',
                left: '15mm',
                right: '15mm'
            }
        });
        console.log('🎉 PDF successfully created at:', pdfPath);
    } catch (err) {
        console.error('Error during PDF generation:', err.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

main();
