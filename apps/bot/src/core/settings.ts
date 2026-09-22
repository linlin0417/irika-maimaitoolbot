import fs from 'fs';
import path from 'path';

const settingsPath = path.resolve(process.cwd(), 'cfg/settings.json');

export function getSettings() {
    if (!fs.existsSync(settingsPath)) {
        const dir = path.dirname(settingsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const defaultSettings = {
            backup: {
                channelId: ""
            }
        };
        fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 4));
        return defaultSettings;
    }
    try {
        const content = fs.readFileSync(settingsPath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return { backup: { channelId: "" } };
    }
}

export function saveSettings(settings: any) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
}
