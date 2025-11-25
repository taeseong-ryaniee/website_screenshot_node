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
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);

  // 페이지 로드 시 및 캡처 완료 시 스크린샷 목록을 가져옴
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('스크린샷 캡처를 시작합니다...');

    const payload = {
      startUrl,
      needsLogin,
      ...(needsLogin && { username, password }),
    };

    try {
      const res = await fetch('/api/crawl-and-screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4 font-sans">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">웹사이트 스크린샷 캡처</h1>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-md mb-10">
        <div className="mb-4">
          <label htmlFor="startUrl" className="block text-gray-700 text-sm font-bold mb-2">
            시작 URL:
          </label>
          <input
            type="url"
            id="startUrl"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={startUrl}
            onChange={(e) => setStartUrl(e.target.value)}
            placeholder="예: https://lms.cbitlelms.or.kr/main/"
            required
          />
        </div>

        <div className="mb-4">
          <input
            type="checkbox"
            id="needsLogin"
            className="mr-2 leading-tight"
            checked={needsLogin}
            onChange={(e) => setNeedsLogin(e.target.checked)}
          />
          <label htmlFor="needsLogin" className="text-gray-700 text-sm font-bold">
            로그인 필요
          </label>
        </div>

        {needsLogin && (
          <div className="mb-4 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h3 className="text-md font-bold mb-2">로그인 정보</h3>
            <div className="mb-2">
              <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-1">
                아이디:
              </label>
              <input
                type="text"
                id="username"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={needsLogin}
              />
            </div>
            <div className="mb-2">
              <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-1">
                비밀번호:
              </label>
              <input
                type="password"
                id="password"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={needsLogin}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
          disabled={isLoading}
        >
          {isLoading ? '처리 중...' : '스크린샷 캡처'}
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