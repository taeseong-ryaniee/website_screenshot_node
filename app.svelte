async function startCrawling() {
  crawlStatus = 'running';
  progress = { visited: 0, captured: 0, skipped: 0 };
  screenshots = [];
  logMessages = [];
  
  addLog(`크롤링 시작: ${settings.baseUrl}`);
  
  try {
    // 백엔드 API 호출
    const response = await fetch('http://localhost:3000/api/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        baseUrl: settings.baseUrl,
        removeAosEffect: settings.removeAOS,
        captureDelay: settings.captureDelay,
        viewport: settings.viewport
      })
    });
    
    const data = await response.json();
    addLog(`크롤링 작업이 시작되었습니다. JobID: ${data.jobId}`);
    
    // 백그라운드에서 결과를 주기적으로 확인
    pollCrawlStatus(data.jobId);
  } catch (error) {
    addLog(`크롤링 중 오류 발생: ${error.message}`, 'error');
    crawlStatus = 'error';
  }
}

// 백엔드에서 크롤링 상태 확인
function pollCrawlStatus(jobId) {
  const interval = setInterval(async () => {
    try {
      // 스크린샷 목록 가져오기
      const response = await fetch('http://localhost:3000/api/screenshots');
      const data = await response.json();
      
      // 프로그레스 및 스크린샷 업데이트
      screenshots = data.screenshots;
      progress.captured = screenshots.length;
      
      // 모든 스크린샷을 가져왔다면 크롤링 완료로 처리
      if (screenshots.length > 0 && !screenshots.find(s => s.timestamp > new Date(Date.now() - 30000).toISOString())) {
        clearInterval(interval);
        crawlStatus = 'completed';
        addLog('크롤링이 완료되었습니다.', 'success');
      }
    } catch (error) {
      addLog(`상태 확인 중 오류 발생: ${error.message}`, 'error');
    }
  }, 5000); // 5초마다 확인
}