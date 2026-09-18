const fs = require('fs');
const path = require('path');

function patchMaiKit() {
    const targetPath = path.resolve(__dirname, '../node_modules/@mai-kit/draw/dist/index.js');
    if (!fs.existsSync(targetPath)) {
        console.warn('Cannot find @mai-kit/draw index.js, skipping patch.');
        return;
    }

    let content = fs.readFileSync(targetPath, 'utf8');

    // Replace Simplified Chinese with Traditional Chinese
    const replacements = {
        '旧曲': '舊曲',
        '总分': '總分',
        '生成于': '生成於',
        '分布': '分佈',
        '谱面倾向': '譜面傾向',
        '个人数据': '個人數據',
        '平均达成率': '平均達成率',
        '数量': '數量',
        '最高 Rating': '最高 Rating',
        '最高 DX 分': '最高 DX 分',
        '定数分布': '定數分佈',
        'RATING 分布': 'RATING 分佈',
        '及以下': '及以下',
        '候选成绩': '候選成績',
        '数据源提供时': '資料源提供時',
        '加分推荐': '加分推薦'
    };

    let patched = false;
    for (const [simp, trad] of Object.entries(replacements)) {
        // We use split and join to replace all occurrences efficiently
        const newContent = content.split(simp).join(trad);
        if (newContent !== content) {
            patched = true;
        }
        content = newContent;
    }

    if (patched) {
        fs.writeFileSync(targetPath, content, 'utf8');
        console.log('[Patch] Successfully patched @mai-kit/draw to Traditional Chinese.');
    } else {
        console.log('[Patch] @mai-kit/draw is already patched or strings not found.');
    }
}

patchMaiKit();
