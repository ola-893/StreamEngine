const MIST_PER_SUI = 1_000_000_000;

export function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function ratePerSecondToMist(ratePerSecond: number | string): number {
    const parsed = Number(ratePerSecond);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed < 1 ? parsed * MIST_PER_SUI : parsed);
}
