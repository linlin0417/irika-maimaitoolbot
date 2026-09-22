import { getSettings, saveSettings } from '../src/core/settings.js';
import { execute as executeSetting } from '../src/discord/commands/setting.js';
import { execute as executeBackup } from '../src/discord/commands/backup.js';
import fs from 'fs';
import path from 'path';

async function runTests() {
    console.log('--- 測試 1: Settings 讀寫 ---');
    const settings = getSettings();
    console.log('初始設定:', settings);
    settings.backup = { channelId: '999999999' };
    saveSettings(settings);
    console.log('修改後設定:', getSettings());
    
    // 恢復
    settings.backup.channelId = '';
    saveSettings(settings);

    console.log('\n--- 測試 2: /setting 指令邏輯 ---');
    let replyMsg = '';
    const mockInteractionSetting = {
        user: { id: '1031852521993543711' }, // Admin
        options: {
            getString: (name: string) => {
                if (name === 'category') return 'backup';
                if (name === 'parameter') return 'channelId';
                if (name === 'content') return '1234567890';
                return null;
            }
        },
        reply: async (msg: any) => { replyMsg = msg.content; console.log('Mock Reply:', msg); }
    } as any;
    
    await executeSetting(mockInteractionSetting);
    console.log('設定後讀取檔案確認:', getSettings().backup.channelId === '1234567890' ? '成功' : '失敗');

    console.log('\n--- 測試 3: /backup 指令邏輯 ---');
    const mockInteractionBackup = {
        user: { 
            id: '1031852521993543711', 
            username: 'TestAdmin'
        },
        options: {
            getUser: (name: string) => null // 不指定目標，自己備份
        },
        deferReply: async (opts: any) => { console.log('Mock deferReply:', opts); },
        editReply: async (msg: any) => { 
            if (typeof msg === 'string') {
                console.log('Mock editReply:', msg);
            } else {
                console.log('Mock editReply 寄送成功，包含檔案數量:', msg.files?.length);
            }
        }
    } as any;

    await executeBackup(mockInteractionBackup);

    console.log('\n--- 測試 4: 測試自動備份的 ZIP 打包邏輯 ---');
    try {
        const AdmZip = (await import('adm-zip')).default;
        const dbPath = path.resolve(process.cwd(), 'data/maimai.db');
        if (fs.existsSync(dbPath)) {
            const zip = new AdmZip();
            zip.addLocalFile(dbPath);
            const zipPath = path.resolve(process.cwd(), 'data/test_backup.zip');
            zip.writeZip(zipPath);
            console.log('自動備份 ZIP 建立成功:', fs.existsSync(zipPath));
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); // 清除測試檔
        } else {
            console.log('找不到 maimai.db，略過 ZIP 測試');
        }
    } catch (e) {
        console.error('ZIP 測試失敗:', e);
    }
}

runTests().then(() => console.log('測試完成'));
