import { NextResponse } from 'next/server';
import { snap } from 'snapdom';

// CSS 선택자를 생성하는 함수
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

    try {
        console.log(`[find-selectors] Analyzing URL: ${url}`);
        const { window } = await snap(url);
        const document = window.document;

        let idSelector = '';
        let pwSelector = '';
        let btnSelector = '';

        // 1. 비밀번호 필드 찾기 (가장 확실)
        const pwInput = document.querySelector('input[type="password"]');
        if (pwInput) {
            pwSelector = getSelector(pwInput);
        }

        // 2. ID/Username 필드 찾기
        const textInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
        const idKeywords = ['id', 'username', 'userid', 'loginid', 'email'];
        for (const input of textInputs) {
            const name = input.getAttribute('name') || '';
            const id = input.id || '';
            const placeholder = input.getAttribute('placeholder') || '';
            if (idKeywords.some(k => name.includes(k) || id.includes(k) || placeholder.toLowerCase().includes(k))) {
                // 비밀번호 필드 바로 위/앞에 있는 텍스트 필드를 우선적으로 고려할 수 있음 (나중에 추가)
                idSelector = getSelector(input);
                break;
            }
        }
        // 만약 못찾았으면 첫번째 텍스트 input으로 대체
        if (!idSelector && textInputs.length > 0 && getSelector(textInputs[0]) !== pwSelector) {
            idSelector = getSelector(textInputs[0]);
        }


        // 3. 로그인 버튼 찾기
        const btnKeywords = ['로그인', 'login'];
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a'));
        for (const btn of buttons) {
            const text = (btn.textContent || (btn as HTMLInputElement).value || '').trim().toLowerCase();
            if (btnKeywords.some(k => text.includes(k))) {
                btnSelector = getSelector(btn);
                break;
            }
        }
        // submit 타입 버튼을 우선적으로 고려
        if (!btnSelector) {
            const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
            if (submitBtn) {
                btnSelector = getSelector(submitBtn);
            }
        }
        

        console.log(`[find-selectors] Found selectors:`, { idSelector, pwSelector, btnSelector });
        return NextResponse.json({ idSelector, pwSelector, btnSelector });

    } catch (error: any) {
        console.error('Error in find-selectors API:', error);
        return NextResponse.json({ message: '선택자를 찾는 중 오류가 발생했습니다.', error: error.message }, { status: 500 });
    }
}
