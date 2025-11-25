'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Screenshot {
  id: number;
  url: string;
  imagePath: string;
  timestamp: string;
}

export default function Home() {
  const [startUrl, setStartUrl] = useState<string>('');
  const [needsLogin, setNeedsLogin] = useState<boolean>(false);
  
  // 로그인 정보 상태
  const [loginUrl, setLoginUrl] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  // 선택자 정보 상태
  const [idSelector, setIdSelector] = useState<string>('');
  const [pwSelector, setPwSelector] = useState<string>('');
  const [btnSelector, setBtnSelector] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);

  useEffect(() => {
    fetchScreenshots();
  }, []);

  const fetchScreenshots = async () => {
    try {
      const res = await fetch('/api/screenshots');
      if (res.ok) {
        const data: Screenshot[] = await res.json();
        setScreenshots(data);
      }
    } catch (error) {
      console.error('스크린샷 목록 가져오기 오류:', error);
    }
  };

  const handleFindSelectors = async () => {
    if (!loginUrl) {
      setMessage('선택자를 찾으려면 로그인 페이지 URL을 입력해야 합니다.');
      return;
    }
    setIsLoading(true);
    setMessage('로그인 폼 선택자를 찾는 중...');
    try {
      const res = await fetch('/api/find-selectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: loginUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setIdSelector(data.idSelector || '');
        setPwSelector(data.pwSelector || '');
        setBtnSelector(data.btnSelector || '');
        setMessage('선택자를 자동으로 채웠습니다. 필요한 경우 수정하세요.');
      } else {
        const errorData = await res.json();
        setMessage(`선택자 찾기 오류: ${errorData.message}`);
      }
    } catch (error: any) {
      setMessage(`선택자 찾기 API 호출 오류: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('스크린샷 캡처를 시작합니다...');

    const payload: any = { startUrl, needsLogin };
    if (needsLogin) {
      payload.username = username;
      payload.password = password;
      payload.selectors = {
        loginUrl,
        idSelector,
        pwSelector,
        btnSelector,
      };
    }

    try {
      const res = await fetch('/api/crawl-and-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setMessage(data.message);

      if (res.ok) {
        fetchScreenshots(); // 성공 시 목록 새로고침
      }
    } catch (error: any) {
      console.error('API 호출 오류:', error);
      setMessage(`API 호출 오류: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = "shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline";

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4 font-sans">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">웹사이트 스크린샷 캡처</h1>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-2xl mb-10">
        <div className="mb-4">
          <label htmlFor="startUrl" className="block text-gray-700 text-sm font-bold mb-2">
            크롤링 시작 URL:
          </label>
          <input type="url" id="startUrl" className={inputStyle} value={startUrl} onChange={(e) => setStartUrl(e.target.value)} placeholder="예: https://lms.cbitlelms.or.kr/main/" required />
        </div>

        <div className="mb-4">
          <input type="checkbox" id="needsLogin" className="mr-2 leading-tight" checked={needsLogin} onChange={(e) => setNeedsLogin(e.target.checked)} />
          <label htmlFor="needsLogin" className="text-gray-700 text-sm font-bold">
            고급 옵션 / 로그인 필요
          </label>
        </div>

        {needsLogin && (
          <div className="p-4 border border-gray-200 rounded-md bg-gray-50 space-y-4">
            <h3 className="text-lg font-bold">로그인 정보</h3>
            
            <div className="mb-4">
              <label htmlFor="loginUrl" className="block text-gray-700 text-sm font-bold mb-1">
                로그인 페이지 URL
              </label>
              <div className="flex items-center gap-2">
                <input type="url" id="loginUrl" className={inputStyle} value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} placeholder="https://lms.cbitlelms.or.kr" required={needsLogin} />
                <button type="button" onClick={handleFindSelectors} disabled={isLoading} className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline whitespace-nowrap">
                  선택자 자동 찾기
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">로그인 폼이 있는 페이지의 주소를 입력하세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-1">아이디:</label>
                <input type="text" id="username" className={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} required={needsLogin} />
              </div>
              <div>
                <label htmlFor="password">비밀번호:</label>
                <input type="password" id="password" className={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} required={needsLogin} />
              </div>
            </div>

            <div className="p-4 border border-blue-200 rounded-md bg-blue-50">
                <h4 className="text-md font-bold mb-2 text-blue-800">CSS 선택자 (자동 채우기)</h4>
                <p className="text-xs text-blue-700 mb-2">"선택자 자동 찾기" 버튼을 누르면 자동으로 채워집니다. 값이 부정확할 경우 <a href="https://www.w3schools.com/cssref/css_selectors.asp" target="_blank" rel="noopener noreferrer" className="underline">CSS 선택자 규칙</a>에 따라 수동으로 수정할 수 있습니다.</p>
                <div className="space-y-2">
                    <div>
                        <label htmlFor="idSelector" className="text-sm font-medium">아이디 선택자:</label>
                        <input type="text" id="idSelector" className={inputStyle} value={idSelector} onChange={(e) => setIdSelector(e.target.value)} required={needsLogin}/>
                    </div>
                    <div>
                        <label htmlFor="pwSelector" className="text-sm font-medium">비밀번호 선택자:</label>
                        <input type="text" id="pwSelector" className={inputStyle} value={pwSelector} onChange={(e) => setPwSelector(e.target.value)} required={needsLogin}/>
                    </div>
                    <div>
                        <label htmlFor="btnSelector" className="text-sm font-medium">로그인 버튼 선택자:</label>
                        <input type="text" id="btnSelector" className={inputStyle} value={btnSelector} onChange={(e) => setBtnSelector(e.target.value)} required={needsLogin}/>
                    </div>
                </div>
            </div>
          </div>
        )}

        <button type="submit" className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full" disabled={isLoading}>
          {isLoading ? '처리 중...' : '스크린샷 캡처 시작'}
        </button>
        {message && <p className="mt-4 text-center text-sm text-gray-600">{message}</p>}
      </form>

      <h2 className="text-3xl font-bold text-gray-800 mb-6 mt-10">캡처된 스크린샷</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
        {screenshots.length > 0 ? (
            screenshots.map((screenshot) => (
              <div key={screenshot.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <Image
                  src={screenshot.imagePath}
                  alt={screenshot.url}
                  width={1200}
                  height={800}
                  layout="responsive"
                  objectFit="contain"
                  className="w-full h-auto"
                />
                <div className="p-4">
                  <p className="text-gray-700 text-sm break-all">{screenshot.url}</p>
                  <p className="text-gray-500 text-xs mt-1">{new Date(screenshot.timestamp).toLocaleString('ko-KR')}</p>
                </div>
              </div>
            ))
        ) : (
          <p className="text-gray-600 text-center col-span-full">아직 캡처된 스크린샷이 없습니다.</p>
        )}
      </div>
    </div>
  );
}