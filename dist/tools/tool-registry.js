"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAllTools = createAllTools;
exports.getAllToolDescriptors = getAllToolDescriptors;
const manage_scene_1 = require("./manage-scene");
const manage_node_1 = require("./manage-node");
const manage_component_1 = require("./manage-component");
const manage_prefab_1 = require("./manage-prefab");
const manage_asset_1 = require("./manage-asset");
const manage_project_1 = require("./manage-project");
const manage_debug_1 = require("./manage-debug");
const manage_preferences_1 = require("./manage-preferences");
const manage_server_1 = require("./manage-server");
const manage_broadcast_1 = require("./manage-broadcast");
const manage_scene_view_1 = require("./manage-scene-view");
const manage_node_hierarchy_1 = require("./manage-node-hierarchy");
const manage_scene_query_1 = require("./manage-scene-query");
const manage_undo_1 = require("./manage-undo");
const manage_reference_image_1 = require("./manage-reference-image");
const manage_validation_1 = require("./manage-validation");
const manage_selection_1 = require("./manage-selection");
const manage_script_1 = require("./manage-script");
const manage_material_1 = require("./manage-material");
const manage_animation_1 = require("./manage-animation");
// Phase 1: Core Tools
const manage_light_1 = require("./manage-light");
const manage_camera_1 = require("./manage-camera");
const manage_physics_1 = require("./manage-physics");
const manage_ui_1 = require("./manage-ui");
const batch_execute_1 = require("./batch-execute");
// Phase 2: Game Tools
const manage_audio_1 = require("./manage-audio");
const manage_particle_1 = require("./manage-particle");
const manage_tween_1 = require("./manage-tween");
const manage_editor_1 = require("./manage-editor");
// Phase 3: Specialized Tools
const manage_tilemap_1 = require("./manage-tilemap");
const manage_spine_1 = require("./manage-spine");
const manage_dragonbones_1 = require("./manage-dragonbones");
const execute_menu_item_1 = require("./execute-menu-item");
const manage_terrain_1 = require("./manage-terrain");
// Phase 4: Polish Tools
const manage_render_pipeline_1 = require("./manage-render-pipeline");
const manage_shader_effect_1 = require("./manage-shader-effect");
const manage_mesh_1 = require("./manage-mesh");
const manage_profiler_1 = require("./manage-profiler");
const manage_video_1 = require("./manage-video");
const manage_input_1 = require("./manage-input");
/**
 * Single source of truth for "which v2 tools exist". Both `MCPServer`
 * (tool execution/routing) and `ToolManager` (enable/disable persistence,
 * `settings/tool-manager.json`) derive their tool list from this factory —
 * adding a tool here is the ONLY place it needs to be added; both consumers
 * pick it up automatically. Closes the #88/#94 drift where 20 tools were
 * registered in `MCPServer.initializeTools()` but never added to
 * `ToolManager`'s hand-maintained name list, so `syncToolList()` silently
 * pruned every reference to them from persisted configs.
 *
 * `batch_execute` is the one tool needing a live callback into
 * `MCPServer.executeToolCall` to run its nested tool calls — every other tool
 * takes no constructor args. `ToolManager` only ever reads `name`/`description`
 * off these instances (never `execute()`), so it can pass a stub executor.
 */
function createAllTools(executor) {
    return [
        new manage_scene_1.ManageScene(),
        new manage_node_1.ManageNode(),
        new manage_component_1.ManageComponent(),
        new manage_prefab_1.ManagePrefab(),
        new manage_asset_1.ManageAsset(),
        new manage_project_1.ManageProject(),
        new manage_debug_1.ManageDebug(),
        new manage_preferences_1.ManagePreferences(),
        new manage_server_1.ManageServer(),
        new manage_broadcast_1.ManageBroadcast(),
        new manage_scene_view_1.ManageSceneView(),
        new manage_node_hierarchy_1.ManageNodeHierarchy(),
        new manage_scene_query_1.ManageSceneQuery(),
        new manage_undo_1.ManageUndo(),
        new manage_reference_image_1.ManageReferenceImage(),
        new manage_validation_1.ManageValidation(),
        new manage_selection_1.ManageSelection(),
        new manage_script_1.ManageScript(),
        new manage_material_1.ManageMaterial(),
        new manage_animation_1.ManageAnimation(),
        // Phase 1: Core Tools
        new manage_light_1.ManageLight(),
        new manage_camera_1.ManageCamera(),
        new manage_physics_1.ManagePhysics(),
        new manage_ui_1.ManageUI(),
        new batch_execute_1.BatchExecute(executor),
        // Phase 2: Game Tools
        new manage_audio_1.ManageAudio(),
        new manage_particle_1.ManageParticle(),
        new manage_tween_1.ManageTween(),
        new manage_editor_1.ManageEditor(),
        // Phase 3: Specialized Tools
        new manage_tilemap_1.ManageTilemap(),
        new manage_spine_1.ManageSpine(),
        new manage_dragonbones_1.ManageDragonBones(),
        new execute_menu_item_1.ExecuteMenuItem(),
        new manage_terrain_1.ManageTerrain(),
        // Phase 4: Polish Tools
        new manage_render_pipeline_1.ManageRenderPipeline(),
        new manage_shader_effect_1.ManageShaderEffect(),
        new manage_mesh_1.ManageMesh(),
        new manage_profiler_1.ManageProfiler(),
        new manage_video_1.ManageVideo(),
        new manage_input_1.ManageInput(),
    ];
}
const NOOP_EXECUTOR = {
    executeToolCall() {
        throw new Error('createAllTools() stub executor invoked — batch_execute must only be run through the real MCPServer instance');
    }
};
/**
 * Every tool's name and description, for consumers (ToolManager) that only need
 * to catalog tools, never execute them. Uses a stub `batch_execute` executor
 * since instantiating it does not invoke the callback.
 */
function getAllToolDescriptors() {
    return createAllTools(NOOP_EXECUTOR).map(t => ({ name: t.name, description: t.description }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vbC1yZWdpc3RyeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy90b29sLXJlZ2lzdHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBNkRBLHdDQStDQztBQW1CRCxzREFFQztBQWhJRCxpREFBNkM7QUFDN0MsK0NBQTJDO0FBQzNDLHlEQUFxRDtBQUNyRCxtREFBK0M7QUFDL0MsaURBQTZDO0FBQzdDLHFEQUFpRDtBQUNqRCxpREFBNkM7QUFDN0MsNkRBQXlEO0FBQ3pELG1EQUErQztBQUMvQyx5REFBcUQ7QUFDckQsMkRBQXNEO0FBQ3RELG1FQUE4RDtBQUM5RCw2REFBd0Q7QUFDeEQsK0NBQTJDO0FBQzNDLHFFQUFnRTtBQUNoRSwyREFBdUQ7QUFDdkQseURBQXFEO0FBQ3JELG1EQUErQztBQUMvQyx1REFBbUQ7QUFDbkQseURBQXFEO0FBQ3JELHNCQUFzQjtBQUN0QixpREFBNkM7QUFDN0MsbURBQStDO0FBQy9DLHFEQUFpRDtBQUNqRCwyQ0FBdUM7QUFDdkMsbURBQTZEO0FBQzdELHNCQUFzQjtBQUN0QixpREFBNkM7QUFDN0MsdURBQW1EO0FBQ25ELGlEQUE2QztBQUM3QyxtREFBK0M7QUFDL0MsNkJBQTZCO0FBQzdCLHFEQUFpRDtBQUNqRCxpREFBNkM7QUFDN0MsNkRBQXlEO0FBQ3pELDJEQUFzRDtBQUN0RCxxREFBaUQ7QUFDakQsd0JBQXdCO0FBQ3hCLHFFQUFnRTtBQUNoRSxpRUFBNEQ7QUFDNUQsK0NBQTJDO0FBQzNDLHVEQUFtRDtBQUNuRCxpREFBNkM7QUFDN0MsaURBQTZDO0FBRTdDOzs7Ozs7Ozs7Ozs7OztHQWNHO0FBQ0gsU0FBZ0IsY0FBYyxDQUFDLFFBQXNCO0lBQ2pELE9BQU87UUFDSCxJQUFJLDBCQUFXLEVBQUU7UUFDakIsSUFBSSx3QkFBVSxFQUFFO1FBQ2hCLElBQUksa0NBQWUsRUFBRTtRQUNyQixJQUFJLDRCQUFZLEVBQUU7UUFDbEIsSUFBSSwwQkFBVyxFQUFFO1FBQ2pCLElBQUksOEJBQWEsRUFBRTtRQUNuQixJQUFJLDBCQUFXLEVBQUU7UUFDakIsSUFBSSxzQ0FBaUIsRUFBRTtRQUN2QixJQUFJLDRCQUFZLEVBQUU7UUFDbEIsSUFBSSxrQ0FBZSxFQUFFO1FBQ3JCLElBQUksbUNBQWUsRUFBRTtRQUNyQixJQUFJLDJDQUFtQixFQUFFO1FBQ3pCLElBQUkscUNBQWdCLEVBQUU7UUFDdEIsSUFBSSx3QkFBVSxFQUFFO1FBQ2hCLElBQUksNkNBQW9CLEVBQUU7UUFDMUIsSUFBSSxvQ0FBZ0IsRUFBRTtRQUN0QixJQUFJLGtDQUFlLEVBQUU7UUFDckIsSUFBSSw0QkFBWSxFQUFFO1FBQ2xCLElBQUksZ0NBQWMsRUFBRTtRQUNwQixJQUFJLGtDQUFlLEVBQUU7UUFDckIsc0JBQXNCO1FBQ3RCLElBQUksMEJBQVcsRUFBRTtRQUNqQixJQUFJLDRCQUFZLEVBQUU7UUFDbEIsSUFBSSw4QkFBYSxFQUFFO1FBQ25CLElBQUksb0JBQVEsRUFBRTtRQUNkLElBQUksNEJBQVksQ0FBQyxRQUFRLENBQUM7UUFDMUIsc0JBQXNCO1FBQ3RCLElBQUksMEJBQVcsRUFBRTtRQUNqQixJQUFJLGdDQUFjLEVBQUU7UUFDcEIsSUFBSSwwQkFBVyxFQUFFO1FBQ2pCLElBQUksNEJBQVksRUFBRTtRQUNsQiw2QkFBNkI7UUFDN0IsSUFBSSw4QkFBYSxFQUFFO1FBQ25CLElBQUksMEJBQVcsRUFBRTtRQUNqQixJQUFJLHNDQUFpQixFQUFFO1FBQ3ZCLElBQUksbUNBQWUsRUFBRTtRQUNyQixJQUFJLDhCQUFhLEVBQUU7UUFDbkIsd0JBQXdCO1FBQ3hCLElBQUksNkNBQW9CLEVBQUU7UUFDMUIsSUFBSSx5Q0FBa0IsRUFBRTtRQUN4QixJQUFJLHdCQUFVLEVBQUU7UUFDaEIsSUFBSSxnQ0FBYyxFQUFFO1FBQ3BCLElBQUksMEJBQVcsRUFBRTtRQUNqQixJQUFJLDBCQUFXLEVBQUU7S0FDcEIsQ0FBQztBQUNOLENBQUM7QUFFRCxNQUFNLGFBQWEsR0FBaUI7SUFDaEMsZUFBZTtRQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsNkdBQTZHLENBQUMsQ0FBQztJQUNuSSxDQUFDO0NBQ0osQ0FBQztBQVFGOzs7O0dBSUc7QUFDSCxTQUFnQixxQkFBcUI7SUFDakMsT0FBTyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ2xHLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBY3Rpb25Ub29sRXhlY3V0b3IgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBNYW5hZ2VTY2VuZSB9IGZyb20gJy4vbWFuYWdlLXNjZW5lJztcbmltcG9ydCB7IE1hbmFnZU5vZGUgfSBmcm9tICcuL21hbmFnZS1ub2RlJztcbmltcG9ydCB7IE1hbmFnZUNvbXBvbmVudCB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudCc7XG5pbXBvcnQgeyBNYW5hZ2VQcmVmYWIgfSBmcm9tICcuL21hbmFnZS1wcmVmYWInO1xuaW1wb3J0IHsgTWFuYWdlQXNzZXQgfSBmcm9tICcuL21hbmFnZS1hc3NldCc7XG5pbXBvcnQgeyBNYW5hZ2VQcm9qZWN0IH0gZnJvbSAnLi9tYW5hZ2UtcHJvamVjdCc7XG5pbXBvcnQgeyBNYW5hZ2VEZWJ1ZyB9IGZyb20gJy4vbWFuYWdlLWRlYnVnJztcbmltcG9ydCB7IE1hbmFnZVByZWZlcmVuY2VzIH0gZnJvbSAnLi9tYW5hZ2UtcHJlZmVyZW5jZXMnO1xuaW1wb3J0IHsgTWFuYWdlU2VydmVyIH0gZnJvbSAnLi9tYW5hZ2Utc2VydmVyJztcbmltcG9ydCB7IE1hbmFnZUJyb2FkY2FzdCB9IGZyb20gJy4vbWFuYWdlLWJyb2FkY2FzdCc7XG5pbXBvcnQgeyBNYW5hZ2VTY2VuZVZpZXcgfSBmcm9tICcuL21hbmFnZS1zY2VuZS12aWV3JztcbmltcG9ydCB7IE1hbmFnZU5vZGVIaWVyYXJjaHkgfSBmcm9tICcuL21hbmFnZS1ub2RlLWhpZXJhcmNoeSc7XG5pbXBvcnQgeyBNYW5hZ2VTY2VuZVF1ZXJ5IH0gZnJvbSAnLi9tYW5hZ2Utc2NlbmUtcXVlcnknO1xuaW1wb3J0IHsgTWFuYWdlVW5kbyB9IGZyb20gJy4vbWFuYWdlLXVuZG8nO1xuaW1wb3J0IHsgTWFuYWdlUmVmZXJlbmNlSW1hZ2UgfSBmcm9tICcuL21hbmFnZS1yZWZlcmVuY2UtaW1hZ2UnO1xuaW1wb3J0IHsgTWFuYWdlVmFsaWRhdGlvbiB9IGZyb20gJy4vbWFuYWdlLXZhbGlkYXRpb24nO1xuaW1wb3J0IHsgTWFuYWdlU2VsZWN0aW9uIH0gZnJvbSAnLi9tYW5hZ2Utc2VsZWN0aW9uJztcbmltcG9ydCB7IE1hbmFnZVNjcmlwdCB9IGZyb20gJy4vbWFuYWdlLXNjcmlwdCc7XG5pbXBvcnQgeyBNYW5hZ2VNYXRlcmlhbCB9IGZyb20gJy4vbWFuYWdlLW1hdGVyaWFsJztcbmltcG9ydCB7IE1hbmFnZUFuaW1hdGlvbiB9IGZyb20gJy4vbWFuYWdlLWFuaW1hdGlvbic7XG4vLyBQaGFzZSAxOiBDb3JlIFRvb2xzXG5pbXBvcnQgeyBNYW5hZ2VMaWdodCB9IGZyb20gJy4vbWFuYWdlLWxpZ2h0JztcbmltcG9ydCB7IE1hbmFnZUNhbWVyYSB9IGZyb20gJy4vbWFuYWdlLWNhbWVyYSc7XG5pbXBvcnQgeyBNYW5hZ2VQaHlzaWNzIH0gZnJvbSAnLi9tYW5hZ2UtcGh5c2ljcyc7XG5pbXBvcnQgeyBNYW5hZ2VVSSB9IGZyb20gJy4vbWFuYWdlLXVpJztcbmltcG9ydCB7IEJhdGNoRXhlY3V0ZSwgVG9vbEV4ZWN1dG9yIH0gZnJvbSAnLi9iYXRjaC1leGVjdXRlJztcbi8vIFBoYXNlIDI6IEdhbWUgVG9vbHNcbmltcG9ydCB7IE1hbmFnZUF1ZGlvIH0gZnJvbSAnLi9tYW5hZ2UtYXVkaW8nO1xuaW1wb3J0IHsgTWFuYWdlUGFydGljbGUgfSBmcm9tICcuL21hbmFnZS1wYXJ0aWNsZSc7XG5pbXBvcnQgeyBNYW5hZ2VUd2VlbiB9IGZyb20gJy4vbWFuYWdlLXR3ZWVuJztcbmltcG9ydCB7IE1hbmFnZUVkaXRvciB9IGZyb20gJy4vbWFuYWdlLWVkaXRvcic7XG4vLyBQaGFzZSAzOiBTcGVjaWFsaXplZCBUb29sc1xuaW1wb3J0IHsgTWFuYWdlVGlsZW1hcCB9IGZyb20gJy4vbWFuYWdlLXRpbGVtYXAnO1xuaW1wb3J0IHsgTWFuYWdlU3BpbmUgfSBmcm9tICcuL21hbmFnZS1zcGluZSc7XG5pbXBvcnQgeyBNYW5hZ2VEcmFnb25Cb25lcyB9IGZyb20gJy4vbWFuYWdlLWRyYWdvbmJvbmVzJztcbmltcG9ydCB7IEV4ZWN1dGVNZW51SXRlbSB9IGZyb20gJy4vZXhlY3V0ZS1tZW51LWl0ZW0nO1xuaW1wb3J0IHsgTWFuYWdlVGVycmFpbiB9IGZyb20gJy4vbWFuYWdlLXRlcnJhaW4nO1xuLy8gUGhhc2UgNDogUG9saXNoIFRvb2xzXG5pbXBvcnQgeyBNYW5hZ2VSZW5kZXJQaXBlbGluZSB9IGZyb20gJy4vbWFuYWdlLXJlbmRlci1waXBlbGluZSc7XG5pbXBvcnQgeyBNYW5hZ2VTaGFkZXJFZmZlY3QgfSBmcm9tICcuL21hbmFnZS1zaGFkZXItZWZmZWN0JztcbmltcG9ydCB7IE1hbmFnZU1lc2ggfSBmcm9tICcuL21hbmFnZS1tZXNoJztcbmltcG9ydCB7IE1hbmFnZVByb2ZpbGVyIH0gZnJvbSAnLi9tYW5hZ2UtcHJvZmlsZXInO1xuaW1wb3J0IHsgTWFuYWdlVmlkZW8gfSBmcm9tICcuL21hbmFnZS12aWRlbyc7XG5pbXBvcnQgeyBNYW5hZ2VJbnB1dCB9IGZyb20gJy4vbWFuYWdlLWlucHV0JztcblxuLyoqXG4gKiBTaW5nbGUgc291cmNlIG9mIHRydXRoIGZvciBcIndoaWNoIHYyIHRvb2xzIGV4aXN0XCIuIEJvdGggYE1DUFNlcnZlcmBcbiAqICh0b29sIGV4ZWN1dGlvbi9yb3V0aW5nKSBhbmQgYFRvb2xNYW5hZ2VyYCAoZW5hYmxlL2Rpc2FibGUgcGVyc2lzdGVuY2UsXG4gKiBgc2V0dGluZ3MvdG9vbC1tYW5hZ2VyLmpzb25gKSBkZXJpdmUgdGhlaXIgdG9vbCBsaXN0IGZyb20gdGhpcyBmYWN0b3J5IOKAlFxuICogYWRkaW5nIGEgdG9vbCBoZXJlIGlzIHRoZSBPTkxZIHBsYWNlIGl0IG5lZWRzIHRvIGJlIGFkZGVkOyBib3RoIGNvbnN1bWVyc1xuICogcGljayBpdCB1cCBhdXRvbWF0aWNhbGx5LiBDbG9zZXMgdGhlICM4OC8jOTQgZHJpZnQgd2hlcmUgMjAgdG9vbHMgd2VyZVxuICogcmVnaXN0ZXJlZCBpbiBgTUNQU2VydmVyLmluaXRpYWxpemVUb29scygpYCBidXQgbmV2ZXIgYWRkZWQgdG9cbiAqIGBUb29sTWFuYWdlcmAncyBoYW5kLW1haW50YWluZWQgbmFtZSBsaXN0LCBzbyBgc3luY1Rvb2xMaXN0KClgIHNpbGVudGx5XG4gKiBwcnVuZWQgZXZlcnkgcmVmZXJlbmNlIHRvIHRoZW0gZnJvbSBwZXJzaXN0ZWQgY29uZmlncy5cbiAqXG4gKiBgYmF0Y2hfZXhlY3V0ZWAgaXMgdGhlIG9uZSB0b29sIG5lZWRpbmcgYSBsaXZlIGNhbGxiYWNrIGludG9cbiAqIGBNQ1BTZXJ2ZXIuZXhlY3V0ZVRvb2xDYWxsYCB0byBydW4gaXRzIG5lc3RlZCB0b29sIGNhbGxzIOKAlCBldmVyeSBvdGhlciB0b29sXG4gKiB0YWtlcyBubyBjb25zdHJ1Y3RvciBhcmdzLiBgVG9vbE1hbmFnZXJgIG9ubHkgZXZlciByZWFkcyBgbmFtZWAvYGRlc2NyaXB0aW9uYFxuICogb2ZmIHRoZXNlIGluc3RhbmNlcyAobmV2ZXIgYGV4ZWN1dGUoKWApLCBzbyBpdCBjYW4gcGFzcyBhIHN0dWIgZXhlY3V0b3IuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbGxUb29scyhleGVjdXRvcjogVG9vbEV4ZWN1dG9yKTogQWN0aW9uVG9vbEV4ZWN1dG9yW10ge1xuICAgIHJldHVybiBbXG4gICAgICAgIG5ldyBNYW5hZ2VTY2VuZSgpLFxuICAgICAgICBuZXcgTWFuYWdlTm9kZSgpLFxuICAgICAgICBuZXcgTWFuYWdlQ29tcG9uZW50KCksXG4gICAgICAgIG5ldyBNYW5hZ2VQcmVmYWIoKSxcbiAgICAgICAgbmV3IE1hbmFnZUFzc2V0KCksXG4gICAgICAgIG5ldyBNYW5hZ2VQcm9qZWN0KCksXG4gICAgICAgIG5ldyBNYW5hZ2VEZWJ1ZygpLFxuICAgICAgICBuZXcgTWFuYWdlUHJlZmVyZW5jZXMoKSxcbiAgICAgICAgbmV3IE1hbmFnZVNlcnZlcigpLFxuICAgICAgICBuZXcgTWFuYWdlQnJvYWRjYXN0KCksXG4gICAgICAgIG5ldyBNYW5hZ2VTY2VuZVZpZXcoKSxcbiAgICAgICAgbmV3IE1hbmFnZU5vZGVIaWVyYXJjaHkoKSxcbiAgICAgICAgbmV3IE1hbmFnZVNjZW5lUXVlcnkoKSxcbiAgICAgICAgbmV3IE1hbmFnZVVuZG8oKSxcbiAgICAgICAgbmV3IE1hbmFnZVJlZmVyZW5jZUltYWdlKCksXG4gICAgICAgIG5ldyBNYW5hZ2VWYWxpZGF0aW9uKCksXG4gICAgICAgIG5ldyBNYW5hZ2VTZWxlY3Rpb24oKSxcbiAgICAgICAgbmV3IE1hbmFnZVNjcmlwdCgpLFxuICAgICAgICBuZXcgTWFuYWdlTWF0ZXJpYWwoKSxcbiAgICAgICAgbmV3IE1hbmFnZUFuaW1hdGlvbigpLFxuICAgICAgICAvLyBQaGFzZSAxOiBDb3JlIFRvb2xzXG4gICAgICAgIG5ldyBNYW5hZ2VMaWdodCgpLFxuICAgICAgICBuZXcgTWFuYWdlQ2FtZXJhKCksXG4gICAgICAgIG5ldyBNYW5hZ2VQaHlzaWNzKCksXG4gICAgICAgIG5ldyBNYW5hZ2VVSSgpLFxuICAgICAgICBuZXcgQmF0Y2hFeGVjdXRlKGV4ZWN1dG9yKSxcbiAgICAgICAgLy8gUGhhc2UgMjogR2FtZSBUb29sc1xuICAgICAgICBuZXcgTWFuYWdlQXVkaW8oKSxcbiAgICAgICAgbmV3IE1hbmFnZVBhcnRpY2xlKCksXG4gICAgICAgIG5ldyBNYW5hZ2VUd2VlbigpLFxuICAgICAgICBuZXcgTWFuYWdlRWRpdG9yKCksXG4gICAgICAgIC8vIFBoYXNlIDM6IFNwZWNpYWxpemVkIFRvb2xzXG4gICAgICAgIG5ldyBNYW5hZ2VUaWxlbWFwKCksXG4gICAgICAgIG5ldyBNYW5hZ2VTcGluZSgpLFxuICAgICAgICBuZXcgTWFuYWdlRHJhZ29uQm9uZXMoKSxcbiAgICAgICAgbmV3IEV4ZWN1dGVNZW51SXRlbSgpLFxuICAgICAgICBuZXcgTWFuYWdlVGVycmFpbigpLFxuICAgICAgICAvLyBQaGFzZSA0OiBQb2xpc2ggVG9vbHNcbiAgICAgICAgbmV3IE1hbmFnZVJlbmRlclBpcGVsaW5lKCksXG4gICAgICAgIG5ldyBNYW5hZ2VTaGFkZXJFZmZlY3QoKSxcbiAgICAgICAgbmV3IE1hbmFnZU1lc2goKSxcbiAgICAgICAgbmV3IE1hbmFnZVByb2ZpbGVyKCksXG4gICAgICAgIG5ldyBNYW5hZ2VWaWRlbygpLFxuICAgICAgICBuZXcgTWFuYWdlSW5wdXQoKSxcbiAgICBdO1xufVxuXG5jb25zdCBOT09QX0VYRUNVVE9SOiBUb29sRXhlY3V0b3IgPSB7XG4gICAgZXhlY3V0ZVRvb2xDYWxsKCk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY3JlYXRlQWxsVG9vbHMoKSBzdHViIGV4ZWN1dG9yIGludm9rZWQg4oCUIGJhdGNoX2V4ZWN1dGUgbXVzdCBvbmx5IGJlIHJ1biB0aHJvdWdoIHRoZSByZWFsIE1DUFNlcnZlciBpbnN0YW5jZScpO1xuICAgIH1cbn07XG5cbi8qKiBUb29sIGRlc2NyaXB0b3IgKG5hbWUgKyBkZXNjcmlwdGlvbikgd2l0aCBubyBsaXZlIGV4ZWN1dGlvbiBjYXBhYmlsaXR5LiAqL1xuZXhwb3J0IGludGVyZmFjZSBUb29sRGVzY3JpcHRvciB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbi8qKlxuICogRXZlcnkgdG9vbCdzIG5hbWUgYW5kIGRlc2NyaXB0aW9uLCBmb3IgY29uc3VtZXJzIChUb29sTWFuYWdlcikgdGhhdCBvbmx5IG5lZWRcbiAqIHRvIGNhdGFsb2cgdG9vbHMsIG5ldmVyIGV4ZWN1dGUgdGhlbS4gVXNlcyBhIHN0dWIgYGJhdGNoX2V4ZWN1dGVgIGV4ZWN1dG9yXG4gKiBzaW5jZSBpbnN0YW50aWF0aW5nIGl0IGRvZXMgbm90IGludm9rZSB0aGUgY2FsbGJhY2suXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRBbGxUb29sRGVzY3JpcHRvcnMoKTogVG9vbERlc2NyaXB0b3JbXSB7XG4gICAgcmV0dXJuIGNyZWF0ZUFsbFRvb2xzKE5PT1BfRVhFQ1VUT1IpLm1hcCh0ID0+ICh7IG5hbWU6IHQubmFtZSwgZGVzY3JpcHRpb246IHQuZGVzY3JpcHRpb24gfSkpO1xufVxuIl19