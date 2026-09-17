import fs from 'fs';
import path from 'path';

export interface DxDataSong {
    songId: string;
    title: string;
    imageName: string;
    searchAcronyms?: string[];
}

export class DxRatingCoverProvider {
    private static instance: DxRatingCoverProvider;
    private songMap: Map<string, DxDataSong> = new Map();
    private cacheDir: string;

    private constructor() {
        this.cacheDir = path.resolve(process.cwd(), 'data/covers');
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    public static getInstance(): DxRatingCoverProvider {
        if (!DxRatingCoverProvider.instance) {
            DxRatingCoverProvider.instance = new DxRatingCoverProvider();
        }
        return DxRatingCoverProvider.instance;
    }

    private normalizeName(name: string): string {
        // 移除所有空白、全半形轉換、全轉小寫以增加命中率
        return name.toLowerCase().replace(/\s+/g, '').replace(/　/g, '');
    }

    /**
     * 從 GitHub 下載並解析 gekichumai/dxdata 以建立曲名映射
     */
    public async init(): Promise<void> {
        try {
            console.log('[DxRatingCoverProvider] 正在同步 dxdata.json...');
            const res = await fetch('https://raw.githubusercontent.com/gekichumai/dxrating/main/packages/dxdata/dxdata.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json() as { songs: DxDataSong[] };
            
            this.songMap.clear();
            for (const song of data.songs) {
                // 1. 建立原名索引
                const normalizedTitle = this.normalizeName(song.title);
                this.songMap.set(normalizedTitle, song);
                
                // 2. 建立別名/國際服名稱索引 (增加國際服翻譯名稱的命中率)
                if (song.searchAcronyms && Array.isArray(song.searchAcronyms)) {
                    for (const ac of song.searchAcronyms) {
                        this.songMap.set(this.normalizeName(ac), song);
                    }
                }
            }
            console.log(`[DxRatingCoverProvider] 已成功載入 ${data.songs.length} 筆曲目資料。`);
        } catch (e) {
            console.error('[DxRatingCoverProvider] 同步 dxdata 失敗:', e);
        }
    }

    /**
     * 獲取官方原版曲名 (例如將國際版英文名轉回日文原名，或修復空白問題)
     */
    public getOriginalTitle(songName: string): string {
        const normalized = this.normalizeName(songName);
        const song = this.songMap.get(normalized);
        return song ? song.title : songName; // 如果找不到，退回原輸入
    }

    /**
     * 獲取曲繪並轉換為 Base64 Data URI，供 mai-kit 使用。具備本機快取機制避免重複下載。
     */
    public async getCoverDataUri(songName: string): Promise<string | undefined> {
        const normalized = this.normalizeName(songName);
        const song = this.songMap.get(normalized);
        if (!song || !song.imageName) return undefined;

        const imageName = song.imageName;
        const localPath = path.join(this.cacheDir, `${imageName}.jpg`);

        // 1. 檢查是否有本地快取
        if (fs.existsSync(localPath)) {
            try {
                const buffer = fs.readFileSync(localPath);
                const base64 = buffer.toString('base64');
                return `data:image/jpeg;base64,${base64}`;
            } catch (e) {
                console.warn(`[DxRatingCoverProvider] 讀取本地快取封面失敗: ${songName}`, e);
            }
        }

        // 2. 沒有快取的話就從遠端抓取
        const url = `https://shama.dxrating.net/images/cover/v2/${imageName}.jpg`;
        try {
            const res = await fetch(url);
            if (!res.ok) return undefined;
            const buffer = await res.arrayBuffer();
            
            // 存入快取
            fs.writeFileSync(localPath, Buffer.from(buffer));
            
            const base64 = Buffer.from(buffer).toString('base64');
            return `data:image/jpeg;base64,${base64}`;
        } catch (e) {
            console.error(`[DxRatingCoverProvider] 下載曲繪失敗: ${songName}`, e);
            return undefined;
        }
    }
}
