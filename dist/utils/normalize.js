"use strict";
/**
 * Payload normalization utilities for handling common LLM input mistakes.
 * Coerces string representations to proper types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.coerceBool = coerceBool;
exports.coerceInt = coerceInt;
exports.coerceFloat = coerceFloat;
exports.parseJsonPayload = parseJsonPayload;
exports.normalizeVec3 = normalizeVec3;
exports.normalizeVec4 = normalizeVec4;
exports.normalizeProperties = normalizeProperties;
exports.normalizeStringArray = normalizeStringArray;
/** Coerce string "true"/"false" to boolean. */
function coerceBool(val) {
    if (val === undefined || val === null)
        return undefined;
    if (typeof val === 'boolean')
        return val;
    if (typeof val === 'string') {
        const lower = val.toLowerCase().trim();
        if (lower === 'true' || lower === '1' || lower === 'yes')
            return true;
        if (lower === 'false' || lower === '0' || lower === 'no')
            return false;
    }
    if (typeof val === 'number')
        return val !== 0;
    return undefined;
}
/** Coerce string numbers to integer. */
function coerceInt(val) {
    if (val === undefined || val === null)
        return undefined;
    if (typeof val === 'number')
        return Math.floor(val);
    if (typeof val === 'string') {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed))
            return parsed;
    }
    return undefined;
}
/** Coerce string numbers to float. */
function coerceFloat(val) {
    if (val === undefined || val === null)
        return undefined;
    if (typeof val === 'number')
        return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        if (!isNaN(parsed))
            return parsed;
    }
    return undefined;
}
/** Parse JSON string payload. Returns parsed object or original value. */
function parseJsonPayload(val) {
    if (val === undefined || val === null)
        return val;
    if (typeof val !== 'string')
        return val;
    if (val === '[object Object]' || val === 'undefined')
        return undefined;
    try {
        return JSON.parse(val);
    }
    catch (_a) {
        return val;
    }
}
/** Normalize Vec3-like input: accepts {x,y,z}, [x,y,z], or JSON string. Missing fields default to 0. */
function normalizeVec3(val) {
    var _a, _b, _c, _d, _e, _f;
    if (!val)
        return undefined;
    const parsed = parseJsonPayload(val);
    if (Array.isArray(parsed) && parsed.length >= 1) {
        return {
            x: Number((_a = parsed[0]) !== null && _a !== void 0 ? _a : 0),
            y: Number((_b = parsed[1]) !== null && _b !== void 0 ? _b : 0),
            z: Number((_c = parsed[2]) !== null && _c !== void 0 ? _c : 0)
        };
    }
    if (parsed && typeof parsed === 'object' && ('x' in parsed || 'y' in parsed || 'z' in parsed)) {
        return {
            x: Number((_d = parsed.x) !== null && _d !== void 0 ? _d : 0),
            y: Number((_e = parsed.y) !== null && _e !== void 0 ? _e : 0),
            z: Number((_f = parsed.z) !== null && _f !== void 0 ? _f : 0)
        };
    }
    return undefined;
}
/** Normalize Vec4-like input for colors: accepts {r,g,b,a}, [r,g,b,a], or JSON string. Missing fields default to 0 (w defaults to 1). */
function normalizeVec4(val) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    if (!val)
        return undefined;
    const parsed = parseJsonPayload(val);
    if (Array.isArray(parsed) && parsed.length >= 1) {
        return {
            x: Number((_a = parsed[0]) !== null && _a !== void 0 ? _a : 0),
            y: Number((_b = parsed[1]) !== null && _b !== void 0 ? _b : 0),
            z: Number((_c = parsed[2]) !== null && _c !== void 0 ? _c : 0),
            w: Number((_d = parsed[3]) !== null && _d !== void 0 ? _d : 1)
        };
    }
    if (parsed && typeof parsed === 'object') {
        if ('r' in parsed || 'g' in parsed || 'b' in parsed) {
            return {
                x: Number((_e = parsed.r) !== null && _e !== void 0 ? _e : 0),
                y: Number((_f = parsed.g) !== null && _f !== void 0 ? _f : 0),
                z: Number((_g = parsed.b) !== null && _g !== void 0 ? _g : 0),
                w: Number((_h = parsed.a) !== null && _h !== void 0 ? _h : 1)
            };
        }
        if ('x' in parsed || 'y' in parsed || 'z' in parsed) {
            return {
                x: Number((_j = parsed.x) !== null && _j !== void 0 ? _j : 0),
                y: Number((_k = parsed.y) !== null && _k !== void 0 ? _k : 0),
                z: Number((_l = parsed.z) !== null && _l !== void 0 ? _l : 0),
                w: Number((_m = parsed.w) !== null && _m !== void 0 ? _m : 1)
            };
        }
    }
    return undefined;
}
/** Normalize properties dict. Handles JSON strings, nested objects. */
function normalizeProperties(val) {
    if (!val)
        return undefined;
    const parsed = parseJsonPayload(val);
    if (typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed;
    return undefined;
}
/** Ensure value is an array of strings. Handles single string input. */
function normalizeStringArray(val) {
    if (!val)
        return undefined;
    if (typeof val === 'string')
        return [val];
    if (Array.isArray(val))
        return val.map(String);
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsaXplLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3V0aWxzL25vcm1hbGl6ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOztBQUdILGdDQVVDO0FBR0QsOEJBUUM7QUFHRCxrQ0FRQztBQUdELDRDQVNDO0FBR0Qsc0NBa0JDO0FBR0Qsc0NBOEJDO0FBR0Qsa0RBS0M7QUFHRCxvREFLQztBQW5IRCwrQ0FBK0M7QUFDL0MsU0FBZ0IsVUFBVSxDQUFDLEdBQVE7SUFDL0IsSUFBSSxHQUFHLEtBQUssU0FBUyxJQUFJLEdBQUcsS0FBSyxJQUFJO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDeEQsSUFBSSxPQUFPLEdBQUcsS0FBSyxTQUFTO1FBQUUsT0FBTyxHQUFHLENBQUM7SUFDekMsSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUMxQixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDdkMsSUFBSSxLQUFLLEtBQUssTUFBTSxJQUFJLEtBQUssS0FBSyxHQUFHLElBQUksS0FBSyxLQUFLLEtBQUs7WUFBRSxPQUFPLElBQUksQ0FBQztRQUN0RSxJQUFJLEtBQUssS0FBSyxPQUFPLElBQUksS0FBSyxLQUFLLEdBQUcsSUFBSSxLQUFLLEtBQUssSUFBSTtZQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzNFLENBQUM7SUFDRCxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVE7UUFBRSxPQUFPLEdBQUcsS0FBSyxDQUFDLENBQUM7SUFDOUMsT0FBTyxTQUFTLENBQUM7QUFDckIsQ0FBQztBQUVELHdDQUF3QztBQUN4QyxTQUFnQixTQUFTLENBQUMsR0FBUTtJQUM5QixJQUFJLEdBQUcsS0FBSyxTQUFTLElBQUksR0FBRyxLQUFLLElBQUk7UUFBRSxPQUFPLFNBQVMsQ0FBQztJQUN4RCxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVE7UUFBRSxP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bG9hZCBub3JtYWxpemF0aW9uIHV0aWxpdGllcyBmb3IgaGFuZGxpbmcgY29tbW9uIExMTSBpbnB1dCBtaXN0YWtlcy5cbiAqIENvZXJjZXMgc3RyaW5nIHJlcHJlc2VudGF0aW9ucyB0byBwcm9wZXIgdHlwZXMuXG4gKi9cblxuLyoqIENvZXJjZSBzdHJpbmcgXCJ0cnVlXCIvXCJmYWxzZVwiIHRvIGJvb2xlYW4uICovXG5leHBvcnQgZnVuY3Rpb24gY29lcmNlQm9vbCh2YWw6IGFueSk6IGJvb2xlYW4gfCB1bmRlZmluZWQge1xuICAgIGlmICh2YWwgPT09IHVuZGVmaW5lZCB8fCB2YWwgPT09IG51bGwpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdib29sZWFuJykgcmV0dXJuIHZhbDtcbiAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgY29uc3QgbG93ZXIgPSB2YWwudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICAgIGlmIChsb3dlciA9PT0gJ3RydWUnIHx8IGxvd2VyID09PSAnMScgfHwgbG93ZXIgPT09ICd5ZXMnKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgaWYgKGxvd2VyID09PSAnZmFsc2UnIHx8IGxvd2VyID09PSAnMCcgfHwgbG93ZXIgPT09ICdubycpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSByZXR1cm4gdmFsICE9PSAwO1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbi8qKiBDb2VyY2Ugc3RyaW5nIG51bWJlcnMgdG8gaW50ZWdlci4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb2VyY2VJbnQodmFsOiBhbnkpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuICAgIGlmICh2YWwgPT09IHVuZGVmaW5lZCB8fCB2YWwgPT09IG51bGwpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSByZXR1cm4gTWF0aC5mbG9vcih2YWwpO1xuICAgIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUludCh2YWwsIDEwKTtcbiAgICAgICAgaWYgKCFpc05hTihwYXJzZWQpKSByZXR1cm4gcGFyc2VkO1xuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vKiogQ29lcmNlIHN0cmluZyBudW1iZXJzIHRvIGZsb2F0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvZXJjZUZsb2F0KHZhbDogYW55KTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAodmFsID09PSB1bmRlZmluZWQgfHwgdmFsID09PSBudWxsKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykgcmV0dXJuIHZhbDtcbiAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VGbG9hdCh2YWwpO1xuICAgICAgICBpZiAoIWlzTmFOKHBhcnNlZCkpIHJldHVybiBwYXJzZWQ7XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbi8qKiBQYXJzZSBKU09OIHN0cmluZyBwYXlsb2FkLiBSZXR1cm5zIHBhcnNlZCBvYmplY3Qgb3Igb3JpZ2luYWwgdmFsdWUuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VKc29uUGF5bG9hZCh2YWw6IGFueSk6IGFueSB7XG4gICAgaWYgKHZhbCA9PT0gdW5kZWZpbmVkIHx8IHZhbCA9PT0gbnVsbCkgcmV0dXJuIHZhbDtcbiAgICBpZiAodHlwZW9mIHZhbCAhPT0gJ3N0cmluZycpIHJldHVybiB2YWw7XG4gICAgaWYgKHZhbCA9PT0gJ1tvYmplY3QgT2JqZWN0XScgfHwgdmFsID09PSAndW5kZWZpbmVkJykgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gSlNPTi5wYXJzZSh2YWwpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gdmFsO1xuICAgIH1cbn1cblxuLyoqIE5vcm1hbGl6ZSBWZWMzLWxpa2UgaW5wdXQ6IGFjY2VwdHMge3gseSx6fSwgW3gseSx6XSwgb3IgSlNPTiBzdHJpbmcuIE1pc3NpbmcgZmllbGRzIGRlZmF1bHQgdG8gMC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVWZWMzKHZhbDogYW55KTogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyIH0gfCB1bmRlZmluZWQge1xuICAgIGlmICghdmFsKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsKTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQpICYmIHBhcnNlZC5sZW5ndGggPj0gMSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogTnVtYmVyKHBhcnNlZFswXSA/PyAwKSxcbiAgICAgICAgICAgIHk6IE51bWJlcihwYXJzZWRbMV0gPz8gMCksXG4gICAgICAgICAgICB6OiBOdW1iZXIocGFyc2VkWzJdID8/IDApXG4gICAgICAgIH07XG4gICAgfVxuICAgIGlmIChwYXJzZWQgJiYgdHlwZW9mIHBhcnNlZCA9PT0gJ29iamVjdCcgJiYgKCd4JyBpbiBwYXJzZWQgfHwgJ3knIGluIHBhcnNlZCB8fCAneicgaW4gcGFyc2VkKSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogTnVtYmVyKHBhcnNlZC54ID8/IDApLFxuICAgICAgICAgICAgeTogTnVtYmVyKHBhcnNlZC55ID8/IDApLFxuICAgICAgICAgICAgejogTnVtYmVyKHBhcnNlZC56ID8/IDApXG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbi8qKiBOb3JtYWxpemUgVmVjNC1saWtlIGlucHV0IGZvciBjb2xvcnM6IGFjY2VwdHMge3IsZyxiLGF9LCBbcixnLGIsYV0sIG9yIEpTT04gc3RyaW5nLiBNaXNzaW5nIGZpZWxkcyBkZWZhdWx0IHRvIDAgKHcgZGVmYXVsdHMgdG8gMSkuICovXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplVmVjNCh2YWw6IGFueSk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlcjsgdzogbnVtYmVyIH0gfCB1bmRlZmluZWQge1xuICAgIGlmICghdmFsKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsKTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQpICYmIHBhcnNlZC5sZW5ndGggPj0gMSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogTnVtYmVyKHBhcnNlZFswXSA/PyAwKSxcbiAgICAgICAgICAgIHk6IE51bWJlcihwYXJzZWRbMV0gPz8gMCksXG4gICAgICAgICAgICB6OiBOdW1iZXIocGFyc2VkWzJdID8/IDApLFxuICAgICAgICAgICAgdzogTnVtYmVyKHBhcnNlZFszXSA/PyAxKVxuICAgICAgICB9O1xuICAgIH1cbiAgICBpZiAocGFyc2VkICYmIHR5cGVvZiBwYXJzZWQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmICgncicgaW4gcGFyc2VkIHx8ICdnJyBpbiBwYXJzZWQgfHwgJ2InIGluIHBhcnNlZCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB4OiBOdW1iZXIocGFyc2VkLnIgPz8gMCksXG4gICAgICAgICAgICAgICAgeTogTnVtYmVyKHBhcnNlZC5nID8/IDApLFxuICAgICAgICAgICAgICAgIHo6IE51bWJlcihwYXJzZWQuYiA/PyAwKSxcbiAgICAgICAgICAgICAgICB3OiBOdW1iZXIocGFyc2VkLmEgPz8gMSlcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCd4JyBpbiBwYXJzZWQgfHwgJ3knIGluIHBhcnNlZCB8fCAneicgaW4gcGFyc2VkKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHg6IE51bWJlcihwYXJzZWQueCA/PyAwKSxcbiAgICAgICAgICAgICAgICB5OiBOdW1iZXIocGFyc2VkLnkgPz8gMCksXG4gICAgICAgICAgICAgICAgejogTnVtYmVyKHBhcnNlZC56ID8/IDApLFxuICAgICAgICAgICAgICAgIHc6IE51bWJlcihwYXJzZWQudyA/PyAxKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vKiogTm9ybWFsaXplIHByb3BlcnRpZXMgZGljdC4gSGFuZGxlcyBKU09OIHN0cmluZ3MsIG5lc3RlZCBvYmplY3RzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVByb3BlcnRpZXModmFsOiBhbnkpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoIXZhbCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbCk7XG4gICAgaWYgKHR5cGVvZiBwYXJzZWQgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHBhcnNlZCkpIHJldHVybiBwYXJzZWQ7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuLyoqIEVuc3VyZSB2YWx1ZSBpcyBhbiBhcnJheSBvZiBzdHJpbmdzLiBIYW5kbGVzIHNpbmdsZSBzdHJpbmcgaW5wdXQuICovXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplU3RyaW5nQXJyYXkodmFsOiBhbnkpOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKCF2YWwpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSByZXR1cm4gW3ZhbF07XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsKSkgcmV0dXJuIHZhbC5tYXAoU3RyaW5nKTtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xufVxuIl19