"use strict";
/**
 * Asset-db path resolution.
 *
 * `asset-db:query-asset-meta` resolves to an `IAssetMeta`
 * (`ver` / `importer` / `imported` / `uuid` / `files` / `subMetas` / `userData` /
 * `displayName` / `id` / `name`) — it carries NEITHER `url` NOR `file`. Reading
 * `meta.url` therefore yields `undefined`, and forwarding the coerced `''` to
 * `asset-db:query-path` makes Cocos Creator 3.8.7 reject the call with a bare
 * `parameter error` (#25).
 *
 * `asset-db:query-asset-info` is the message that carries `url`, `file`, `importer`
 * and `type`, so every on-disk path lookup must go through it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAsset = resolveAsset;
async function resolveAsset(urlOrUuid) {
    if (!urlOrUuid) {
        return { filePath: null, url: null, info: null, error: 'asset reference is empty' };
    }
    let info = null;
    try {
        info = await Editor.Message.request('asset-db', 'query-asset-info', urlOrUuid);
    }
    catch (err) {
        return {
            filePath: null, url: null, info: null,
            error: `query-asset-info rejected '${urlOrUuid}': ${(err === null || err === void 0 ? void 0 : err.message) || err}`
        };
    }
    if (!info) {
        return { filePath: null, url: null, info: null, error: `Asset not found in the asset DB: ${urlOrUuid}` };
    }
    const url = info.url || null;
    if (info.file)
        return { filePath: info.file, url, info, error: null };
    // Some importers omit `file`; fall back to an explicit path lookup on the url.
    if (url) {
        try {
            const filePath = await Editor.Message.request('asset-db', 'query-path', url);
            if (filePath)
                return { filePath, url, info, error: null };
        }
        catch (err) {
            return { filePath: null, url, info, error: `query-path rejected '${url}': ${(err === null || err === void 0 ? void 0 : err.message) || err}` };
        }
    }
    return { filePath: null, url, info, error: null };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtcGF0aC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS91dGlscy9hc3NldC1wYXRoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7O0dBWUc7O0FBZ0JILG9DQWdDQztBQWhDTSxLQUFLLFVBQVUsWUFBWSxDQUFDLFNBQWlCO0lBQ2hELElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNiLE9BQU8sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQztJQUN4RixDQUFDO0lBRUQsSUFBSSxJQUFJLEdBQVEsSUFBSSxDQUFDO0lBQ3JCLElBQUksQ0FBQztRQUNELElBQUksR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNuRixDQUFDO0lBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztRQUNoQixPQUFPO1lBQ0gsUUFBUSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO1lBQ3JDLEtBQUssRUFBRSw4QkFBOEIsU0FBUyxNQUFNLENBQUEsR0FBRyxhQUFILEdBQUcsdUJBQUgsR0FBRyxDQUFFLE9BQU8sS0FBSSxHQUFHLEVBQUU7U0FDNUUsQ0FBQztJQUNOLENBQUM7SUFDRCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDUixPQUFPLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLG9DQUFvQyxTQUFTLEVBQUUsRUFBRSxDQUFDO0lBQzdHLENBQUM7SUFFRCxNQUFNLEdBQUcsR0FBa0IsSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUM7SUFDNUMsSUFBSSxJQUFJLENBQUMsSUFBSTtRQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUV0RSwrRUFBK0U7SUFDL0UsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNOLElBQUksQ0FBQztZQUNELE1BQU0sUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxHQUFHLENBQWtCLENBQUM7WUFDOUYsSUFBSSxRQUFRO2dCQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDOUQsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsd0JBQXdCLEdBQUcsTUFBTSxDQUFBLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxPQUFPLEtBQUksR0FBRyxFQUFFLEVBQUUsQ0FBQztRQUN4RyxDQUFDO0lBQ0wsQ0FBQztJQUVELE9BQU8sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDO0FBQ3RELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFzc2V0LWRiIHBhdGggcmVzb2x1dGlvbi5cbiAqXG4gKiBgYXNzZXQtZGI6cXVlcnktYXNzZXQtbWV0YWAgcmVzb2x2ZXMgdG8gYW4gYElBc3NldE1ldGFgXG4gKiAoYHZlcmAgLyBgaW1wb3J0ZXJgIC8gYGltcG9ydGVkYCAvIGB1dWlkYCAvIGBmaWxlc2AgLyBgc3ViTWV0YXNgIC8gYHVzZXJEYXRhYCAvXG4gKiBgZGlzcGxheU5hbWVgIC8gYGlkYCAvIGBuYW1lYCkg4oCUIGl0IGNhcnJpZXMgTkVJVEhFUiBgdXJsYCBOT1IgYGZpbGVgLiBSZWFkaW5nXG4gKiBgbWV0YS51cmxgIHRoZXJlZm9yZSB5aWVsZHMgYHVuZGVmaW5lZGAsIGFuZCBmb3J3YXJkaW5nIHRoZSBjb2VyY2VkIGAnJ2AgdG9cbiAqIGBhc3NldC1kYjpxdWVyeS1wYXRoYCBtYWtlcyBDb2NvcyBDcmVhdG9yIDMuOC43IHJlamVjdCB0aGUgY2FsbCB3aXRoIGEgYmFyZVxuICogYHBhcmFtZXRlciBlcnJvcmAgKCMyNSkuXG4gKlxuICogYGFzc2V0LWRiOnF1ZXJ5LWFzc2V0LWluZm9gIGlzIHRoZSBtZXNzYWdlIHRoYXQgY2FycmllcyBgdXJsYCwgYGZpbGVgLCBgaW1wb3J0ZXJgXG4gKiBhbmQgYHR5cGVgLCBzbyBldmVyeSBvbi1kaXNrIHBhdGggbG9va3VwIG11c3QgZ28gdGhyb3VnaCBpdC5cbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlc29sdmVkQXNzZXQge1xuICAgIC8qKiBBYnNvbHV0ZSBwYXRoIG9uIGRpc2ssIG9yIG51bGwgd2hlbiBpdCBjb3VsZCBub3QgYmUgZGV0ZXJtaW5lZC4gKi9cbiAgICBmaWxlUGF0aDogc3RyaW5nIHwgbnVsbDtcbiAgICAvKiogYGRiOi8vYCB1cmwsIG9yIG51bGwgd2hlbiB1bmtub3duLiAqL1xuICAgIHVybDogc3RyaW5nIHwgbnVsbDtcbiAgICAvKiogUmF3IGBBc3NldEluZm9gIGZyb20gYHF1ZXJ5LWFzc2V0LWluZm9gLCBvciBudWxsIHdoZW4gdGhlIGFzc2V0IGlzIHVua25vd24uICovXG4gICAgaW5mbzogYW55IHwgbnVsbDtcbiAgICAvKipcbiAgICAgKiBOYW1lcyB0aGUgc3RhZ2UgdGhhdCBmYWlsZWQsIHNvIGNhbGxlcnMgc3VyZmFjZSB3aGljaCBzdGVwIHJlamVjdGVkIGluc3RlYWQgb2ZcbiAgICAgKiBjb2xsYXBzaW5nIGV2ZXJ5IGZhaWx1cmUgaW50byBvbmUgb3BhcXVlIG1lc3NhZ2UuXG4gICAgICovXG4gICAgZXJyb3I6IHN0cmluZyB8IG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXNvbHZlQXNzZXQodXJsT3JVdWlkOiBzdHJpbmcpOiBQcm9taXNlPFJlc29sdmVkQXNzZXQ+IHtcbiAgICBpZiAoIXVybE9yVXVpZCkge1xuICAgICAgICByZXR1cm4geyBmaWxlUGF0aDogbnVsbCwgdXJsOiBudWxsLCBpbmZvOiBudWxsLCBlcnJvcjogJ2Fzc2V0IHJlZmVyZW5jZSBpcyBlbXB0eScgfTtcbiAgICB9XG5cbiAgICBsZXQgaW5mbzogYW55ID0gbnVsbDtcbiAgICB0cnkge1xuICAgICAgICBpbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHVybE9yVXVpZCk7XG4gICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGZpbGVQYXRoOiBudWxsLCB1cmw6IG51bGwsIGluZm86IG51bGwsXG4gICAgICAgICAgICBlcnJvcjogYHF1ZXJ5LWFzc2V0LWluZm8gcmVqZWN0ZWQgJyR7dXJsT3JVdWlkfSc6ICR7ZXJyPy5tZXNzYWdlIHx8IGVycn1gXG4gICAgICAgIH07XG4gICAgfVxuICAgIGlmICghaW5mbykge1xuICAgICAgICByZXR1cm4geyBmaWxlUGF0aDogbnVsbCwgdXJsOiBudWxsLCBpbmZvOiBudWxsLCBlcnJvcjogYEFzc2V0IG5vdCBmb3VuZCBpbiB0aGUgYXNzZXQgREI6ICR7dXJsT3JVdWlkfWAgfTtcbiAgICB9XG5cbiAgICBjb25zdCB1cmw6IHN0cmluZyB8IG51bGwgPSBpbmZvLnVybCB8fCBudWxsO1xuICAgIGlmIChpbmZvLmZpbGUpIHJldHVybiB7IGZpbGVQYXRoOiBpbmZvLmZpbGUsIHVybCwgaW5mbywgZXJyb3I6IG51bGwgfTtcblxuICAgIC8vIFNvbWUgaW1wb3J0ZXJzIG9taXQgYGZpbGVgOyBmYWxsIGJhY2sgdG8gYW4gZXhwbGljaXQgcGF0aCBsb29rdXAgb24gdGhlIHVybC5cbiAgICBpZiAodXJsKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXBhdGgnLCB1cmwpIGFzIHN0cmluZyB8IG51bGw7XG4gICAgICAgICAgICBpZiAoZmlsZVBhdGgpIHJldHVybiB7IGZpbGVQYXRoLCB1cmwsIGluZm8sIGVycm9yOiBudWxsIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBmaWxlUGF0aDogbnVsbCwgdXJsLCBpbmZvLCBlcnJvcjogYHF1ZXJ5LXBhdGggcmVqZWN0ZWQgJyR7dXJsfSc6ICR7ZXJyPy5tZXNzYWdlIHx8IGVycn1gIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4geyBmaWxlUGF0aDogbnVsbCwgdXJsLCBpbmZvLCBlcnJvcjogbnVsbCB9O1xufVxuIl19