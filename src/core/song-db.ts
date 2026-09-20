import axios from 'axios';
import fs from 'fs';
import path from 'path';

const MAGIC_JSON_URL = 'https://myjian.github.io/Taiwan-independence/external/magic.json';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const CACHE_PATH = path.join(DATA_DIR, 'magic.json');

export interface SongMetadata {
    name: string;
    dx: number; // 0 = Standard, 1 = DX
    lv: number[];
    debut?: number;
    regionOverrides?: {
        intl?: {
            lv: number[];
        }
    }
}

export class SongDatabase {
    private static instance: SongDatabase;
    private data: SongMetadata[] = [];
    private maxDebut: number = 0;

    private constructor() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        this.loadLocalCache();
    }

    public static getInstance(): SongDatabase {
        if (!this.instance) {
            this.instance = new SongDatabase();
        }
        return this.instance;
    }

    /**
     * 從網路同步最新的精確定數表 (每日執行一次即可)
     */
    public async syncFromServer(): Promise<boolean> {
        try {
            console.log('[SongDB] 正在從 myjian/Taiwan-independence 同步定數表...');
            const res = await axios.get(MAGIC_JSON_URL);
            this.data = res.data;
            this.maxDebut = Math.max(...this.data.map(d => d.debut || 0));
            fs.writeFileSync(CACHE_PATH, JSON.stringify(this.data, null, 2));
            console.log(`[SongDB] 定數表同步完成，已寫入本地快取。當前最大 debut 版本為 ${this.maxDebut}`);
            return true;
        } catch (e: any) {
            console.error(`[SongDB] 定數表同步失敗: ${e.message}`);
            return false;
        }
    }

    /**
     * 從本地檔案載入定數表
     */
    private loadLocalCache() {
        if (fs.existsSync(CACHE_PATH)) {
            try {
                const raw = fs.readFileSync(CACHE_PATH, 'utf8');
                this.data = JSON.parse(raw);
                this.maxDebut = Math.max(...this.data.map(d => d.debut || 0));
                console.log(`[SongDB] 成功從本地載入 ${this.data.length} 首歌曲的定數資料。當前最大 debut 版本為 ${this.maxDebut}`);
            } catch (e) {
                console.error('[SongDB] 無法解析本地定數表快取，將在下一次排程重新下載。');
            }
        }
    }

    /**
     * 查詢特定歌曲的精確定數
     * @param songName 曲名
     * @param chartType 'Standard' 或 'DX'
     * @param diffIndex 難度索引 (0=Basic, 1=Advanced, 2=Expert, 3=Master, 4=Re:Master)
     * @returns 該譜面的定數，若找不到則回傳 null
     */
    public getConstant(songName: string, chartType: 'Standard' | 'DX', diffIndex: number): number | null {
        if (!this.data || this.data.length === 0) return null;

        const isDx = chartType === 'DX' ? 1 : 0;
        const song = this.data.find(s => s.name === songName && s.dx === isDx);

        if (!song) return null;

        let constant = 0;
        
        if (song.regionOverrides && song.regionOverrides.intl && song.regionOverrides.intl.lv) {
            constant = song.regionOverrides.intl.lv[diffIndex] as number;
        } else {
            constant = song.lv[diffIndex] as number;
        }

        if (!constant || constant === 0) {
            return null;
        }

        // Taiwan-independence 會用負數表示 "未確定的預估底分" (例如 -11.6 代表 11+)，我們取絕對值作統一運算
        return Math.abs(constant);
    }

    /**
     * 取得所有獨一無二的曲名 (供 Discord Autocomplete 搜尋使用)
     */
    public getAllSongNames(): string[] {
        if (!this.data || this.data.length === 0) return [];
        
        const nameSet = new Set<string>();
        for (const song of this.data) {
            nameSet.add(song.name);
        }
        return Array.from(nameSet);
    }

    /**
     * 判斷是否為目前國際板最新版本的新歌
     * @param songName 曲名
     * @param chartType 'Standard' 或 'DX'
     */
    public isNewSong(songName: string, chartType: 'Standard' | 'DX'): boolean {
        if (!this.data || this.data.length === 0) return false;
        
        const isDx = chartType === 'DX' ? 1 : 0;
        const song = this.data.find(s => s.name === songName && s.dx === isDx);
        
        if (!song) return false;
        
        // 從 CiRCLE (debut 25) 開始，B15 新歌範圍包含當前版本以及前一個版本
        // 為了相容此規則，如果 maxDebut >= 25，則 maxDebut 和 maxDebut - 1 都算新歌
        if (this.maxDebut >= 25) {
            return song.debut === this.maxDebut || song.debut === (this.maxDebut - 1);
        }
        
        return song.debut === this.maxDebut;
    }
}
