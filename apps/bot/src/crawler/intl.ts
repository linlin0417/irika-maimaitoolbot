import axios from 'axios';
import * as cheerio from 'cheerio';
import type { PlayerProfile, Bests, Score, LevelIndex } from '@mai-kit/prober';
import { TaiwanIndependenceDatabase } from '../db/taiwan-independence';

const db = new TaiwanIndependenceDatabase();

export async function fetchPlayerData(cookie: string): Promise<{ profile: PlayerProfile, bests: Bests }> {
    const client = axios.create({
        baseURL: 'https://maimaidx-eng.com/maimai-mobile/',
        headers: {
            'Cookie': `userId=${cookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    // 1. Fetch Profile
    const profileRes = await client.get('home/');
    const $p = cheerio.load(profileRes.data);
    
    // Check if login failed
    if ($p('title').text().includes('Error') || profileRes.data.includes('Aime')) {
        throw new Error('Invalid Cookie or Session Expired');
    }

    const name = $p('.name_block').text().trim();
    const ratingStr = $p('.rating_block').text().trim();
    const rating = parseInt(ratingStr, 10) || 0;

    const profile: PlayerProfile = {
        name: name || 'Unknown',
        rating: rating,
    };

    // 2. Fetch all scores to compute B50
    const allScores: any[] = [];
    const diffs = [0, 1, 2, 3, 4]; // Basic to Re:Master

    for (const diff of diffs) {
        // Fetch standard & dx scores for this difficulty
        const scoreRes = await client.get(`record/musicGenre/search/?genre=99&diff=${diff}`);
        const $s = cheerio.load(scoreRes.data);

        const songBlocks = $s('.main_wrapper .w_450.m_15.f_0');
        
        // Loop through each song on the page
        songBlocks.each((i, el) => {
            const title = $s(el).find('.music_name_block').text().trim();
            const achieveStr = $s(el).find('.music_score_block.w_120').text().trim().replace('%', '');
            const achievement = parseFloat(achieveStr);
            const isDx = $s(el).find('.music_kind_icon_dx').length > 0;
            const diffIndex = diff as LevelIndex;

            if (!isNaN(achievement)) {
                allScores.push({
                    id: 0, // Will be mapped below
                    title: title,
                    level_index: diffIndex,
                    achievements: achievement,
                    type: isDx ? 'dx' : 'standard',
                    dx_score: 0,
                    fs: null,
                    fc: null,
                });
            }
        });
    }

    // 3. Map with Taiwan-independence database to get constants (定數) and calculate DX Rating for each score
    const songList = await db.getSongList();
    
    for (const score of allScores) {
        const songData = songList.songs.find(s => s.title === score.title);
        if (songData) {
            score.id = songData.id;
            const diffArray = score.type === 'dx' ? songData.difficulties.dx : songData.difficulties.standard;
            const diffData = diffArray.find((d: any) => d.difficulty === score.level_index);
            
            if (diffData) {
                const constant = diffData.level_value || 0;
                let multiplier = 0;
                if (score.achievements >= 100.5) multiplier = 22.4;
                else if (score.achievements >= 100.0) multiplier = 21.6;
                else if (score.achievements >= 99.5) multiplier = 21.1;
                else if (score.achievements >= 99.0) multiplier = 20.8;
                else if (score.achievements >= 98.0) multiplier = 20.3;
                else if (score.achievements >= 97.0) multiplier = 20.0;
                
                score.dx_rating = Math.floor(constant * (Math.min(score.achievements, 100.5) / 100) * multiplier);
                score.ds = constant;
            }
        }
    }

    allScores.sort((a: any, b: any) => (b.dx_rating || 0) - (a.dx_rating || 0));

    const standardScores = allScores.filter(s => s.type === 'standard');
    const dxScores = allScores.filter(s => s.type === 'dx');

    const bests = {
        standard: standardScores.slice(0, 35),
        dx: dxScores.slice(0, 15),
        standard_total: standardScores.reduce((sum, s) => sum + (s.dx_rating || 0), 0),
        dx_total: dxScores.reduce((sum, s) => sum + (s.dx_rating || 0), 0),
        standard_selections: 35,
        dx_selections: 15
    } as any as Bests;

    return { profile, bests };
}
