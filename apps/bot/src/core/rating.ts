export function getRank(achievement: number): string {
    if (achievement >= 100.5) return 'SSS+';
    if (achievement >= 100.0) return 'SSS';
    if (achievement >= 99.5) return 'SS+';
    if (achievement >= 99.0) return 'SS';
    if (achievement >= 98.0) return 'S+';
    if (achievement >= 97.0) return 'S';
    if (achievement >= 94.0) return 'AAA';
    if (achievement >= 90.0) return 'AA';
    if (achievement >= 80.0) return 'A';
    if (achievement >= 75.0) return 'BBB';
    if (achievement >= 70.0) return 'BB';
    if (achievement >= 60.0) return 'B';
    if (achievement >= 50.0) return 'C';
    return 'D';
}

export function getMultiplier(achievement: number): number {
    if (achievement >= 100.5) return 22.4;
    if (achievement >= 100.0) return 21.6;
    if (achievement >= 99.5) return 21.1;
    if (achievement >= 99.0) return 20.8;
    if (achievement >= 98.0) return 20.3;
    if (achievement >= 97.0) return 20.0;
    if (achievement >= 94.0) return 16.8;
    if (achievement >= 90.0) return 15.2;
    if (achievement >= 80.0) return 13.6;
    if (achievement >= 75.0) return 12.0;
    if (achievement >= 70.0) return 9.6;
    if (achievement >= 60.0) return 8.0;
    if (achievement >= 50.0) return 6.4;
    return 0.0;
}

export function calculateRating(constant: number, achievement: number): number {
    const multiplier = getMultiplier(achievement);
    // 計算時達成率最高採計到 100.5%
    const effectiveAchievement = Math.min(100.5, achievement);
    return Math.floor(constant * (effectiveAchievement / 100) * multiplier);
}
