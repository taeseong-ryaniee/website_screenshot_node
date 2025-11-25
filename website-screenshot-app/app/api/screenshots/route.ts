import { NextResponse } from 'next/server';
import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

// SQLite 데이터베이스 초기화 함수 (중복 방지를 위해 공통 유틸리티로 분리하는 것이 좋음)
async function initializeDatabase() {
    const db = await open({
        filename: path.join(process.cwd(), 'screenshots.sqlite'),
        driver: sqlite3.Database
    });
    // 테이블이 없으면 생성 (crawl-and-screenshot에서 이미 생성하지만 안전을 위해)
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

export async function GET() {
    const db = await initializeDatabase();
    try {
        const screenshots = await db.all('SELECT * FROM screenshots ORDER BY timestamp DESC');
        return NextResponse.json(screenshots);
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ message: 'Failed to retrieve screenshots', error: error.message }, { status: 500 });
    } finally {
        await db.close();
    }
}