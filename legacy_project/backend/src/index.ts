// index.ts

import puppeteer, {Browser, Page} from 'puppeteer';
import fs from 'fs';
import path from 'path';

// 인터페이스 정의
interface TabElement {
    selector: string;
    index: number;
    name: string;
}

interface PageConfig {
    url: string;
    type: 'main' | 'sub' | 'board' | 'tabbed';
    tabs?: TabElement[];
    boardSelector?: string;
}

// 폴더 생성 함수
const createFolder = (folderPath: string): void => {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
};

// 날짜 기반 폴더 이름 생성 함수
const getDateFolderName = (): string => {
    const now = new Date();
    return `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(
        now.getDate()
    ).padStart(2, '0')}`;
};

// URL 패턴 확인 함수
const shouldCaptureUrl = (url: string): boolean => {
    // sub.php?code=숫자 형태 확인
    if (/\/sub\.php\?code=\d+$/.test(url)) {
        return true;
    }

    // 메인 페이지 확인
    return url === 'https://ccrf.or.kr/' ||
        url === 'https://ccrf.or.kr/index.php' ||
        url === 'https://ccrf.or.kr/index.do';


};

// URL 패턴에 맞는 링크만 수집
const shouldCollectUrl = (url: string): boolean => {
    // sub.php?code=숫자 형태 또는 메인 페이지만 수집
    return shouldCaptureUrl(url);
};

// 페이지 타입 감지 함수
const detectPageType = async (page: Page): Promise<'main' | 'sub' | 'board' | 'tabbed'> => {
    // URL 기반 기본 타입 설정
    const url = page.url();
    let pageType: 'main' | 'sub' | 'board' | 'tabbed' = 'sub';

    if (url === 'https://ccrf.or.kr/' ||
        url === 'https://ccrf.or.kr/index.php' ||
        url === 'https://ccrf.or.kr/index.do') {
        pageType = 'main';
    }

    // 게시판 감지 - 일반적인 게시판 선택자 확인
    const boardElements = await page.$$eval(
        'table.board_list, div.board_list, ul.board_list',
        (elements) => elements.length
    );

    if (boardElements > 0) {
        pageType = 'board';
    }

    // 탭 구조 감지 - 일반적인 탭 선택자 확인
    const tabElements = await page.$$eval(
        'ul.tabs li, div.tab_menu a, div.tabArea ul li',
        (elements) => elements.length
    );

    if (tabElements > 0) {
        pageType = 'tabbed';
    }

    return pageType;
};

// 탭 요소 찾기 함수
const findTabElements = async (page: Page): Promise<TabElement[]> => {
    // 일반적으로 사용되는 탭 선택자들을 확인
    const tabSelectors = [
        'ul.tabs li',
        'div.tab_menu a',
        'div.tabArea ul li',
        '.tab_content .tab',
        '.tab-menu li'
    ];

    for (const selector of tabSelectors) {
        const tabsCount = await page.$$eval(selector, (tabs) => tabs.length);

        if (tabsCount > 0) {
            // 탭 요소 정보 수집
            return await page.$$eval(selector, (elements, selector) => {
                return elements.map((el, index) => ({
                    selector: selector,
                    index: index,
                    name: el.textContent?.trim() || `Tab ${index + 1}`
                }));
            }, selector);
        }
    }

    return [];
};

// 페이지 스크린샷 함수
const capturePageScreenshot = async (
    page: Page,
    baseDir: string,
    pageName: string,
    suffix: string = ''
): Promise<void> => {
    // 전체 페이지가 로드될 때까지 대기
    await page.evaluate(() => {
        return new Promise<void>((resolve) => {
            // 페이지가 완전히 로드되었거나 최대 5초 후에 해상도
            let totalHeight = 0;
            const intervalId = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                if (scrollHeight > totalHeight) {
                    totalHeight = scrollHeight;
                    window.scrollTo(0, scrollHeight);
                } else {
                    clearInterval(intervalId);
                    resolve();
                }
            }, 200);

            // 최대 대기 시간
            setTimeout(() => {
                clearInterval(intervalId);
                resolve();
            }, 5000);
        });
    });

    // 스크롤을 맨 위로
    await page.evaluate(() => {
        window.scrollTo(0, 0);
    });

    // 페이지 전체 스크린샷 캡처
    const fileNameSuffix = suffix ? `_${suffix}` : '';
    const fileName = `${pageName}${fileNameSuffix}.png`;
    const filePath = path.join(baseDir, fileName);

    // 스크린샷 옵션 정의 - path를 직접 객체 내부에서 설정
    const screenshotOptions = {
        path: filePath,
        fullPage: true
    } as any;

    // 스크린샷 촬영
    await page.screenshot(screenshotOptions);

    console.log(`Screenshot saved: ${fileName}`);
};

// 페이지 처리 함수
const processPage = async (
    browser: Browser,
    pageConfig: PageConfig,
    baseDir: string
): Promise<void> => {
    const page = await browser.newPage();

    // 뷰포트 설정
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        // 페이지 로딩
        await page.goto(pageConfig.url, { waitUntil: 'networkidle2', timeout: 30000 });

        // URL에서 페이지 이름 추출
        const urlObj = new URL(pageConfig.url);
        const pageName = urlObj.pathname === '/' ? 'index' :
            path.basename(urlObj.pathname).replace(/\.[^.]+$/, '');

        // 페이지 유형이 지정되지 않은 경우 자동 감지
        const pageType = pageConfig.type || await detectPageType(page);

        switch (pageType) {
            case 'main':
                await capturePageScreenshot(page, baseDir, pageName);
                break;

            case 'sub':
                await capturePageScreenshot(page, baseDir, pageName);
                break;

            case 'board':
                // 게시판은 리스트 페이지만 캡처
                await capturePageScreenshot(page, baseDir, pageName, 'list');
                break;

            case 'tabbed':
                // 기본 상태 캡처 (첫 번째 탭이 활성화된 상태)
                await capturePageScreenshot(page, baseDir, pageName, 'default');

                // 탭 요소 찾기
                const tabs = pageConfig.tabs || await findTabElements(page);

                // 각 탭 클릭하고 스크린샷
                for (let i = 0; i < tabs.length; i++) {
                    const tab = tabs[i];

                    try {
                        // 탭 클릭
                        await page.evaluate((selector, index) => {
                            const elements = document.querySelectorAll(selector);
                            if (elements[index]) {
                                (elements[index] as HTMLElement).click();
                            }
                        }, tab.selector, tab.index);

                        // 탭 컨텐츠 로딩 대기 - waitForTimeout 대신 setTimeout과 Promise 사용
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // 탭 스크린샷 캡처
                        await capturePageScreenshot(page, baseDir, pageName, `tab_${i + 1}_${tab.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`);
                    } catch (error) {
                        console.error(`Error capturing tab ${i + 1}: ${error}`);
                    }
                }
                break;
        }
    } catch (error) {
        console.error(`Error processing ${pageConfig.url}: ${error}`);
    } finally {
        await page.close();
    }
};

// 링크 추출 함수
const extractLinks = async (page: Page): Promise<string[]> => {
    const links = await page.$$eval('a[href]', (elements) => {
        return elements
            .map((el) => el.getAttribute('href'))
            .filter((href) => href && !href.startsWith('#') && !href.startsWith('javascript:')) as string[];
    });

    // 상대 경로를 절대 경로로 변환
    const baseUrl = new URL(page.url()).origin;
    return links
        .map((href) => {
            try {
                return new URL(href, baseUrl).href;
            } catch (e) {
                return null;
            }
        })
        .filter((url): url is string => url !== null && shouldCollectUrl(url));
};

// 메인 함수
const main = async (): Promise<void> => {
    // 브라우저 시작 - headless 옵션 수정
    const browser = await puppeteer.launch({
        headless: true, // "new" 대신 true 사용
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // 시작 URL 설정
        const startUrl = 'https://ccrf.or.kr/';

        // 결과 저장 폴더 생성
        const dateFolder = getDateFolderName();
        const baseDir = path.join(process.cwd(), 'screenshots', dateFolder);
        createFolder(baseDir);

        // 처리할 URL 목록
        const urlsToProcess = new Set<string>([startUrl]);
        const processedUrls = new Set<string>();

        // 페이지 객체 생성
        const mainPage = await browser.newPage();
        await mainPage.setViewport({ width: 1920, height: 1080 });

        // 첫 페이지 로딩 및 링크 추출
        await mainPage.goto(startUrl, { waitUntil: 'networkidle2' });
        const initialLinks = await extractLinks(mainPage);
        initialLinks.forEach((url) => urlsToProcess.add(url));
        await mainPage.close();

        console.log(`Found ${urlsToProcess.size} URLs to process`);

        // 각 URL 처리
        for (const url of urlsToProcess) {
            if (processedUrls.has(url)) continue;

            const page = await browser.newPage();

            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                const pageType = await detectPageType(page);

                console.log(`Processing ${url} (${pageType})`);

                // 탭이 있는 경우 탭 요소 찾기
                let tabs: TabElement[] = [];
                if (pageType === 'tabbed') {
                    tabs = await findTabElements(page);
                    console.log(`Found ${tabs.length} tabs on the page`);
                }

                // 페이지 처리
                await processPage(browser, {
                    url,
                    type: pageType,
                    tabs
                }, baseDir);

                // 처리된 URL 기록
                processedUrls.add(url);

                // 추가 링크 발견 및 처리
                if (urlsToProcess.size < 100) { // 최대 URL 수 제한
                    const newLinks = await extractLinks(page);
                    newLinks.forEach((newUrl) => {
                        if (!processedUrls.has(newUrl)) {
                            urlsToProcess.add(newUrl);
                        }
                    });
                }
            } catch (error) {
                console.error(`Error processing ${url}: ${error}`);
            } finally {
                await page.close();
            }
        }

        console.log(`Processed ${processedUrls.size}/${urlsToProcess.size} URLs`);

    } catch (error) {
        console.error(`Error in main process: ${error}`);
    } finally {
        await browser.close();
    }
};

// 프로그램 실행
main().catch((error) => {
    console.error(`Unhandled error: ${error}`);
    process.exit(1);
});
