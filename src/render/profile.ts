import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getUserCollections, getUser } from '../db/repository.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export async function generateProfileCard(discordId: string, type: 'small' | 'large'): Promise<Buffer> {
    const user = getUser(discordId) as any;
    if (!user) throw new Error('User not found');

    const collections = getUserCollections(discordId);
    
    // Fallback default URLs for missing items
    const defaultPlate = 'https://maimaidx-eng.com/maimai-mobile/img/NamePlate/27530616b7582bba.png';
    const defaultFrame = 'https://maimaidx-eng.com/maimai-mobile/img/Frame/27530616b7582bba.png';
    
    const plateUrl = user.current_plate || defaultPlate;
    const frameUrl = user.current_frame || defaultFrame;
    const title = user.current_title || 'Novice Player';
    
    // Resolve icon
    let iconPath = path.resolve(process.cwd(), `data/icons/${discordId}_ManualIcon.jpg`);
    if (!fs.existsSync(iconPath)) {
        iconPath = path.resolve(process.cwd(), `data/icons/${discordId}_ManualIcon.png`);
    }
    if (!fs.existsSync(iconPath)) {
        iconPath = path.resolve(process.cwd(), `data/icons/${discordId}_UserIcon.jpg`);
    }
    
    let iconImg;
    try {
        if (fs.existsSync(iconPath)) iconImg = await loadImage(iconPath);
    } catch(e) {}

    let plateImg;
    try {
        const plateRes = await axios.get(plateUrl, { responseType: 'arraybuffer' }).catch(() => ({ data: null }));
        if(plateRes.data) plateImg = await loadImage(plateRes.data);
    } catch(e) {}

    let frameImg;
    if (type === 'large') {
        try {
            const frameRes = await axios.get(frameUrl, { responseType: 'arraybuffer' }).catch(() => ({ data: null }));
            if(frameRes.data) frameImg = await loadImage(frameRes.data);
        } catch(e) {}
    }

    const width = 800;
    const height = type === 'small' ? 200 : 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    if (type === 'small') {
        if (plateImg) {
            ctx.drawImage(plateImg, 0, 0, width, height);
        } else {
            ctx.fillStyle = '#2b2b2b';
            ctx.fillRect(0, 0, width, height);
        }

        if (iconImg) ctx.drawImage(iconImg, 20, 20, 160, 160);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillText(user.player_name || 'Guest', 200, 80);

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(`Rating: ${user.rating || 0}`, 200, 140);

        ctx.fillStyle = '#fff';
        ctx.font = '24px sans-serif';
        ctx.fillText(`Title: ${title}`, 200, 180);
    } else {
        if (frameImg) {
            ctx.drawImage(frameImg, 0, 0, width, height);
        } else {
            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, width, height);
        }
        
        if (plateImg) ctx.drawImage(plateImg, 50, 50, 700, 150);
        if (iconImg) ctx.drawImage(iconImg, 80, 70, 110, 110);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText(user.player_name || 'Guest', 220, 110);

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText(`Rating: ${user.rating || 0}`, 220, 160);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillText('More Stats Coming Soon...', 100, 400);
    }

    return canvas.toBuffer('image/png');
}
