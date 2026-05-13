export const normalizeApiBase = (baseUrl: string) => {
    const trimmed = baseUrl.trim();
    if (!trimmed) return '/api';
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

export const buildApiUrl = (baseUrl: string, path: string) => {
    const base = normalizeApiBase(baseUrl);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
};

export const apiFetch = async <T>(
    baseUrl: string,
    path: string,
    options: RequestInit = {},
    token?: string | null
): Promise<T> => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
    }
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(buildApiUrl(baseUrl, path), {
        ...options,
        headers
    });

    if (!response.ok) {
        let message = response.statusText;
        try {
            const errorBody = await response.json();
            message = errorBody?.message || errorBody?.error || message;
        } catch {
            // ignore parse errors
        }
        const error = new Error(message) as Error & { status?: number };
        error.status = response.status;
        throw error;
    }

    if (response.status === 204) {
        return {} as T;
    }

    return response.json() as Promise<T>;
};
