import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    loadCatalog,
    validateArchitectureRecord,
    validateImageRecord,
} from '../../../ploinky/cli/services/llmArchitectureCatalog.js';

const catalogRoot = path.resolve(import.meta.dirname, '..', '..');

test('catalog.json loads without errors', () => {
    const result = loadCatalog({ env: { PLOINKY_LLM_ARCHITECTURES_PATH: catalogRoot } });
    assert.equal(result.catalogId, 'local-llm-architectures/default');
});

test('every architecture file revalidates standalone', () => {
    const archDir = path.join(catalogRoot, 'architectures');
    const files = fs.readdirSync(archDir).filter((f) => f.endsWith('.json'));
    assert.ok(files.length >= 9, `expected at least 9 architectures, got ${files.length}`);
    for (const file of files) {
        const doc = JSON.parse(fs.readFileSync(path.join(archDir, file), 'utf8'));
        assert.doesNotThrow(() => validateArchitectureRecord(doc, file), `architecture ${file} failed validation`);
    }
});

test('every image file revalidates standalone', () => {
    const imgDir = path.join(catalogRoot, 'images');
    const files = fs.readdirSync(imgDir).filter((f) => f.endsWith('.json'));
    assert.ok(files.length >= 8, `expected at least 8 images, got ${files.length}`);
    for (const file of files) {
        const doc = JSON.parse(fs.readFileSync(path.join(imgDir, file), 'utf8'));
        assert.doesNotThrow(() => validateImageRecord(doc, file), `image ${file} failed validation`);
    }
});

test('every architecture has matching image metadata and platform', () => {
    const result = loadCatalog({ env: { PLOINKY_LLM_ARCHITECTURES_PATH: catalogRoot } });
    for (const [archId, arch] of result.architectures) {
        assert.ok(result.images.has(arch.image), `stable architecture '${archId}' references missing image '${arch.image}'`);
        const image = result.images.get(arch.image);
        assert.equal(image.platform, arch.platform, `architecture '${archId}' must reference an image for ${arch.platform}`);
    }
});

test('NVIDIA Docker and Podman policies are split by runtime', () => {
    const result = loadCatalog({ env: { PLOINKY_LLM_ARCHITECTURES_PATH: catalogRoot } });
    const dockerArch = result.architectures.get('nvidia-cuda-amd64');
    const podmanArch = result.architectures.get('nvidia-cuda-cdi-amd64');
    assert.deepEqual(dockerArch.match.containerRuntimes, ['docker']);
    assert.equal(dockerArch.runtimePolicy.gpus, 'all');
    assert.deepEqual(podmanArch.match.containerRuntimes, ['podman']);
    assert.deepEqual(podmanArch.runtimePolicy.devices, [{ type: 'cdi', value: 'nvidia.com/gpu=all' }]);
    assert.equal(podmanArch.runtimePolicy.gpus, undefined);
});

test('no architecture runtimePolicy declares forbidden fields', () => {
    const result = loadCatalog({ env: { PLOINKY_LLM_ARCHITECTURES_PATH: catalogRoot } });
    for (const [archId, arch] of result.architectures) {
        if (!arch.runtimePolicy) continue;
        const policy = JSON.stringify(arch.runtimePolicy);
        for (const banned of ['rawArgs', 'privileged', 'volumes', 'mounts', 'hostMounts']) {
            assert.ok(!policy.includes(`"${banned}"`), `architecture ${archId} runtimePolicy contains forbidden field '${banned}'`);
        }
    }
});
