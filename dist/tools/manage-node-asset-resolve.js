"use strict";
/**
 * Resolve the uuid `scene:create-node` can actually instantiate (issue #117).
 *
 * A raw model asset (`.fbx` / `.gltf`) is not instantiable itself: Cocos 3.8 stores the
 * instantiable hierarchy as a sub-asset of the model with importer `gltf-scene`, addressed
 * `<model-uuid>@<subMetaId>`. Handing the model's own uuid to `create-node` returns a uuid and
 * `success`, but the node carries no mesh, children or components. This resolves the model uuid
 * to its `gltf-scene` sub-asset uuid, and refuses outright when the model has none, so an empty
 * node is never reported as an instantiated model.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInstantiableAssetUuid = resolveInstantiableAssetUuid;
/** Importers whose top-level asset must be redirected to its `gltf-scene` sub-asset. */
const MODEL_IMPORTERS = ['fbx', 'gltf'];
async function resolveInstantiableAssetUuid(assetUuid, knownInfo) {
    // A sub-asset address is already the instantiable form.
    if (!assetUuid || assetUuid.includes('@'))
        return { uuid: assetUuid };
    let info = knownInfo;
    if (!info) {
        try {
            info = await Editor.Message.request('asset-db', 'query-asset-info', assetUuid);
        }
        catch (_a) {
            return { uuid: assetUuid }; // advisory lookup: never block a create on it
        }
    }
    const importer = String((info === null || info === void 0 ? void 0 : info.importer) || '').toLowerCase();
    if (!MODEL_IMPORTERS.includes(importer))
        return { uuid: assetUuid, info };
    const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetUuid);
    const subMetas = (meta === null || meta === void 0 ? void 0 : meta.subMetas) || {};
    for (const [subId, sub] of Object.entries(subMetas)) {
        if ((sub === null || sub === void 0 ? void 0 : sub.importer) === 'gltf-scene') {
            return { uuid: sub.uuid || `${assetUuid}@${subId}`, resolvedFrom: assetUuid };
        }
    }
    throw new Error(`Asset '${assetUuid}' is a ${importer} model with no 'gltf-scene' sub-asset, so it cannot be instantiated. ` +
        `Re-import the asset (manage_asset reimport) and retry, or pass the '<uuid>@<subId>' of the sub-asset to instantiate.`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW5vZGUtYXNzZXQtcmVzb2x2ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2Utbm9kZS1hc3NldC1yZXNvbHZlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7O0dBU0c7O0FBYUgsb0VBMEJDO0FBckNELHdGQUF3RjtBQUN4RixNQUFNLGVBQWUsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztBQVVqQyxLQUFLLFVBQVUsNEJBQTRCLENBQUMsU0FBaUIsRUFBRSxTQUFlO0lBQ2pGLHdEQUF3RDtJQUN4RCxJQUFJLENBQUMsU0FBUyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDO1FBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQztJQUV0RSxJQUFJLElBQUksR0FBUSxTQUFTLENBQUM7SUFDMUIsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDO1lBQ0QsSUFBSSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGtCQUFrQixFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ25GLENBQUM7UUFBQyxXQUFNLENBQUM7WUFDTCxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsOENBQThDO1FBQzlFLENBQUM7SUFDTCxDQUFDO0lBQ0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLENBQUEsSUFBSSxhQUFKLElBQUksdUJBQUosSUFBSSxDQUFFLFFBQVEsS0FBSSxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUM1RCxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUM7UUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUUxRSxNQUFNLElBQUksR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUMxRixNQUFNLFFBQVEsR0FBd0IsQ0FBQSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsUUFBUSxLQUFJLEVBQUUsQ0FBQztJQUMzRCxLQUFLLE1BQU0sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1FBQ2xELElBQUksQ0FBQSxHQUFHLGFBQUgsR0FBRyx1QkFBSCxHQUFHLENBQUUsUUFBUSxNQUFLLFlBQVksRUFBRSxDQUFDO1lBQ2pDLE9BQU8sRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksSUFBSSxHQUFHLFNBQVMsSUFBSSxLQUFLLEVBQUUsRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLENBQUM7UUFDbEYsQ0FBQztJQUNMLENBQUM7SUFDRCxNQUFNLElBQUksS0FBSyxDQUNYLFVBQVUsU0FBUyxVQUFVLFFBQVEsdUVBQXVFO1FBQzVHLHNIQUFzSCxDQUN6SCxDQUFDO0FBQ04sQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmVzb2x2ZSB0aGUgdXVpZCBgc2NlbmU6Y3JlYXRlLW5vZGVgIGNhbiBhY3R1YWxseSBpbnN0YW50aWF0ZSAoaXNzdWUgIzExNykuXG4gKlxuICogQSByYXcgbW9kZWwgYXNzZXQgKGAuZmJ4YCAvIGAuZ2x0ZmApIGlzIG5vdCBpbnN0YW50aWFibGUgaXRzZWxmOiBDb2NvcyAzLjggc3RvcmVzIHRoZVxuICogaW5zdGFudGlhYmxlIGhpZXJhcmNoeSBhcyBhIHN1Yi1hc3NldCBvZiB0aGUgbW9kZWwgd2l0aCBpbXBvcnRlciBgZ2x0Zi1zY2VuZWAsIGFkZHJlc3NlZFxuICogYDxtb2RlbC11dWlkPkA8c3ViTWV0YUlkPmAuIEhhbmRpbmcgdGhlIG1vZGVsJ3Mgb3duIHV1aWQgdG8gYGNyZWF0ZS1ub2RlYCByZXR1cm5zIGEgdXVpZCBhbmRcbiAqIGBzdWNjZXNzYCwgYnV0IHRoZSBub2RlIGNhcnJpZXMgbm8gbWVzaCwgY2hpbGRyZW4gb3IgY29tcG9uZW50cy4gVGhpcyByZXNvbHZlcyB0aGUgbW9kZWwgdXVpZFxuICogdG8gaXRzIGBnbHRmLXNjZW5lYCBzdWItYXNzZXQgdXVpZCwgYW5kIHJlZnVzZXMgb3V0cmlnaHQgd2hlbiB0aGUgbW9kZWwgaGFzIG5vbmUsIHNvIGFuIGVtcHR5XG4gKiBub2RlIGlzIG5ldmVyIHJlcG9ydGVkIGFzIGFuIGluc3RhbnRpYXRlZCBtb2RlbC5cbiAqL1xuXG4vKiogSW1wb3J0ZXJzIHdob3NlIHRvcC1sZXZlbCBhc3NldCBtdXN0IGJlIHJlZGlyZWN0ZWQgdG8gaXRzIGBnbHRmLXNjZW5lYCBzdWItYXNzZXQuICovXG5jb25zdCBNT0RFTF9JTVBPUlRFUlMgPSBbJ2ZieCcsICdnbHRmJ107XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVzb2x2ZWRJbnN0YW50aWFibGVBc3NldCB7XG4gICAgdXVpZDogc3RyaW5nO1xuICAgIC8qKiBTZXQgd2hlbiB0aGUgaW5wdXQgd2FzIGEgbW9kZWwgYW5kIHdhcyByZWRpcmVjdGVkOiB0aGUgb3JpZ2luYWwgbW9kZWwgdXVpZC4gKi9cbiAgICByZXNvbHZlZEZyb20/OiBzdHJpbmc7XG4gICAgLyoqIFRoZSBgcXVlcnktYXNzZXQtaW5mb2AgcmVjb3JkIGZvciB0aGUgdXVpZCwgd2hlbiBvbmUgd2FzIHJlYWQg4oCUIGxldHMgdGhlIGNhbGxlciBza2lwIGEgc2Vjb25kIGxvb2t1cC4gKi9cbiAgICBpbmZvPzogYW55O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUluc3RhbnRpYWJsZUFzc2V0VXVpZChhc3NldFV1aWQ6IHN0cmluZywga25vd25JbmZvPzogYW55KTogUHJvbWlzZTxSZXNvbHZlZEluc3RhbnRpYWJsZUFzc2V0PiB7XG4gICAgLy8gQSBzdWItYXNzZXQgYWRkcmVzcyBpcyBhbHJlYWR5IHRoZSBpbnN0YW50aWFibGUgZm9ybS5cbiAgICBpZiAoIWFzc2V0VXVpZCB8fCBhc3NldFV1aWQuaW5jbHVkZXMoJ0AnKSkgcmV0dXJuIHsgdXVpZDogYXNzZXRVdWlkIH07XG5cbiAgICBsZXQgaW5mbzogYW55ID0ga25vd25JbmZvO1xuICAgIGlmICghaW5mbykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBhc3NldFV1aWQpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiB7IHV1aWQ6IGFzc2V0VXVpZCB9OyAvLyBhZHZpc29yeSBsb29rdXA6IG5ldmVyIGJsb2NrIGEgY3JlYXRlIG9uIGl0XG4gICAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgaW1wb3J0ZXIgPSBTdHJpbmcoaW5mbz8uaW1wb3J0ZXIgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKCFNT0RFTF9JTVBPUlRFUlMuaW5jbHVkZXMoaW1wb3J0ZXIpKSByZXR1cm4geyB1dWlkOiBhc3NldFV1aWQsIGluZm8gfTtcblxuICAgIGNvbnN0IG1ldGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LW1ldGEnLCBhc3NldFV1aWQpO1xuICAgIGNvbnN0IHN1Yk1ldGFzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0gbWV0YT8uc3ViTWV0YXMgfHwge307XG4gICAgZm9yIChjb25zdCBbc3ViSWQsIHN1Yl0gb2YgT2JqZWN0LmVudHJpZXMoc3ViTWV0YXMpKSB7XG4gICAgICAgIGlmIChzdWI/LmltcG9ydGVyID09PSAnZ2x0Zi1zY2VuZScpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHV1aWQ6IHN1Yi51dWlkIHx8IGAke2Fzc2V0VXVpZH1AJHtzdWJJZH1gLCByZXNvbHZlZEZyb206IGFzc2V0VXVpZCB9O1xuICAgICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEFzc2V0ICcke2Fzc2V0VXVpZH0nIGlzIGEgJHtpbXBvcnRlcn0gbW9kZWwgd2l0aCBubyAnZ2x0Zi1zY2VuZScgc3ViLWFzc2V0LCBzbyBpdCBjYW5ub3QgYmUgaW5zdGFudGlhdGVkLiBgICtcbiAgICAgICAgYFJlLWltcG9ydCB0aGUgYXNzZXQgKG1hbmFnZV9hc3NldCByZWltcG9ydCkgYW5kIHJldHJ5LCBvciBwYXNzIHRoZSAnPHV1aWQ+QDxzdWJJZD4nIG9mIHRoZSBzdWItYXNzZXQgdG8gaW5zdGFudGlhdGUuYFxuICAgICk7XG59XG4iXX0=