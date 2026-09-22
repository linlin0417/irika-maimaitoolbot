import cron from 'node-cron';
import { AttachmentBuilder } from 'discord.js';
import type { Client, TextChannel } from 'discord.js';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { getSettings } from './settings.js';

export function startAutoBackup(client: Client) {
    // 每天 0 點和 12 點執行
    cron.schedule('0 0,12 * * *', async () => {
        console.log('[AutoBackup] 正在執行自動備份...');
        
        try {
            const settings = getSettings();
            const channelId = settings.backup?.channelId;

            if (!channelId) {
                console.warn('[AutoBackup] 尚未設定備份頻道 ID，略過自動備份。請使用 /setting 指令設定。');
                return;
            }

            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                console.warn(`[AutoBackup] 找不到指定的備份頻道 (${channelId})，或該頻道無法傳送訊息。`);
                return;
            }

            const dbPath = path.resolve(process.cwd(), 'data/maimai.db');
            if (!fs.existsSync(dbPath)) {
                console.warn('[AutoBackup] 找不到資料庫檔案，略過備份。');
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const zipPath = path.resolve(process.cwd(), `data/backup_${timestamp}.zip`);

            const zip = new AdmZip();
            zip.addLocalFile(dbPath);
            
            // 也可以將 SQLite 的 WAL 檔案一併打包（如果存在），以確保資料完整性
            const walPath = `${dbPath}-wal`;
            const shmPath = `${dbPath}-shm`;
            if (fs.existsSync(walPath)) zip.addLocalFile(walPath);
            if (fs.existsSync(shmPath)) zip.addLocalFile(shmPath);

            zip.writeZip(zipPath);

            const attachment = new AttachmentBuilder(zipPath);
            
            await (channel as TextChannel).send({
                content: `📅 自動備份完成 - ${new Date().toLocaleString()}`,
                files: [attachment]
            });

            console.log('[AutoBackup] 自動備份已發送至指定頻道。');

            // 刪除暫存的 zip 檔案
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
            }
        } catch (error) {
            console.error('[AutoBackup] 自動備份發生錯誤:', error);
        }
    });
}
