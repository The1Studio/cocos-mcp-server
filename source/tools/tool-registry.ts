import { ActionToolExecutor } from '../types';
import { ManageScene } from './manage-scene';
import { ManageNode } from './manage-node';
import { ManageComponent } from './manage-component';
import { ManagePrefab } from './manage-prefab';
import { ManageAsset } from './manage-asset';
import { ManageProject } from './manage-project';
import { ManageDebug } from './manage-debug';
import { ManagePreferences } from './manage-preferences';
import { ManageServer } from './manage-server';
import { ManageBroadcast } from './manage-broadcast';
import { ManageSceneView } from './manage-scene-view';
import { ManageNodeHierarchy } from './manage-node-hierarchy';
import { ManageSceneQuery } from './manage-scene-query';
import { ManageUndo } from './manage-undo';
import { ManageReferenceImage } from './manage-reference-image';
import { ManageValidation } from './manage-validation';
import { ManageSelection } from './manage-selection';
import { ManageScript } from './manage-script';
import { ManageMaterial } from './manage-material';
import { ManageAnimation } from './manage-animation';
// Phase 1: Core Tools
import { ManageLight } from './manage-light';
import { ManageCamera } from './manage-camera';
import { ManagePhysics } from './manage-physics';
import { ManageUI } from './manage-ui';
import { BatchExecute, ToolExecutor } from './batch-execute';
// Phase 2: Game Tools
import { ManageAudio } from './manage-audio';
import { ManageParticle } from './manage-particle';
import { ManageTween } from './manage-tween';
import { ManageEditor } from './manage-editor';
// Phase 3: Specialized Tools
import { ManageTilemap } from './manage-tilemap';
import { ManageSpine } from './manage-spine';
import { ManageDragonBones } from './manage-dragonbones';
import { ExecuteMenuItem } from './execute-menu-item';
import { ManageTerrain } from './manage-terrain';
// Phase 4: Polish Tools
import { ManageRenderPipeline } from './manage-render-pipeline';
import { ManageShaderEffect } from './manage-shader-effect';
import { ManageMesh } from './manage-mesh';
import { ManageProfiler } from './manage-profiler';
import { ManageVideo } from './manage-video';
import { ManageInput } from './manage-input';

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
export function createAllTools(executor: ToolExecutor): ActionToolExecutor[] {
    return [
        new ManageScene(),
        new ManageNode(),
        new ManageComponent(),
        new ManagePrefab(),
        new ManageAsset(),
        new ManageProject(),
        new ManageDebug(),
        new ManagePreferences(),
        new ManageServer(),
        new ManageBroadcast(),
        new ManageSceneView(),
        new ManageNodeHierarchy(),
        new ManageSceneQuery(),
        new ManageUndo(),
        new ManageReferenceImage(),
        new ManageValidation(),
        new ManageSelection(),
        new ManageScript(),
        new ManageMaterial(),
        new ManageAnimation(),
        // Phase 1: Core Tools
        new ManageLight(),
        new ManageCamera(),
        new ManagePhysics(),
        new ManageUI(),
        new BatchExecute(executor),
        // Phase 2: Game Tools
        new ManageAudio(),
        new ManageParticle(),
        new ManageTween(),
        new ManageEditor(),
        // Phase 3: Specialized Tools
        new ManageTilemap(),
        new ManageSpine(),
        new ManageDragonBones(),
        new ExecuteMenuItem(),
        new ManageTerrain(),
        // Phase 4: Polish Tools
        new ManageRenderPipeline(),
        new ManageShaderEffect(),
        new ManageMesh(),
        new ManageProfiler(),
        new ManageVideo(),
        new ManageInput(),
    ];
}

const NOOP_EXECUTOR: ToolExecutor = {
    executeToolCall(): Promise<any> {
        throw new Error('createAllTools() stub executor invoked — batch_execute must only be run through the real MCPServer instance');
    }
};

/** Tool descriptor (name + description) with no live execution capability. */
export interface ToolDescriptor {
    name: string;
    description: string;
}

/**
 * Every tool's name and description, for consumers (ToolManager) that only need
 * to catalog tools, never execute them. Uses a stub `batch_execute` executor
 * since instantiating it does not invoke the callback.
 */
export function getAllToolDescriptors(): ToolDescriptor[] {
    return createAllTools(NOOP_EXECUTOR).map(t => ({ name: t.name, description: t.description }));
}
