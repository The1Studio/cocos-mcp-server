import * as fs from 'fs';
import * as path from 'path';
import { ActionToolResult, successResult, errorResult } from '../types';

/** Audio file extensions */
const AUDIO_EXTS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac']);
/** Texture file extensions */
const TEXTURE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tga']);
/** Directories to skip */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'temp', 'library', 'build', 'native']);

/** Recursively walk files matching given extensions */
function walkFiles(dir: string, extensions: Set<string>): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...walkFiles(fullPath, extensions));
        else if (extensions.has(path.extname(entry.name).toLowerCase())) results.push(fullPath);
    }
    return results;
}

/** Resolve directory: support db:// URLs and relative paths */
function resolveDir(directory: string): string {
    if (directory.startsWith('db://')) {
        return path.join(Editor.Project.path, directory.replace('db://', ''));
    }
    if (path.isAbsolute(directory)) return directory;
    return path.join(Editor.Project.path, directory);
}

/** Deep merge source into target (arrays replaced, not merged) */
function deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
            && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
            result[key] = deepMerge(target[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

/** Get audio file statistics */
export async function getAudioStats(directory: string = 'db://assets'): Promise<ActionToolResult> {
    const dir = resolveDir(directory);
    const files = walkFiles(dir, AUDIO_EXTS);
    const audioFiles = files.map(file => {
        const stat = fs.statSync(file);
        return {
            name: path.basename(file),
            path: path.relative(Editor.Project.path, file),
            extension: path.extname(file),
            sizeBytes: stat.size,
            sizeKB: +(stat.size / 1024).toFixed(1)
        };
    }).sort((a, b) => b.sizeBytes - a.sizeBytes);

    const totalBytes = audioFiles.reduce((sum, f) => sum + f.sizeBytes, 0);
    return successResult({
        files: audioFiles,
        summary: { totalFiles: audioFiles.length, totalBytes, totalKB: +(totalBytes / 1024).toFixed(1) }
    }, `Found ${audioFiles.length} audio files (${+(totalBytes / 1024).toFixed(1)} KB total)`);
}

/** Get texture file statistics with compression info from .meta files */
export async function getTextureStats(directory: string = 'db://assets'): Promise<ActionToolResult> {
    const dir = resolveDir(directory);
    const files = walkFiles(dir, TEXTURE_EXTS);
    let withCompression = 0, withoutCompression = 0;

    const textureFiles = files.map(file => {
        const stat = fs.statSync(file);
        const metaPath = `${file}.meta`;
        let hasCompression = false;
        let presetId: string | null = null;

        if (fs.existsSync(metaPath)) {
            try {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                const cs = meta?.userData?.compressSettings;
                hasCompression = cs?.useCompressTexture === true;
                presetId = cs?.presetId || null;
            } catch { /* skip malformed meta */ }
        }
        hasCompression ? withCompression++ : withoutCompression++;

        return {
            name: path.basename(file),
            path: path.relative(Editor.Project.path, file),
            extension: path.extname(file),
            sizeBytes: stat.size,
            sizeKB: +(stat.size / 1024).toFixed(1),
            hasCompression,
            presetId
        };
    }).sort((a, b) => b.sizeBytes - a.sizeBytes);

    const totalBytes = textureFiles.reduce((sum, f) => sum + f.sizeBytes, 0);
    return successResult({
        files: textureFiles,
        summary: { totalFiles: textureFiles.length, totalBytes, totalKB: +(totalBytes / 1024).toFixed(1), withCompression, withoutCompression }
    }, `Found ${textureFiles.length} textures: ${withCompression} compressed, ${withoutCompression} uncompressed`);
}

/** Update a .meta file's properties and trigger reimport */
export async function updateMeta(assetPath: string, metaData: any): Promise<ActionToolResult> {
    if (!assetPath || !metaData) return errorResult('assetPath and metaData are required');

    // Resolve to absolute path
    let absPath: string;
    if (assetPath.startsWith('db://')) {
        absPath = path.join(Editor.Project.path, assetPath.replace('db://', ''));
    } else if (assetPath.startsWith('assets/')) {
        absPath = path.join(Editor.Project.path, assetPath);
    } else {
        return errorResult('assetPath must start with db:// or assets/');
    }

    const metaFilePath = `${absPath}.meta`;
    if (!fs.existsSync(metaFilePath)) return errorResult(`Meta file not found: ${metaFilePath}`);

    const existing = JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));
    const merged = deepMerge(existing, metaData);
    fs.writeFileSync(metaFilePath, JSON.stringify(merged, null, 2));

    // Trigger reimport via Editor API
    const dbUrl = assetPath.startsWith('db://') ? assetPath : `db://${assetPath}`;
    try {
        await Editor.Message.request('asset-db', 'reimport-asset', dbUrl);
    } catch { /* reimport may fail if Editor not focused; meta is still updated */ }

    return successResult({
        metaFile: path.relative(Editor.Project.path, metaFilePath),
        updated: Object.keys(metaData)
    }, `Meta updated: ${path.basename(metaFilePath)}`);
}

/** Apply compression preset to texture .meta files in directory */
export async function compressTextures(
    directory: string = 'db://assets', presetId: string = '', quality: number = 0.8
): Promise<ActionToolResult> {
    if (!presetId) return errorResult('presetId is required (check builder.json textureCompressConfig.userPreset for available IDs)');

    const dir = resolveDir(directory);
    const files = walkFiles(dir, TEXTURE_EXTS);
    let processed = 0, skipped = 0;
    const errors: string[] = [];

    for (const file of files) {
        const metaPath = `${file}.meta`;
        if (!fs.existsSync(metaPath)) { skipped++; continue; }

        try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            // Skip if already using this preset
            if (meta?.userData?.compressSettings?.presetId === presetId) { skipped++; continue; }
            // Set compression settings
            if (!meta.userData) meta.userData = {};
            meta.userData.compressSettings = { useCompressTexture: true, presetId };
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

            // Trigger reimport
            const relativePath = path.relative(Editor.Project.path, file);
            try { await Editor.Message.request('asset-db', 'reimport-asset', `db://${relativePath}`); }
            catch { /* continue even if reimport fails */ }
            processed++;
        } catch (e: any) {
            errors.push(`${path.basename(file)}: ${e.message}`);
        }
    }

    return successResult({ processed, skipped, errors: errors.length, errorDetails: errors.slice(0, 10) },
        `Compressed ${processed} textures, skipped ${skipped}, errors ${errors.length}`);
}
