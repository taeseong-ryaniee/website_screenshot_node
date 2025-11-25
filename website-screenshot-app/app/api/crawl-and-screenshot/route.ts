import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs-extra';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

// SQLite 데이터베이스 초기화 함수
async function initializeDatabase() {
    const db = await open({
        filename: path.join(process.cwd(), 'screenshots.sqlite'),
        driver: sqlite3.Database
    });
    await db.exec(`
        CREATE TABLE IF NOT EXISTS screenshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            imagePath TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    return db;
}

// 스크롤 함수 (AOS 처리)
async function autoScroll(page: any){
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve(null);
                }
            }, 100);
        });
    });
}

// URL 유효성 및 도메인 확인
const isValidUrl = (url: string, baseUrl: string) => {
    try {
        const parsedUrl = new URL(url);
        const parsedBaseUrl = new URL(baseUrl);
        return parsedUrl.protocol.startsWith('http') && parsedUrl.hostname === parsedBaseUrl.hostname;
    } catch (e) {
        return false;
    }
};

export async function POST(request: Request) {

    const { startUrl, needsLogin, username, password } = await request.json();



    if (!startUrl) {

        return NextResponse.json({ message: '시작 URL을 입력해주세요.' }, { status: 400 });

    }



    const db = await initializeDatabase();

    const browser = await puppeteer.launch({ headless: true });

    const page = await browser.newPage();



    // 공통 페이지 설정

    await page.setExtraHTTPHeaders({

        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',

    });

    await page.emulate({

        viewport: { width: 1920, height: 1080 },

        locale: 'ko-KR',

    });



    try {

        // 로그인 처리

                if (needsLogin && username && password) {

                    console.log('로그인 페이지로 이동합니다...');

                    // 로그인 URL을 고정하거나, 프론트엔드에서 받아올 수 있습니다. 여기서는 고정된 URL을 사용합니다.

                    await page.goto("https://lms.cbitlelms.or.kr/", { waitUntil: 'networkidle2' });

                    

                    console.log('로그인 폼이 나타날 때까지 대기합니다...');

                    const idSelector = 'input#id'; // 사이트의 실제 선택자로 수정 필요

                    const pwSelector = 'input#password'; // 사이트의 실제 선택자로 수정 필요

                    

                    await page.waitForSelector(idSelector);

                    await page.waitForSelector(pwSelector);

        

                    console.log('로그인 정보를 입력합니다...');

                    await page.type(idSelector, username);

                    await page.type(pwSelector, password);

        

                    console.log('로그인 버튼을 클릭합니다...');

                    await page.click('button.btn-login');

        

                    // 로그인 후 페이지 이동 또는 내용 변경을 기다림

                    // AJAX 로그인을 고려하여 페이지 이동이 없어도 에러가 발생하지 않도록 처리

                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {

                        console.log('페이지 이동이 없어 5초 대기합니다 (AJAX 로그인 방식 가정).');

                        return new Promise(resolve => setTimeout(resolve, 5000));

                    });

                    

                    console.log('로그인 성공. 크롤링을 시작합니다.');

                }



        // 크롤링 로직 시작

        const visitedUrls = new Set<string>();

        const urlsToVisit: string[] = [startUrl];

        const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');

        await fs.ensureDir(screenshotsDir);



        while (urlsToVisit.length > 0) {

            const currentUrl = urlsToVisit.shift();



            if (!currentUrl || visitedUrls.has(currentUrl)) {

                continue;

            }



            console.log(`[수집중] ${currentUrl}`);

            visitedUrls.add(currentUrl);



            try {

                // 로그인 세션이 유지된 상태로 페이지 이동

                await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 30000 });



                await autoScroll(page);

                await new Promise(resolve => setTimeout(resolve, 1000));



                const urlObj = new URL(currentUrl);

                const safePathName = urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_');

                const fileName = `${urlObj.hostname.replace(/\./g, '_')}${safePathName}_${Date.now()}.png`;

                const imagePath = path.join(screenshotsDir, fileName);



                await page.screenshot({ path: imagePath, fullPage: true });

                const pageTitle = await page.title();

                console.log(`[캡처 완료] '${pageTitle}' 페이지 (${currentUrl})`);



                await db.run('INSERT INTO screenshots (url, imagePath) VALUES (?, ?)', currentUrl, `/screenshots/${fileName}`);



                const newLinks = await page.evaluate(() => 

                    Array.from(document.querySelectorAll('a[href]'))

                        .map(a => (a as HTMLAnchorElement).href)

                        .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'))

                );



                let newLinksFound = 0;

                for (const link of newLinks) {

                    if (isValidUrl(link, startUrl) && !visitedUrls.has(link)) {

                        urlsToVisit.push(link);

                        newLinksFound++;

                    }

                }

                if (newLinksFound > 0) {

                    console.log(`[링크 발견] ${newLinksFound}개의 새로운 링크를 수집 대기열에 추가했습니다.`);

                }

            } catch (error) {

                console.error(`[오류] ${currentUrl} 처리 중: ${error}`);

            }

        }

        return NextResponse.json({ message: `총 ${visitedUrls.size}개의 페이지 캡처를 완료했습니다.`, count: visitedUrls.size });



    } catch (error: any) {

        console.error('API Error:', error);

        return NextResponse.json({ message: '작업 중 오류가 발생했습니다.', error: error.message }, { status: 500 });

    } finally {

        await browser.close();

        await db.close();

    }

}