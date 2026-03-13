/**
 * Payload normalization utilities for handling common LLM input mistakes.
 * Coerces string representations to proper types.
 */

/** Coerce string "true"/"false" to boolean. */
export function coerceBool(val: any): boolean | undefined {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
        const lower = val.toLowerCase().trim();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
    }
    if (typeof val === 'number') return val !== 0;
    return undefined;
}

/** Coerce string numbers to integer. */
export function coerceInt(val: any): number | undefined {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'number') return Math.floor(val);
    if (typeof val === 'string') {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) return parsed;
    }
    return undefined;
}

/** Coerce string numbers to float. */
export function coerceFloat(val: any): number | undefined {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) return parsed;
    }
    return undefined;
}

/** Parse JSON string payload. Returns parsed object or original value. */
export function parseJsonPayload(val: any): any {
    if (val === undefined || val === null) return val;
    if (typeof val !== 'string') return val;
    if (val === '[object Object]' || val === 'undefined') return undefined;
    try {
        return JSON.parse(val);
    } catch {
        return val;
    }
}

/** Normalize Vec3-like input: accepts {x,y,z}, [x,y,z], or JSON string. Missing fields default to 0. */
export function normalizeVec3(val: any): { x: number; y: number; z: number } | undefined {
    if (!val) return undefined;
    const parsed = parseJsonPayload(val);
    if (Array.isArray(parsed) && parsed.length >= 1) {
        return {
            x: Number(parsed[0] ?? 0),
            y: Number(parsed[1] ?? 0),
            z: Number(parsed[2] ?? 0)
        };
    }
    if (parsed && typeof parsed === 'object' && ('x' in parsed || 'y' in parsed || 'z' in parsed)) {
        return {
            x: Number(parsed.x ?? 0),
            y: Number(parsed.y ?? 0),
            z: Number(parsed.z ?? 0)
        };
    }
    return undefined;
}

/** Normalize Vec4-like input for colors: accepts {r,g,b,a}, [r,g,b,a], or JSON string. Missing fields default to 0 (w defaults to 1). */
export function normalizeVec4(val: any): { x: number; y: number; z: number; w: number } | undefined {
    if (!val) return undefined;
    const parsed = parseJsonPayload(val);
    if (Array.isArray(parsed) && parsed.length >= 1) {
        return {
            x: Number(parsed[0] ?? 0),
            y: Number(parsed[1] ?? 0),
            z: Number(parsed[2] ?? 0),
            w: Number(parsed[3] ?? 1)
        };
    }
    if (parsed && typeof parsed === 'object') {
        if ('r' in parsed || 'g' in parsed || 'b' in parsed) {
            return {
                x: Number(parsed.r ?? 0),
                y: Number(parsed.g ?? 0),
                z: Number(parsed.b ?? 0),
                w: Number(parsed.a ?? 1)
            };
        }
        if ('x' in parsed || 'y' in parsed || 'z' in parsed) {
            return {
                x: Number(parsed.x ?? 0),
                y: Number(parsed.y ?? 0),
                z: Number(parsed.z ?? 0),
                w: Number(parsed.w ?? 1)
            };
        }
    }
    return undefined;
}

/** Normalize properties dict. Handles JSON strings, nested objects. */
export function normalizeProperties(val: any): Record<string, any> | undefined {
    if (!val) return undefined;
    const parsed = parseJsonPayload(val);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return undefined;
}

/** Ensure value is an array of strings. Handles single string input. */
export function normalizeStringArray(val: any): string[] | undefined {
    if (!val) return undefined;
    if (typeof val === 'string') return [val];
    if (Array.isArray(val)) return val.map(String);
    return undefined;
}
