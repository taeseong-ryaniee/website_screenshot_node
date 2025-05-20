import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// 폴더 생성 함수
const createFolder = (folderPath) => {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
};

const getDateFolderName = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}_${month}_${day}`;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// URL이 캡처 대상인지 확인하는 함수
const shouldCaptureUrl = (url) => {
    // "&re/"가 포함된 URL은 캡처하지 않음
    if (url.includes('&re/')) {
        return false;
    }

    // index.do로 끝나는 메인 페이지
    if (url.endsWith('index.do')) {
        return true;
    }

    // content.do?key=숫자 형태의 URL (id가 없는 경우)
    if (/content\.do\?key=\d+$/.test(url)) {
        return true;
    }

    // content.do?key=숫자&id=숫자 형태의 URL
    if (/content\.do\?key=\d+&id=\d+/.test(url)) {
        return true;
    }

    return false;
};

// URL이 크롤링 대상인지 확인하는 함수
const shouldCrawlUrl = (url) => {
    return url && url.startsWith('https://cbstudy.olym.co.kr/') && !url.includes('#');
};

// URL에서 key와 id 값을 추출하는 함수
const extractParamsFromUrl = (url) => {
    const keyMatch = url.match(/[?&]key=(\d+)/);
    const idMatch = url.match(/[?&]id=(\d+)/);
    return {
        key: keyMatch ? keyMatch[1] : null,
        id: idMatch ? idMatch[1] : null
    };
};

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

const main = async () => {
    const browser = await puppeteer.launch();
    console.log('Browser launched. Starting crawl...');

    const visitedUrls = new Set();
    const urlsToVisit = new Set(['https://cbstudy.olym.co.kr/index.do']);

    const dateFolderName = getDateFolderName();
    const folderPath = path.join('screenshot_images', dateFolderName);
    createFolder(folderPath);

    while (urlsToVisit.size > 0) {
        const url = urlsToVisit.values().next().value;
        urlsToVisit.delete(url);

        if (visitedUrls.has(url)) {
            continue;
        }

        visitedUrls.add(url);

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            await removeAOS(page);
            await wait(1000);

            // 캡처 대상인 URL만 스크린샷 저장
            if (shouldCaptureUrl(url)) {
                let screenshotName;

                if (url.endsWith('index.do')) {
                    screenshotName = 'main_index.png';
                } else {
                    // content.do URL 처리
                    const params = extractParamsFromUrl(url);

                    if (params.id) {
                        // key와 id가 모두 있는 경우
                        screenshotName = `content_key${params.key}_id${params.id}.png`;
                    } else {
                        // key만 있는 경우
                        screenshotName = `content_key${params.key}.png`;
                    }
                }

                const screenshotPath = path.join(folderPath, screenshotName);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`Captured: ${url} -> ${screenshotPath}`);
            } else {
                console.log(`Skipped capturing: ${url}`);
            }

            // 모든 링크를 수집하여 크롤링 대상 추가
            const links = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a'))
                    .map(anchor => anchor.href)
                    .filter(href => href && href.startsWith('https://cbstudy.olym.co.kr/') && !href.includes('#'));
            });

            links.forEach(link => {
                if (!visitedUrls.has(link) && shouldCrawlUrl(link)) {
                    urlsToVisit.add(link);
                }
            });

            await page.close();
        } catch (error) {
            console.error(`Error processing ${url}:`, error);
        }
    }

    console.log('Crawling completed. Total unique URLs visited:', visitedUrls.size);
    await browser.close();
};

main().catch(error => console.error('An error occurred:', error));