"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageReferenceImage = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
class ManageReferenceImage extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_reference_image';
        this.description = 'Manage reference image overlays in the scene view. Actions: add, remove, switch, set_data, get_config, get_current, refresh, set_position, set_scale, set_opacity, list, clear_all.';
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'Action to perform',
                    enum: [
                        'add', 'remove', 'switch', 'set_data',
                        'get_config', 'get_current', 'refresh',
                        'set_position', 'set_scale', 'set_opacity',
                        'list', 'clear_all'
                    ]
                },
                paths: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of reference image absolute paths (add, remove)'
                },
                path: {
                    type: 'string',
                    description: 'Reference image absolute path (switch)'
                },
                sceneUUID: {
                    type: 'string',
                    description: 'Specific scene UUID (switch, optional)'
                },
                key: {
                    type: 'string',
                    description: 'Property key (set_data: path/x/y/sx/sy/opacity)',
                    enum: ['path', 'x', 'y', 'sx', 'sy', 'opacity']
                },
                value: {
                    description: 'Property value (set_data: path=string, x/y/sx/sy/opacity=number)'
                },
                x: {
                    type: 'number',
                    description: 'X offset (set_position)'
                },
                y: {
                    type: 'number',
                    description: 'Y offset (set_position)'
                },
                sx: {
                    type: 'number',
                    description: 'X scale 0.1-10 (set_scale)',
                    minimum: 0.1,
                    maximum: 10
                },
                sy: {
                    type: 'number',
                    description: 'Y scale 0.1-10 (set_scale)',
                    minimum: 0.1,
                    maximum: 10
                },
                opacity: {
                    type: 'number',
                    description: 'Opacity 0.0-1.0 (set_opacity)',
                    minimum: 0,
                    maximum: 1
                }
            },
            required: ['action']
        };
        this.actions = [
            'add', 'remove', 'switch', 'set_data',
            'get_config', 'get_current', 'refresh',
            'set_position', 'set_scale', 'set_opacity',
            'list', 'clear_all'
        ];
        this.actionHandlers = {
            add: (args) => this.add((0, normalize_1.normalizeStringArray)(args.paths) || args.paths),
            remove: (args) => this.remove((0, normalize_1.normalizeStringArray)(args.paths)),
            switch: (args) => this.switchImage(args.path, args.sceneUUID),
            set_data: (args) => this.setData(args.key, args.value),
            get_config: () => this.getConfig(),
            get_current: () => this.getCurrent(),
            refresh: () => this.refresh(),
            set_position: (args) => this.setPosition((0, normalize_1.coerceFloat)(args.x), (0, normalize_1.coerceFloat)(args.y)),
            set_scale: (args) => this.setScale((0, normalize_1.coerceFloat)(args.sx), (0, normalize_1.coerceFloat)(args.sy)),
            set_opacity: (args) => this.setOpacity((0, normalize_1.coerceFloat)(args.opacity)),
            list: () => this.list(),
            clear_all: () => this.clearAll()
        };
    }
    async add(paths) {
        if (!paths || paths.length === 0)
            return (0, types_1.errorResult)('paths is required for add');
        try {
            await Editor.Message.request('reference-image', 'add-image', paths);
            return (0, types_1.successResult)({ addedPaths: paths, count: paths.length }, `Added ${paths.length} reference image(s)`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async remove(paths) {
        try {
            await Editor.Message.request('reference-image', 'remove-image', paths);
            const message = paths && paths.length > 0
                ? `Removed ${paths.length} reference image(s)`
                : 'Removed current reference image';
            return (0, types_1.successResult)(null, message);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async switchImage(path, sceneUUID) {
        if (!path)
            return (0, types_1.errorResult)('path is required for switch');
        try {
            const args = sceneUUID ? [path, sceneUUID] : [path];
            await Editor.Message.request('reference-image', 'switch-image', ...args);
            return (0, types_1.successResult)({ path, sceneUUID }, `Switched to reference image: ${path}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async setData(key, value) {
        if (!key)
            return (0, types_1.errorResult)('key is required for set_data');
        if (value === undefined)
            return (0, types_1.errorResult)('value is required for set_data');
        try {
            await Editor.Message.request('reference-image', 'set-image-data', key, value);
            return (0, types_1.successResult)({ key, value }, `Reference image ${key} set to ${value}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async getConfig() {
        try {
            const config = await Editor.Message.request('reference-image', 'query-config');
            return (0, types_1.successResult)(config);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async getCurrent() {
        try {
            const current = await Editor.Message.request('reference-image', 'query-current');
            return (0, types_1.successResult)(current);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async refresh() {
        try {
            await Editor.Message.request('reference-image', 'refresh');
            return (0, types_1.successResult)(null, 'Reference image refreshed');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async setPosition(x, y) {
        if (x === undefined)
            return (0, types_1.errorResult)('x is required for set_position');
        if (y === undefined)
            return (0, types_1.errorResult)('y is required for set_position');
        try {
            await Editor.Message.request('reference-image', 'set-image-data', 'x', x);
            await Editor.Message.request('reference-image', 'set-image-data', 'y', y);
            return (0, types_1.successResult)({ x, y }, `Reference image position set to (${x}, ${y})`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async setScale(sx, sy) {
        if (sx === undefined)
            return (0, types_1.errorResult)('sx is required for set_scale');
        if (sy === undefined)
            return (0, types_1.errorResult)('sy is required for set_scale');
        try {
            await Editor.Message.request('reference-image', 'set-image-data', 'sx', sx);
            await Editor.Message.request('reference-image', 'set-image-data', 'sy', sy);
            return (0, types_1.successResult)({ sx, sy }, `Reference image scale set to (${sx}, ${sy})`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async setOpacity(opacity) {
        if (opacity === undefined)
            return (0, types_1.errorResult)('opacity is required for set_opacity');
        try {
            await Editor.Message.request('reference-image', 'set-image-data', 'opacity', opacity);
            return (0, types_1.successResult)({ opacity }, `Reference image opacity set to ${opacity}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async list() {
        try {
            const config = await Editor.Message.request('reference-image', 'query-config');
            const current = await Editor.Message.request('reference-image', 'query-current');
            return (0, types_1.successResult)({ config, current }, 'Reference image information retrieved');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async clearAll() {
        try {
            await Editor.Message.request('reference-image', 'remove-image');
            return (0, types_1.successResult)(null, 'All reference images cleared');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
}
exports.ManageReferenceImage = ManageReferenceImage;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXJlZmVyZW5jZS1pbWFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcmVmZXJlbmNlLWltYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFDeEUsa0RBQXVFO0FBRXZFLE1BQWEsb0JBQXFCLFNBQVEsaUNBQWM7SUFBeEQ7O1FBQ2EsU0FBSSxHQUFHLHdCQUF3QixDQUFDO1FBQ2hDLGdCQUFXLEdBQUcscUxBQXFMLENBQUM7UUFDcE0sZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1CQUFtQjtvQkFDaEMsSUFBSSxFQUFFO3dCQUNGLEtBQUssRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFVBQVU7d0JBQ3JDLFlBQVksRUFBRSxhQUFhLEVBQUUsU0FBUzt3QkFDdEMsY0FBYyxFQUFFLFdBQVcsRUFBRSxhQUFhO3dCQUMxQyxNQUFNLEVBQUUsV0FBVztxQkFDdEI7aUJBQ0o7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILElBQUksRUFBRSxPQUFPO29CQUNiLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7b0JBQ3pCLFdBQVcsRUFBRSx1REFBdUQ7aUJBQ3ZFO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsd0NBQXdDO2lCQUN4RDtnQkFDRCxTQUFTLEVBQUU7b0JBQ1AsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHdDQUF3QztpQkFDeEQ7Z0JBQ0QsR0FBRyxFQUFFO29CQUNELElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxpREFBaUQ7b0JBQzlELElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxF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QUFLLENBQUMsSUFBSTtRQUNkLElBQUksQ0FBQztZQUNELE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDL0UsTUFBTSxPQUFPLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxlQUFlLENBQUMsQ0FBQztZQUNqRixPQUFPLElBQUEscUJBQWEsRUFBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsRUFBRSx1Q0FBdUMsQ0FBQyxDQUFDO1FBQ3ZGLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsUUFBUTtRQUNsQixJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBQ2hFLE9BQU8sSUFBQSxxQkFBYSxFQUFDLElBQUksRUFBRSw4QkFBOEIsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7Q0FDSjtBQW5ORCxvREFtTkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XHJcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBjb2VyY2VGbG9hdCwgbm9ybWFsaXplU3RyaW5nQXJyYXkgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hbmFnZVJlZmVyZW5jZUltYWdlIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xyXG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcmVmZXJlbmNlX2ltYWdlJztcclxuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSByZWZlcmVuY2UgaW1hZ2Ugb3ZlcmxheXMgaW4gdGhlIHNjZW5lIHZpZXcuIEFjdGlvbnM6IGFkZCwgcmVtb3ZlLCBzd2l0Y2gsIHNldF9kYXRhLCBnZXRfY29uZmlnLCBnZXRfY3VycmVudCwgcmVmcmVzaCwgc2V0X3Bvc2l0aW9uLCBzZXRfc2NhbGUsIHNldF9vcGFjaXR5LCBsaXN0LCBjbGVhcl9hbGwuJztcclxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xyXG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxyXG4gICAgICAgICAgICAgICAgZW51bTogW1xyXG4gICAgICAgICAgICAgICAgICAgICdhZGQnLCAncmVtb3ZlJywgJ3N3aXRjaCcsICdzZXRfZGF0YScsXHJcbiAgICAgICAgICAgICAgICAgICAgJ2dldF9jb25maWcnLCAnZ2V0X2N1cnJlbnQnLCAncmVmcmVzaCcsXHJcbiAgICAgICAgICAgICAgICAgICAgJ3NldF9wb3NpdGlvbicsICdzZXRfc2NhbGUnLCAnc2V0X29wYWNpdHknLFxyXG4gICAgICAgICAgICAgICAgICAgICdsaXN0JywgJ2NsZWFyX2FsbCdcclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcGF0aHM6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXHJcbiAgICAgICAgICAgICAgICBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBcnJheSBvZiByZWZlcmVuY2UgaW1hZ2UgYWJzb2x1dGUgcGF0aHMgKGFkZCwgcmVtb3ZlKSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcGF0aDoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1JlZmVyZW5jZSBpbWFnZSBhYnNvbHV0ZSBwYXRoIChzd2l0Y2gpJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzY2VuZVVVSUQ6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTcGVjaWZpYyBzY2VuZSBVVUlEIChzd2l0Y2gsIG9wdGlvbmFsKSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAga2V5OiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJvcGVydHkga2V5IChzZXRfZGF0YTogcGF0aC94L3kvc3gvc3kvb3BhY2l0eSknLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWydwYXRoJywgJ3gnLCAneScsICdzeCcsICdzeScsICdvcGFjaXR5J11cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJvcGVydHkgdmFsdWUgKHNldF9kYXRhOiBwYXRoPXN0cmluZywgeC95L3N4L3N5L29wYWNpdHk9bnVtYmVyKSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgeDoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ggb2Zmc2V0IChzZXRfcG9zaXRpb24pJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB5OiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnWSBvZmZzZXQgKHNldF9wb3NpdGlvbiknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHN4OiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnWCBzY2FsZSAwLjEtMTAgKHNldF9zY2FsZSknLFxyXG4gICAgICAgICAgICAgICAgbWluaW11bTogMC4xLFxyXG4gICAgICAgICAgICAgICAgbWF4aW11bTogMTBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgc3k6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdZIHNjYWxlIDAuMS0xMCAoc2V0X3NjYWxlKScsXHJcbiAgICAgICAgICAgICAgICBtaW5pbXVtOiAwLjEsXHJcbiAgICAgICAgICAgICAgICBtYXhpbXVtOiAxMFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBvcGFjaXR5OiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnT3BhY2l0eSAwLjAtMS4wIChzZXRfb3BhY2l0eSknLFxyXG4gICAgICAgICAgICAgICAgbWluaW11bTogMCxcclxuICAgICAgICAgICAgICAgIG1heGltdW06IDFcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgIH07XHJcbiAgICByZWFkb25seSBhY3Rpb25zID0gW1xyXG4gICAgICAgICdhZGQnLCAncmVtb3ZlJywgJ3N3aXRjaCcsICdzZXRfZGF0YScsXHJcbiAgICAgICAgJ2dldF9jb25maWcnLCAnZ2V0X2N1cnJlbnQnLCAncmVmcmVzaCcsXHJcbiAgICAgICAgJ3NldF9wb3NpdGlvbicsICdzZXRfc2NhbGUnLCAnc2V0X29wYWNpdHknLFxyXG4gICAgICAgICdsaXN0JywgJ2NsZWFyX2FsbCdcclxuICAgIF07XHJcblxyXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XHJcbiAgICAgICAgYWRkOiAoYXJncykgPT4gdGhpcy5hZGQobm9ybWFsaXplU3RyaW5nQXJyYXkoYXJncy5wYXRocykgfHwgYXJncy5wYXRocyksXHJcbiAgICAgICAgcmVtb3ZlOiAoYXJncykgPT4gdGhpcy5yZW1vdmUobm9ybWFsaXplU3RyaW5nQXJyYXkoYXJncy5wYXRocykpLFxyXG4gICAgICAgIHN3aXRjaDogKGFyZ3MpID0+IHRoaXMuc3dpdGNoSW1hZ2UoYXJncy5wYXRoLCBhcmdzLnNjZW5lVVVJRCksXHJcbiAgICAgICAgc2V0X2RhdGE6IChhcmdzKSA9PiB0aGlzLnNldERhdGEoYXJncy5rZXksIGFyZ3MudmFsdWUpLFxyXG4gICAgICAgIGdldF9jb25maWc6ICgpID0+IHRoaXMuZ2V0Q29uZmlnKCksXHJcbiAgICAgICAgZ2V0X2N1cnJlbnQ6ICgpID0+IHRoaXMuZ2V0Q3VycmVudCgpLFxyXG4gICAgICAgIHJlZnJlc2g6ICgpID0+IHRoaXMucmVmcmVzaCgpLFxyXG4gICAgICAgIHNldF9wb3NpdGlvbjogKGFyZ3MpID0+IHRoaXMuc2V0UG9zaXRpb24oY29lcmNlRmxvYXQoYXJncy54KSwgY29lcmNlRmxvYXQoYXJncy55KSksXHJcbiAgICAgICAgc2V0X3NjYWxlOiAoYXJncykgPT4gdGhpcy5zZXRTY2FsZShjb2VyY2VGbG9hdChhcmdzLnN4KSwgY29lcmNlRmxvYXQoYXJncy5zeSkpLFxyXG4gICAgICAgIHNldF9vcGFjaXR5OiAoYXJncykgPT4gdGhpcy5zZXRPcGFjaXR5KGNvZXJjZUZsb2F0KGFyZ3Mub3BhY2l0eSkpLFxyXG4gICAgICAgIGxpc3Q6ICgpID0+IHRoaXMubGlzdCgpLFxyXG4gICAgICAgIGNsZWFyX2FsbDogKCkgPT4gdGhpcy5jbGVhckFsbCgpXHJcbiAgICB9O1xyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgYWRkKHBhdGhzOiBzdHJpbmdbXSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghcGF0aHMgfHwgcGF0aHMubGVuZ3RoID09PSAwKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3BhdGhzIGlzIHJlcXVpcmVkIGZvciBhZGQnKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdyZWZlcmVuY2UtaW1hZ2UnLCAnYWRkLWltYWdlJywgcGF0aHMpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGFkZGVkUGF0aHM6IHBhdGhzLCBjb3VudDogcGF0aHMubGVuZ3RoIH0sIGBBZGRlZCAke3BhdGhzLmxlbmd0aH0gcmVmZXJlbmNlIGltYWdlKHMpYCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyByZW1vdmUocGF0aHM/OiBzdHJpbmdbXSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3JlZmVyZW5jZS1pbWFnZScsICdyZW1vdmUtaW1hZ2UnLCBwYXRocyk7XHJcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBwYXRocyAmJiBwYXRocy5sZW5ndGggPiAwXHJcbiAgICAgICAgICAgICAgICA/IGBSZW1vdmVkICR7cGF0aHMubGVuZ3RofSByZWZlcmVuY2UgaW1hZ2UocylgXHJcbiAgICAgICAgICAgICAgICA6ICdSZW1vdmVkIGN1cnJlbnQgcmVmZXJlbmNlIGltYWdlJztcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgbWVzc2FnZSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzd2l0Y2hJbWFnZShwYXRoOiBzdHJpbmcsIHNjZW5lVVVJRD86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghcGF0aCkgcmV0dXJuIGVycm9yUmVzdWx0KCdwYXRoIGlzIHJlcXVpcmVkIGZvciBzd2l0Y2gnKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBhcmdzID0gc2NlbmVVVUlEID8gW3BhdGgsIHNjZW5lVVVJRF0gOiBbcGF0aF07XHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3JlZmVyZW5jZS1pbWFnZScsICdzd2l0Y2gtaW1hZ2UnLCAuLi5hcmdzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBwYXRoLCBzY2VuZVVVSUQgfSwgYFN3aXRjaGVkIHRvIHJlZmVyZW5jZSBpbWFnZTogJHtwYXRofWApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0RGF0YShrZXk6IHN0cmluZywgdmFsdWU6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICgha2V5KSByZXR1cm4gZXJyb3JSZXN1bHQoJ2tleSBpcyByZXF1aXJlZCBmb3Igc2V0X2RhdGEnKTtcclxuICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd2YWx1ZSBpcyByZXF1aXJlZCBmb3Igc2V0X2RhdGEnKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdyZWZlcmVuY2UtaW1hZ2UnLCAnc2V0LWltYWdlLWRhdGEnLCBrZXksIHZhbHVlKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBrZXksIHZhbHVlIH0sIGBSZWZlcmVuY2UgaW1hZ2UgJHtrZXl9IHNldCB0byAke3ZhbHVlfWApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q29uZmlnKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3JlZmVyZW5jZS1pbWFnZScsICdxdWVyeS1jb25maWcnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoY29uZmlnKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldEN1cnJlbnQoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3JlZmVyZW5jZS1pbWFnZScsICdxdWVyeS1jdXJyZW50Jyk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KGN1cnJlbnQpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcmVmcmVzaCgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdyZWZlcmVuY2UtaW1hZ2UnLCAncmVmcmVzaCcpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCAnUmVmZXJlbmNlIGltYWdlIHJlZnJlc2hlZCcpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0UG9zaXRpb24oeDogbnVtYmVyIHwgdW5kZWZpbmVkLCB5OiBudW1iZXIgfCB1bmRlZmluZWQpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBpZiAoeCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ggaXMgcmVxdWlyZWQgZm9yIHNldF9wb3NpdGlvbicpO1xyXG4gICAgICAgIGlmICh5ID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgneSBpcyByZXF1aXJlZCBmb3Igc2V0X3Bvc2l0aW9uJyk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncmVmZXJlbmNlLWltYWdlJywgJ3NldC1pbWFnZS1kYXRhJywgJ3gnLCB4KTtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncmVmZXJlbmNlLWltYWdlJywgJ3NldC1pbWFnZS1kYXRhJywgJ3knLCB5KTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB4LCB5IH0sIGBSZWZlcmVuY2UgaW1hZ2UgcG9zaXRpb24gc2V0IHRvICgke3h9LCAke3l9KWApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0U2NhbGUoc3g6IG51bWJlciB8IHVuZGVmaW5lZCwgc3k6IG51bWJlciB8IHVuZGVmaW5lZCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmIChzeCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3N4IGlzIHJlcXVpcmVkIGZvciBzZXRfc2NhbGUnKTtcclxuICAgICAgICBpZiAoc3kgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdzeSBpcyByZXF1aXJlZCBmb3Igc2V0X3NjYWxlJyk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncmVmZXJlbmNlLWltYWdlJywgJ3NldC1pbWFnZS1kYXRhJywgJ3N4Jywgc3gpO1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdyZWZlcmVuY2UtaW1hZ2UnLCAnc2V0LWltYWdlLWRhdGEnLCAnc3knLCBzeSk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgc3gsIHN5IH0sIGBSZWZlcmVuY2UgaW1hZ2Ugc2NhbGUgc2V0IHRvICgke3N4fSwgJHtzeX0pYCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRPcGFjaXR5KG9wYWNpdHk6IG51bWJlciB8IHVuZGVmaW5lZCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmIChvcGFjaXR5ID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgnb3BhY2l0eSBpcyByZXF1aXJlZCBmb3Igc2V0X29wYWNpdHknKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdyZWZlcmVuY2UtaW1hZ2UnLCAnc2V0LWltYWdlLWRhdGEnLCAnb3BhY2l0eScsIG9wYWNpdHkpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG9wYWNpdHkgfSwgYFJlZmVyZW5jZSBpbWFnZSBvcGFjaXR5IHNldCB0byAke29wYWNpdHl9YCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0KCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3JlZmVyZW5jZS1pbWFnZScsICdxdWVyeS1jb25maWcnKTtcclxuICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3JlZmVyZW5jZS1pbWFnZScsICdxdWVyeS1jdXJyZW50Jyk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgY29uZmlnLCBjdXJyZW50IH0sICdSZWZlcmVuY2UgaW1hZ2UgaW5mb3JtYXRpb24gcmV0cmlldmVkJyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBjbGVhckFsbCgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdyZWZlcmVuY2UtaW1hZ2UnLCAncmVtb3ZlLWltYWdlJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsICdBbGwgcmVmZXJlbmNlIGltYWdlcyBjbGVhcmVkJyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuIl19