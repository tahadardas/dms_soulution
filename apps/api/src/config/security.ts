const DEFAULT_ACCESS_SECRET = 'super-secret-dev-key-change-in-prod';
const DEFAULT_REFRESH_SECRET = 'super-refresh-dev-key-change-in-prod';

export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

function requireProductionSecret(name: string, value: string | undefined, defaultValue: string): string {
    if (isProduction() && (!value || value === defaultValue)) {
        throw new Error(`${name} must be set to a strong non-default value in production.`);
    }
    return value || defaultValue;
}

export function getJwtSecret(): string {
    return requireProductionSecret('JWT_SECRET', process.env.JWT_SECRET, DEFAULT_ACCESS_SECRET);
}

export function getRefreshSecret(): string {
    return requireProductionSecret('REFRESH_SECRET', process.env.REFRESH_SECRET, DEFAULT_REFRESH_SECRET);
}

export function getCorsOrigins(): boolean | string[] {
    const isDesktop = process.env.DMS_DESKTOP === 'true';
    if (isDesktop) return true;

    const raw = process.env.DMS_CORS_ORIGINS;
    if (!raw) {
        if (isProduction()) {
            throw new Error('DMS_CORS_ORIGINS must be set in production.');
        }
        return true;
    }

    const origins = raw
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);

    if (isProduction() && origins.includes('*')) {
        throw new Error('DMS_CORS_ORIGINS cannot contain * in production.');
    }

    return origins.includes('*') ? true : origins;
}

