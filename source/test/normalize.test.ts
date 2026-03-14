import {
    coerceBool,
    coerceInt,
    coerceFloat,
    parseJsonPayload,
    normalizeVec3,
    normalizeVec4,
    normalizeProperties,
    normalizeStringArray,
} from '../utils/normalize';

describe('coerceBool', () => {
    it('passes through booleans', () => {
        expect(coerceBool(true)).toBe(true);
        expect(coerceBool(false)).toBe(false);
    });
    it('converts truthy strings', () => {
        expect(coerceBool('true')).toBe(true);
        expect(coerceBool('TRUE')).toBe(true);
        expect(coerceBool('1')).toBe(true);
        expect(coerceBool('yes')).toBe(true);
    });
    it('converts falsy strings', () => {
        expect(coerceBool('false')).toBe(false);
        expect(coerceBool('0')).toBe(false);
        expect(coerceBool('no')).toBe(false);
    });
    it('returns undefined for null/undefined', () => {
        expect(coerceBool(null)).toBeUndefined();
        expect(coerceBool(undefined)).toBeUndefined();
    });
    it('converts numbers', () => {
        expect(coerceBool(1)).toBe(true);
        expect(coerceBool(0)).toBe(false);
    });
});

describe('coerceInt', () => {
    it('floors floats', () => {
        expect(coerceInt(3.9)).toBe(3);
    });
    it('parses string integers', () => {
        expect(coerceInt('42')).toBe(42);
    });
    it('returns undefined for non-numeric strings', () => {
        expect(coerceInt('abc')).toBeUndefined();
    });
    it('returns undefined for null/undefined', () => {
        expect(coerceInt(null)).toBeUndefined();
        expect(coerceInt(undefined)).toBeUndefined();
    });
});

describe('coerceFloat', () => {
    it('passes through numbers', () => {
        expect(coerceFloat(1.5)).toBe(1.5);
    });
    it('parses string floats', () => {
        expect(coerceFloat('3.14')).toBeCloseTo(3.14);
    });
    it('returns undefined for invalid strings', () => {
        expect(coerceFloat('abc')).toBeUndefined();
    });
});

describe('parseJsonPayload', () => {
    it('parses valid JSON strings', () => {
        expect(parseJsonPayload('{"x":1}')).toEqual({ x: 1 });
    });
    it('returns original value for non-strings', () => {
        expect(parseJsonPayload({ x: 1 })).toEqual({ x: 1 });
    });
    it('returns undefined for sentinel strings', () => {
        expect(parseJsonPayload('[object Object]')).toBeUndefined();
        expect(parseJsonPayload('undefined')).toBeUndefined();
    });
    it('returns string as-is on parse failure', () => {
        expect(parseJsonPayload('not-json')).toBe('not-json');
    });
    it('returns null/undefined for null/undefined input', () => {
        expect(parseJsonPayload(null)).toBeNull();
        expect(parseJsonPayload(undefined)).toBeUndefined();
    });
});

describe('normalizeVec3', () => {
    it('handles full object', () => {
        expect(normalizeVec3({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
    });
    it('defaults missing fields to 0', () => {
        expect(normalizeVec3({ x: 5 })).toEqual({ x: 5, y: 0, z: 0 });
    });
    it('handles array input', () => {
        expect(normalizeVec3([1, 2, 3])).toEqual({ x: 1, y: 2, z: 3 });
    });
    it('handles partial array', () => {
        expect(normalizeVec3([7])).toEqual({ x: 7, y: 0, z: 0 });
    });
    it('handles JSON string input', () => {
        expect(normalizeVec3('{"x":1,"y":2,"z":3}')).toEqual({ x: 1, y: 2, z: 3 });
    });
    it('returns undefined for null/undefined/empty', () => {
        expect(normalizeVec3(null)).toBeUndefined();
        expect(normalizeVec3(undefined)).toBeUndefined();
        expect(normalizeVec3('')).toBeUndefined();
    });
    it('returns undefined for plain scalars', () => {
        expect(normalizeVec3(42)).toBeUndefined();
    });
    it('coerces string numbers in object', () => {
        const result = normalizeVec3({ x: '1', y: '2', z: '3' });
        expect(result).toEqual({ x: 1, y: 2, z: 3 });
    });
});

describe('normalizeVec4', () => {
    it('handles xyzw object', () => {
        expect(normalizeVec4({ x: 1, y: 2, z: 3, w: 4 })).toEqual({ x: 1, y: 2, z: 3, w: 4 });
    });
    it('handles rgba object mapping to xyzw', () => {
        expect(normalizeVec4({ r: 1, g: 2, b: 3, a: 0.5 })).toEqual({ x: 1, y: 2, z: 3, w: 0.5 });
    });
    it('defaults w to 1 when missing', () => {
        expect(normalizeVec4({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3, w: 1 });
    });
    it('handles array input with w default 1', () => {
        expect(normalizeVec4([1, 2, 3])).toEqual({ x: 1, y: 2, z: 3, w: 1 });
    });
    it('returns undefined for null/undefined', () => {
        expect(normalizeVec4(null)).toBeUndefined();
        expect(normalizeVec4(undefined)).toBeUndefined();
    });
});

describe('normalizeProperties', () => {
    it('returns object as-is', () => {
        expect(normalizeProperties({ a: 1 })).toEqual({ a: 1 });
    });
    it('parses JSON string', () => {
        expect(normalizeProperties('{"key":"val"}')).toEqual({ key: 'val' });
    });
    it('returns undefined for arrays', () => {
        expect(normalizeProperties([1, 2])).toBeUndefined();
    });
    it('returns undefined for null', () => {
        expect(normalizeProperties(null)).toBeUndefined();
    });
});

describe('normalizeStringArray', () => {
    it('wraps single string in array', () => {
        expect(normalizeStringArray('foo')).toEqual(['foo']);
    });
    it('passes through string arrays', () => {
        expect(normalizeStringArray(['a', 'b'])).toEqual(['a', 'b']);
    });
    it('converts non-string array elements to strings', () => {
        expect(normalizeStringArray([1, 2])).toEqual(['1', '2']);
    });
    it('returns undefined for null/undefined', () => {
        expect(normalizeStringArray(null)).toBeUndefined();
        expect(normalizeStringArray(undefined)).toBeUndefined();
    });
});
