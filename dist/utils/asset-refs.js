"use strict";
/**
 * Extract asset UUIDs out of a Cocos Creator editor property dump.
 *
 * Component dumps nest arbitrarily: a property is `{ name, value, type }`, CCClass groups
 * hold another property map under `value`, and array properties describe their element
 * type under `elementTypeData`.
 *
 * Harvesting is deliberately conservative — a uuid is collected only from a descriptor the
 * dump explicitly types as an asset. Node and component references carry uuids too, but
 * those are scene-local and resolve against nothing in the asset DB, so treating them as
 * asset references would make a missing-asset scan report false positives.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectAssetUuids = collectAssetUuids;
const ASSET_TYPES = new Set([
    'cc.Asset', 'cc.SpriteFrame', 'cc.SpriteAtlas', 'cc.Texture2D', 'cc.TextureCube',
    'cc.RenderTexture', 'cc.Material', 'cc.EffectAsset', 'cc.Mesh', 'cc.Prefab',
    'cc.SceneAsset', 'cc.AnimationClip', 'cc.AudioClip', 'cc.VideoClip',
    'cc.Font', 'cc.TTFFont', 'cc.BitmapFont', 'cc.LabelAtlas',
    'cc.JsonAsset', 'cc.TextAsset', 'cc.BufferAsset', 'cc.PhysicsMaterial',
    'cc.ParticleAsset', 'cc.TiledMapAsset', 'cc.Skeleton',
    'sp.SkeletonData', 'dragonBones.DragonBonesAsset', 'dragonBones.DragonBonesAtlasAsset',
]);
const MAX_DEPTH = 32;
function collectAssetUuids(dump) {
    const found = new Set();
    walk(dump, found, new Set(), 0);
    return [...found];
}
function walk(node, found, seen, depth) {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH || seen.has(node))
        return;
    seen.add(node);
    if (Array.isArray(node)) {
        for (const item of node)
            walk(item, found, seen, depth + 1);
        return;
    }
    if (isAssetDescriptor(node)) {
        harvest(node.value, found);
        return;
    }
    for (const child of Object.values(node))
        walk(child, found, seen, depth + 1);
}
function isAssetDescriptor(node) {
    var _a;
    if (typeof node.type === 'string' && ASSET_TYPES.has(node.type))
        return true;
    if (typeof ((_a = node.elementTypeData) === null || _a === void 0 ? void 0 : _a.type) === 'string' && ASSET_TYPES.has(node.elementTypeData.type))
        return true;
    return Array.isArray(node.extends) && node.extends.includes('cc.Asset');
}
function harvest(value, found) {
    if (!value || typeof value !== 'object')
        return;
    if (Array.isArray(value)) {
        for (const item of value)
            harvest(item, found);
        return;
    }
    for (const key of ['uuid', '__uuid__']) {
        const uuid = value[key];
        if (typeof uuid === 'string' && uuid.length > 0)
            found.add(uuid);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtcmVmcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS91dGlscy9hc3NldC1yZWZzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7R0FXRzs7QUFjSCw4Q0FJQztBQWhCRCxNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUN4QixVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLGdCQUFnQjtJQUNoRixrQkFBa0IsRUFBRSxhQUFhLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLFdBQVc7SUFDM0UsZUFBZSxFQUFFLGtCQUFrQixFQUFFLGNBQWMsRUFBRSxjQUFjO0lBQ25FLFNBQVMsRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLGVBQWU7SUFDekQsY0FBYyxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxvQkFBb0I7SUFDdEUsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUUsYUFBYTtJQUNyRCxpQkFBaUIsRUFBRSw4QkFBOEIsRUFBRSxtQ0FBbUM7Q0FDekYsQ0FBQyxDQUFDO0FBRUgsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDO0FBRXJCLFNBQWdCLGlCQUFpQixDQUFDLElBQVM7SUFDdkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUNoQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2hDLE9BQU8sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDO0FBQ3RCLENBQUM7QUFFRCxTQUFTLElBQUksQ0FBQyxJQUFTLEVBQUUsS0FBa0IsRUFBRSxJQUFjLEVBQUUsS0FBYTtJQUN0RSxJQUFJLENBQUMsSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsSUFBSSxLQUFLLEdBQUcsU0FBUyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO1FBQUUsT0FBTztJQUNyRixJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRWYsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDdEIsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJO1lBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztRQUM1RCxPQUFPO0lBQ1gsQ0FBQztJQUVELElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUMxQixPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMzQixPQUFPO0lBQ1gsQ0FBQztJQUVELEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2pGLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLElBQVM7O0lBQ2hDLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7UUFBRSxPQUFPLElBQUksQ0FBQztJQUM3RSxJQUFJLE9BQU8sQ0FBQSxNQUFBLElBQUksQ0FBQyxlQUFlLDBDQUFFLElBQUksQ0FBQSxLQUFLLFFBQVEsSUFBSSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDOUcsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUM1RSxDQUFDO0FBRUQsU0FBUyxPQUFPLENBQUMsS0FBVSxFQUFFLEtBQWtCO0lBQzNDLElBQUksQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUTtRQUFFLE9BQU87SUFDaEQsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDdkIsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLO1lBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMvQyxPQUFPO0lBQ1gsQ0FBQztJQUNELEtBQUssTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQztRQUNyQyxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEIsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDO1lBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyRSxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRXh0cmFjdCBhc3NldCBVVUlEcyBvdXQgb2YgYSBDb2NvcyBDcmVhdG9yIGVkaXRvciBwcm9wZXJ0eSBkdW1wLlxuICpcbiAqIENvbXBvbmVudCBkdW1wcyBuZXN0IGFyYml0cmFyaWx5OiBhIHByb3BlcnR5IGlzIGB7IG5hbWUsIHZhbHVlLCB0eXBlIH1gLCBDQ0NsYXNzIGdyb3Vwc1xuICogaG9sZCBhbm90aGVyIHByb3BlcnR5IG1hcCB1bmRlciBgdmFsdWVgLCBhbmQgYXJyYXkgcHJvcGVydGllcyBkZXNjcmliZSB0aGVpciBlbGVtZW50XG4gKiB0eXBlIHVuZGVyIGBlbGVtZW50VHlwZURhdGFgLlxuICpcbiAqIEhhcnZlc3RpbmcgaXMgZGVsaWJlcmF0ZWx5IGNvbnNlcnZhdGl2ZSDigJQgYSB1dWlkIGlzIGNvbGxlY3RlZCBvbmx5IGZyb20gYSBkZXNjcmlwdG9yIHRoZVxuICogZHVtcCBleHBsaWNpdGx5IHR5cGVzIGFzIGFuIGFzc2V0LiBOb2RlIGFuZCBjb21wb25lbnQgcmVmZXJlbmNlcyBjYXJyeSB1dWlkcyB0b28sIGJ1dFxuICogdGhvc2UgYXJlIHNjZW5lLWxvY2FsIGFuZCByZXNvbHZlIGFnYWluc3Qgbm90aGluZyBpbiB0aGUgYXNzZXQgREIsIHNvIHRyZWF0aW5nIHRoZW0gYXNcbiAqIGFzc2V0IHJlZmVyZW5jZXMgd291bGQgbWFrZSBhIG1pc3NpbmctYXNzZXQgc2NhbiByZXBvcnQgZmFsc2UgcG9zaXRpdmVzLlxuICovXG5cbmNvbnN0IEFTU0VUX1RZUEVTID0gbmV3IFNldChbXG4gICAgJ2NjLkFzc2V0JywgJ2NjLlNwcml0ZUZyYW1lJywgJ2NjLlNwcml0ZUF0bGFzJywgJ2NjLlRleHR1cmUyRCcsICdjYy5UZXh0dXJlQ3ViZScsXG4gICAgJ2NjLlJlbmRlclRleHR1cmUnLCAnY2MuTWF0ZXJpYWwnLCAnY2MuRWZmZWN0QXNzZXQnLCAnY2MuTWVzaCcsICdjYy5QcmVmYWInLFxuICAgICdjYy5TY2VuZUFzc2V0JywgJ2NjLkFuaW1hdGlvbkNsaXAnLCAnY2MuQXVkaW9DbGlwJywgJ2NjLlZpZGVvQ2xpcCcsXG4gICAgJ2NjLkZvbnQnLCAnY2MuVFRGRm9udCcsICdjYy5CaXRtYXBGb250JywgJ2NjLkxhYmVsQXRsYXMnLFxuICAgICdjYy5Kc29uQXNzZXQnLCAnY2MuVGV4dEFzc2V0JywgJ2NjLkJ1ZmZlckFzc2V0JywgJ2NjLlBoeXNpY3NNYXRlcmlhbCcsXG4gICAgJ2NjLlBhcnRpY2xlQXNzZXQnLCAnY2MuVGlsZWRNYXBBc3NldCcsICdjYy5Ta2VsZXRvbicsXG4gICAgJ3NwLlNrZWxldG9uRGF0YScsICdkcmFnb25Cb25lcy5EcmFnb25Cb25lc0Fzc2V0JywgJ2RyYWdvbkJvbmVzLkRyYWdvbkJvbmVzQXRsYXNBc3NldCcsXG5dKTtcblxuY29uc3QgTUFYX0RFUFRIID0gMzI7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb2xsZWN0QXNzZXRVdWlkcyhkdW1wOiBhbnkpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgZm91bmQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICB3YWxrKGR1bXAsIGZvdW5kLCBuZXcgU2V0KCksIDApO1xuICAgIHJldHVybiBbLi4uZm91bmRdO1xufVxuXG5mdW5jdGlvbiB3YWxrKG5vZGU6IGFueSwgZm91bmQ6IFNldDxzdHJpbmc+LCBzZWVuOiBTZXQ8YW55PiwgZGVwdGg6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICghbm9kZSB8fCB0eXBlb2Ygbm9kZSAhPT0gJ29iamVjdCcgfHwgZGVwdGggPiBNQVhfREVQVEggfHwgc2Vlbi5oYXMobm9kZSkpIHJldHVybjtcbiAgICBzZWVuLmFkZChub2RlKTtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KG5vZGUpKSB7XG4gICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBub2RlKSB3YWxrKGl0ZW0sIGZvdW5kLCBzZWVuLCBkZXB0aCArIDEpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzQXNzZXREZXNjcmlwdG9yKG5vZGUpKSB7XG4gICAgICAgIGhhcnZlc3Qobm9kZS52YWx1ZSwgZm91bmQpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiBPYmplY3QudmFsdWVzKG5vZGUpKSB3YWxrKGNoaWxkLCBmb3VuZCwgc2VlbiwgZGVwdGggKyAxKTtcbn1cblxuZnVuY3Rpb24gaXNBc3NldERlc2NyaXB0b3Iobm9kZTogYW55KTogYm9vbGVhbiB7XG4gICAgaWYgKHR5cGVvZiBub2RlLnR5cGUgPT09ICdzdHJpbmcnICYmIEFTU0VUX1RZUEVTLmhhcyhub2RlLnR5cGUpKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAodHlwZW9mIG5vZGUuZWxlbWVudFR5cGVEYXRhPy50eXBlID09PSAnc3RyaW5nJyAmJiBBU1NFVF9UWVBFUy5oYXMobm9kZS5lbGVtZW50VHlwZURhdGEudHlwZSkpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KG5vZGUuZXh0ZW5kcykgJiYgbm9kZS5leHRlbmRzLmluY2x1ZGVzKCdjYy5Bc3NldCcpO1xufVxuXG5mdW5jdGlvbiBoYXJ2ZXN0KHZhbHVlOiBhbnksIGZvdW5kOiBTZXQ8c3RyaW5nPik6IHZvaWQge1xuICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdmFsdWUpIGhhcnZlc3QoaXRlbSwgZm91bmQpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciAoY29uc3Qga2V5IG9mIFsndXVpZCcsICdfX3V1aWRfXyddKSB7XG4gICAgICAgIGNvbnN0IHV1aWQgPSB2YWx1ZVtrZXldO1xuICAgICAgICBpZiAodHlwZW9mIHV1aWQgPT09ICdzdHJpbmcnICYmIHV1aWQubGVuZ3RoID4gMCkgZm91bmQuYWRkKHV1aWQpO1xuICAgIH1cbn1cbiJdfQ==