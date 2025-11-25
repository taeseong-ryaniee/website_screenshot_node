import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs-extra';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { snap } from 'snapdom'; // Snapdom 임포트

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
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

// URL 유효성 및 도메인 확인
const isValidUrl = (url: string, baseUrl: string): boolean => {
    try {
        const parsedUrl = new URL(url);
        const parsedBaseUrl = new URL(baseUrl);
        return parsedUrl.protocol.startsWith('http') && parsedUrl.hostname === parsedBaseUrl.hostname;
    } catch (e) {
        return false;
    }
};

// Snapdom을 사용한 크롤러 함수
async function crawlLinksWithSnapdom(startUrl: string): Promise<string[]> {
    console.log('[Snapdom] 링크 수집을 시작합니다...');
    const visited = new Set<string>();
    const queue: string[] = [startUrl];
    visited.add(startUrl);

    let i = 0;
    while (i < queue.length) {
        const currentUrl = queue[i++];
        console.log(`[Snapdom] 수집 중: ${currentUrl}`);

        try {
            const { window } = await snap(currentUrl);
            const links = Array.from(window.document.querySelectorAll('a[href]'))
                .map(a => (a as HTMLAnchorElement).href)
                .map(href => new URL(href, currentUrl).href) // 상대 경로를 절대 경로로 변환
                .filter(href => href && href.startsWith('http'));

            for (const link of links) {
                if (isValidUrl(link, startUrl) && !visited.has(link)) {
                    visited.add(link);
                    queue.push(link);
                }
            }
        } catch (error) {
            console.error(`[Snapdom] ${currentUrl} 수집 중 오류:`, error);
        }
    }
    console.log(`[Snapdom] 총 ${visited.size}개의 고유한 URL을 수집했습니다.`);
    return Array.from(visited);
}


export async function POST(request: Request) {
    const { startUrl, needsLogin, username, password } = await request.json();

    if (!startUrl) {
        return NextResponse.json({ message: '시작 URL을 입력해주세요.' }, { status: 400 });
    }

    try {
        // --- 1단계: Snapdom으로 링크 크롤링 ---
        const urlsToCapture = await crawlLinksWithSnapdom(startUrl);

        if (!urlsToCapture || urlsToCapture.length === 0) {
            return NextResponse.json({ message: '캡처할 URL을 수집하지 못했습니다.' }, { status: 400 });
        }
        
        // --- 2단계: Puppeteer로 스크린샷 캡처 ---
        console.log('[Puppeteer] 스크린샷 캡처를 시작합니다...');
        const db = await initializeDatabase();
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // 공통 페이지 설정
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' });
        await page.emulate({ viewport: { width: 1920, height: 1080 }, locale: 'ko-KR' });

        // 로그인 처리 (필요시)
        if (needsLogin && username && password) {
            console.log('[Puppeteer] 로그인 페이지로 이동합니다...');
            await page.goto("https://lms.cbitlelms.or.kr/", { waitUntil: 'networkidle2' });
            
            console.log('[Puppeteer] 로그인 정보를 입력합니다...');
            await page.waitForSelector('input#id');
            await page.type('input#id', username);
            await page.waitForSelector('input#password');
            await page.type('input#password', password);

            console.log('[Puppeteer] 로그인 버튼을 클릭합니다...');
            await page.click('button.btn-login');

            await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => console.log('페이지 이동 감지 안됨. 계속 진행.'));
            console.log('[Puppeteer] 로그인 시도 완료.');
        }

        // 스크린샷 캡처 로직
        const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
        await fs.ensureDir(screenshotsDir);

        for (const url of urlsToCapture) {
            try {
                console.log(`[Puppeteer] 캡처 중: ${url}`);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

                await autoScroll(page);
                await new Promise(resolve => setTimeout(resolve, 1000));

                const urlObj = new URL(url);
                const safePathName = urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_');
                const fileName = `${urlObj.hostname.replace(/\./g, '_')}${safePathName}_${Date.now()}.png`;
                const imagePath = path.join(screenshotsDir, fileName);

                await page.screenshot({ path: imagePath, fullPage: true });
                const pageTitle = await page.title();
                console.log(`[캡처 완료] '${pageTitle}' 페이지 (${url})`);

                await db.run('INSERT INTO screenshots (url, imagePath) VALUES (?, ?)', url, `/screenshots/${fileName}`);
            } catch (error) {
                console.error(`[Puppeteer] ${url} 캡처 중 오류: ${error}`);
            }
        }
        
        await browser.close();
        await db.close();
        return NextResponse.json({ message: `총 ${urlsToCapture.length}개의 페이지 캡처를 완료했습니다.`, count: urlsToCapture.length });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ message: '작업 중 오류가 발생했습니다.', error: error.message }, { status: 500 });
    }
}
