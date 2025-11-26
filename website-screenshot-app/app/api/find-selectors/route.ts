import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer'; // Puppeteer 임포트

// CSS 선택자를 생성하는 함수 (페이지 컨텍스트에서 호출될 것이므로 단순화)
function getSelector(element: Element): string {
    if (element.id) {
        return `#${element.id}`;
    }
    if (element.className) {
        const classes = element.className.split(' ').filter(c => c).join('.');
        if (classes) {
            return `${element.tagName.toLowerCase()}.${classes}`;
        }
    }
    if (element.getAttribute('name')) {
        return `${element.tagName.toLowerCase()}[name="${element.getAttribute('name')}"]`;
    }
    return element.tagName.toLowerCase();
}

export async function POST(request: Request) {
    const { url } = await request.json();

    if (!url) {
        return NextResponse.json({ message: 'URL is required' }, { status: 400 });
    }

    const browser = await puppeteer.launch({ headless: true }); // headless 모드
    const page = await browser.newPage();

    try {
        console.log(`[find-selectors] Analyzing URL: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const selectors = await page.evaluate((getSelectorFnStr) => {
            // 문자열로 전달된 getSelector 함수를 다시 함수로 변환
            const getSelectorFn = new Function('element', `return (${getSelectorFnStr})(element);`);

            let idSelector = '';
            let pwSelector = '';
            let btnSelector = '';

            // 1. 비밀번호 필드 찾기 (가장 확실)
            const pwInput = document.querySelector('input[type="password"]');
            if (pwInput) {
                pwSelector = getSelectorFn(pwInput);
            }

            // 2. ID/Username 필드 찾기
            const textInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
            const idKeywords = ['id', 'username', 'userid', 'loginid', 'email'];
            for (const input of textInputs) {
                const name = input.getAttribute('name') || '';
                const id = input.id || '';
                const placeholder = input.getAttribute('placeholder') || '';
                if (idKeywords.some(k => name.includes(k) || id.includes(k) || placeholder.toLowerCase().includes(k))) {
                    idSelector = getSelectorFn(input);
                    break;
                }
            }
            if (!idSelector && textInputs.length > 0 && getSelectorFn(textInputs[0]) !== pwSelector) {
                idSelector = getSelectorFn(textInputs[0]);
            }

            // 3. 로그인 버튼 찾기
            const btnKeywords = ['로그인', 'login'];
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a'));
            for (const btn of buttons) {
                const text = (btn.textContent || (btn as HTMLInputElement).value || '').trim().toLowerCase();
                if (btnKeywords.some(k => text.includes(k))) {
                    btnSelector = getSelectorFn(btn);
                    break;
                }
            }
            if (!btnSelector) {
                const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
                if (submitBtn) {
                    btnSelector = getSelectorFn(submitBtn);
                }
            }

            return { idSelector, pwSelector, btnSelector };
        }, getSelector.toString()); // getSelector 함수를 페이지 컨텍스트로 전달

        console.log(`[find-selectors] Found selectors:`, selectors);
        return NextResponse.json(selectors);

    } catch (error: any) {
        console.error('Error in find-selectors API:', error);
        return NextResponse.json({ message: '선택자를 찾는 중 오류가 발생했습니다.', error: error.message }, { status: 500 });
    } finally {
        await browser.close();
    }
}