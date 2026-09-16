import axios from 'axios';
import type { MaimaiDatabase, SongList, Song, SongType, AssetType } from '@mai-kit/database';

export class TaiwanIndependenceDatabase {
    private songListCache: SongList | null = null;
    private rawData: any = null;

    async getSongList(): Promise<SongList> {
        if (this.songListCache) return this.songListCache;

        const url = 'https://raw.githubusercontent.com/myjian/Taiwan-independence/gh-pages/external/arcade-songs-maimai.json';
        const res = await axios.get(url);
        this.rawData = res.data;

        const songs: Song[] = res.data.songs.map((s: any) => {
            const difficulties: any = { standard: [], dx: [], utage: [] };

            s.sheets.forEach((sheet: any) => {
                const diffType = sheet.type === 'dx' ? 'dx' : (sheet.type === 'std' ? 'standard' : 'utage');
                const diffMap: Record<string, number> = {
                    'basic': 0,
                    'advanced': 1,
                    'expert': 2,
                    'master': 3,
                    'remaster': 4
                };
                
                difficulties[diffType].push({
                    type: diffType as SongType,
                    difficulty: diffMap[sheet.difficulty],
                    level: sheet.level,
                    level_value: sheet.internalLevelValue || sheet.levelValue,
                    note_designer: sheet.noteDesigner
                });
            });

            return {
                id: parseInt(s.songId, 10) || parseInt(s.imageName, 16) || 0,
                title: s.title,
                artist: s.artist,
                genre: s.category,
                bpm: s.bpm,
                version: 0,
                difficulties
            } as Song;
        });

        this.songListCache = { songs };
        return this.songListCache;
    }

    async getSong(id: number | string): Promise<Song> {
        const list = await this.getSongList();
        const song = list.songs.find(s => s.id == id || s.title == id);
        if (!song) throw new Error(`Song ${id} not found`);
        return song;
    }

    async getChartTags() {
        return [];
    }

    async getAsset(type: AssetType, id: number): Promise<Uint8Array> {
        if (type === 'jacket') {
            await this.getSongList();
            const songData = this.songListCache?.songs.find(s => s.id === id);
            if (songData) {
                const rawSong = this.rawData.songs.find((s: any) => s.title === songData.title);
                if (rawSong && rawSong.imageName) {
                    const imgUrl = `https://www.diving-fish.com/covers/${rawSong.imageName}`;
                    try {
                        const res = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                        return new Uint8Array(res.data);
                    } catch (e) {
                        // Throw on fetch error
                    }
                }
            }
        }
        throw new Error(`Asset not found`);
    }
}
