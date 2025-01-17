import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const visitedUrls = new Set();
const urlsToVisit = new Set(['https://www.ccbcompetition.com/']);

// 폴더 생성 함수
const createFolder = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

const getDateFolderName = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}_${month}_${day}`;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// AOS 효과 제거 함수
const removeAOS = async (page) => {
    await page.evaluate(() => {
        // AOS 초기화 비활성화
        window.AOS = null;

        // AOS 관련 스타일 제거
        const styleTags = document.querySelectorAll('style, link[rel="stylesheet"]');
        styleTags.forEach((tag) => {
            if ((tag.innerHTML && tag.innerHTML.includes('aos')) || (tag.href && tag.href.includes('aos'))) {
                tag.remove();
            }
        });

        // AOS 속성 제거
        document.querySelectorAll('[data-aos]').forEach((el) => {
            el.removeAttribute('data-aos');
            el.style.opacity = ''; // 투명도 초기화
            el.style.transform = ''; // 변환 초기화
        });
    });
};

const crawlAndCapture = async (browser, url, code) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await removeAOS(page);

    await wait(1000);

    const dateFolderName = getDateFolderName();
    const folderPath = path.join('screenshot_images', dateFolderName);
    createFolder(folderPath);

    const screenshotPath = path.join(folderPath, `page_${code}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Capture ${url} -> ${screenshotPath}`);

    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
            .map(anchor => anchor.href)
            .filter(href => href && href.startsWith('https://www.ccbcompetition.com/') && !href.includes('#'));
    });

    links.forEach(link => {
        if (!visitedUrls.has(link)) urlsToVisit.add(link);
    });

    await page.close();
};

const main = async () => {
  const browser = await puppeteer.launch();

  let code = 1;
  while (urlsToVisit.size > 0) {
    const url = urlsToVisit.values().next().value;
    urlsToVisit.delete(url);
    if (!visitedUrls.has(url)) {
      visitedUrls.add(url);
      await crawlAndCapture(browser, url, code++);
    }
  }

  await browser.close();
};

main().catch(error => console.error('An error occurred:', error));
