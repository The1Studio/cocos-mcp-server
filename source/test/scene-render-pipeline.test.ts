/**
 * Regression tests for issues #77 and #98 — both live in the scene-context
 * methods (`source/scene.ts`) that the manage_render_pipeline tool calls via
 * `Editor.Message.request('scene', 'execute-scene-script', ...)`.
 *
 * These methods only run inside the Cocos Creator scene process, where a real
 * `cc` module is available. Outside the editor `cc` does not exist as an
 * npm package, so it is mocked here as a virtual module reproducing just the
 * shapes `scene.ts` touches (`director.getScene()`, `Color`, `Vec4`,
 * `FogInfo.FogType`).
 *
 * #77 — `setFogSettings` assigned the caller's raw string (e.g.
 * `"FogType.LINEAR"`) straight onto `fog.type`, which Cocos expects as the
 * numeric `cc.FogInfo.FogType` enum. A string there breaks the whole 3D fog
 * (and, per the report, made the layer render blank).
 *
 * #98 — `manage_render_pipeline` had `set_shadow`/`set_fog`/`set_skybox`/
 * `set_post_process` but no `set_ambient`, even though
 * `getRenderPipelineInfo` already reads (and labels) `scene.globals
 * .environment.{skyColor, groundAlbedo}` as "ambient". `setAmbientSettings`
 * must write to that same `environment` global, not a separate `.ambient`.
 */

import * as os from 'os';

class FakeColor {
    constructor(public r = 0, public g = 0, public b = 0, public a = 255) {}
}

class FakeVec4 {
    x = 0;
    y = 0;
    z = 0;
    w = 0;
    constructor(x = 0, y = 0, z = 0, w = 0) {
        this.x = x; this.y = y; this.z = z; this.w = w;
    }
    static fromColor(out: FakeVec4, color: FakeColor): FakeVec4 {
        out.x = color.r / 255;
        out.y = color.g / 255;
        out.z = color.b / 255;
        out.w = color.a / 255;
        return out;
    }
}

const FogType = { LINEAR: 0, EXP: 1, EXP_SQUARED: 2, LAYERED: 3 };

let sceneGlobals: any;

jest.mock('cc', () => ({
    director: { getScene: () => ({ globals: sceneGlobals }) },
    Color: FakeColor,
    Vec4: FakeVec4,
    FogInfo: { FogType },
}), { virtual: true });

describe('scene.ts render pipeline methods', () => {
    let methods: { [key: string]: (...args: any[]) => any };

    beforeAll(() => {
        // scene.ts pushes Editor.App.path onto module.paths at import time;
        // the shared editor mock does not stub Editor.App.
        (global as any).Editor.App = { path: os.tmpdir() };
        methods = require('../scene').methods;
    });

    beforeEach(() => {
        sceneGlobals = {
            fog: { enabled: false, type: 0, fogStart: 0, fogEnd: 0, fogDensity: 0, fogColor: new FakeColor() },
            environment: { skyColor: new FakeVec4(), skyIllum: 0, groundAlbedo: new FakeVec4() },
        };
    });

    describe('setFogSettings — #77 fog type enum', () => {
        it('maps a bare enum name ("LINEAR") to its numeric value', () => {
            const result = methods.setFogSettings(undefined, undefined, 'LINEAR', undefined, undefined, undefined);
            expect(result.success).toBe(true);
            expect(result.data.type).toBe(FogType.LINEAR);
            expect(typeof sceneGlobals.fog.type).toBe('number');
        });

        it('maps the "FogType.EXP_SQUARED" form to its numeric value', () => {
            const result = methods.setFogSettings(undefined, undefined, 'FogType.EXP_SQUARED', undefined, undefined, undefined);
            expect(result.success).toBe(true);
            expect(result.data.type).toBe(FogType.EXP_SQUARED);
        });

        it('accepts an already-numeric type unchanged', () => {
            const result = methods.setFogSettings(undefined, undefined, 2, undefined, undefined, undefined);
            expect(result.success).toBe(true);
            expect(result.data.type).toBe(2);
        });

        it('accepts a numeric string ("1") for EXP', () => {
            const result = methods.setFogSettings(undefined, undefined, '1', undefined, undefined, undefined);
            expect(result.success).toBe(true);
            expect(result.data.type).toBe(FogType.EXP);
        });

        it('rejects an unrecognized fog type instead of writing it through', () => {
            const result = methods.setFogSettings(undefined, undefined, 'NOT_A_FOG_TYPE', undefined, undefined, undefined);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/fog type/i);
            // the bad value must never reach the engine field
            expect(sceneGlobals.fog.type).toBe(0);
        });

        it('leaves fogDensity assignment untouched (already correctly guarded)', () => {
            const result = methods.setFogSettings(undefined, undefined, undefined, undefined, undefined, 0.75);
            expect(result.success).toBe(true);
            expect(result.data.fogDensity).toBe(0.75);
        });
    });

    describe('setAmbientSettings — #98 missing set_ambient action', () => {
        it('exists as a callable method on scene.ts', () => {
            expect(typeof methods.setAmbientSettings).toBe('function');
        });

        it('writes skyIllum onto scene.globals.environment, not a separate .ambient', () => {
            const result = methods.setAmbientSettings(undefined, undefined, 2.5);
            expect(result.success).toBe(true);
            expect(sceneGlobals.environment.skyIllum).toBe(2.5);
            expect(sceneGlobals.ambient).toBeUndefined();
        });

        it('writes skyColor onto scene.globals.environment from a hex string', () => {
            const result = methods.setAmbientSettings('#804020', undefined, undefined);
            expect(result.success).toBe(true);
            expect(sceneGlobals.environment.skyColor.x).toBeCloseTo(0x80 / 255);
            expect(sceneGlobals.environment.skyColor.y).toBeCloseTo(0x40 / 255);
            expect(sceneGlobals.environment.skyColor.z).toBeCloseTo(0x20 / 255);
        });

        it('writes groundAlbedo onto scene.globals.environment from a hex string', () => {
            const result = methods.setAmbientSettings(undefined, '#102030', undefined);
            expect(result.success).toBe(true);
            expect(sceneGlobals.environment.groundAlbedo.x).toBeCloseTo(0x10 / 255);
            expect(sceneGlobals.environment.groundAlbedo.y).toBeCloseTo(0x20 / 255);
            expect(sceneGlobals.environment.groundAlbedo.z).toBeCloseTo(0x30 / 255);
        });

        it('errors when the environment global is unavailable', () => {
            sceneGlobals.environment = undefined;
            const result = methods.setAmbientSettings(undefined, undefined, 1);
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/ambient|environment/i);
        });
    });
});
