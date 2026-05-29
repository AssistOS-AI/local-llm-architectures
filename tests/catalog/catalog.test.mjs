import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    CATALOG_VALIDATION_CONTRACT,
    loadCatalog,
    validateArchitectureRecord,
    validateImageRecord,
} from '../../../ploinky/cli/services/llmArchitectureCatalog.js';

const catalogRoot = path.resolve(import.meta.dirname, '..', '..');

function readSchema(name) {
    return JSON.parse(fs.readFileSync(path.join(catalogRoot, 'schemas', name), 'utf8'));
}

function sorted(value) {
    return Array.from(value || []).sort();
}

function propertyKeys(schemaNode) {
    return sorted(Object.keys(schemaNode?.properties || {}));
}

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

test('published schemas stay in parity with Ploinky catalog validation allowlists', () => {
    const catalogSchema = readSchema('catalog.schema.json');
    const architectureSchema = readSchema('architecture.schema.json');
    const imageSchema = readSchema('image.schema.json');
    const policySchema = readSchema('runtime-policy.schema.json');

    assert.deepEqual(propertyKeys(catalogSchema), sorted(CATALOG_VALIDATION_CONTRACT.catalogKeys));
    assert.deepEqual(
        propertyKeys(catalogSchema.properties.architectures.items),
        sorted(CATALOG_VALIDATION_CONTRACT.catalogEntryKeys),
    );
    assert.deepEqual(
        propertyKeys(catalogSchema.properties.images.items),
        sorted(CATALOG_VALIDATION_CONTRACT.catalogEntryKeys),
    );

    assert.deepEqual(propertyKeys(architectureSchema), sorted(CATALOG_VALIDATION_CONTRACT.architectureKeys));
    assert.deepEqual(
        sorted(architectureSchema.properties.status.enum),
        sorted(CATALOG_VALIDATION_CONTRACT.architectureStatuses),
    );
    assert.deepEqual(
        sorted(architectureSchema.properties.platform.enum),
        sorted(CATALOG_VALIDATION_CONTRACT.platforms),
    );
    assert.deepEqual(
        propertyKeys(architectureSchema.properties.accelerator),
        sorted(CATALOG_VALIDATION_CONTRACT.acceleratorKeys),
    );
    assert.deepEqual(
        sorted(architectureSchema.properties.accelerator.properties.family.enum),
        sorted(CATALOG_VALIDATION_CONTRACT.acceleratorFamilies),
    );
    assert.deepEqual(
        propertyKeys(architectureSchema.properties.match),
        sorted(CATALOG_VALIDATION_CONTRACT.matchKeys),
    );
    assert.deepEqual(
        sorted(architectureSchema.properties.match.properties.containerRuntimes.items.enum),
        sorted(CATALOG_VALIDATION_CONTRACT.containerRuntimes),
    );
    assert.deepEqual(
        propertyKeys(architectureSchema.properties.engineDefaults),
        sorted(CATALOG_VALIDATION_CONTRACT.engineDefaultKeys),
    );

    assert.deepEqual(propertyKeys(imageSchema), sorted(CATALOG_VALIDATION_CONTRACT.imageKeys));
    assert.deepEqual(
        sorted(imageSchema.properties.platform.enum),
        sorted(CATALOG_VALIDATION_CONTRACT.platforms),
    );
    assert.deepEqual(
        propertyKeys(imageSchema.properties.build),
        sorted(CATALOG_VALIDATION_CONTRACT.imageBuildKeys),
    );

    assert.deepEqual(propertyKeys(policySchema), sorted(CATALOG_VALIDATION_CONTRACT.runtimePolicyKeys));
    assert.deepEqual(
        sorted(policySchema.properties.platform.enum),
        sorted(CATALOG_VALIDATION_CONTRACT.platforms),
    );
    assert.deepEqual(
        propertyKeys(policySchema.properties.resources),
        sorted(CATALOG_VALIDATION_CONTRACT.resourceKeys),
    );
    assert.deepEqual(
        propertyKeys(policySchema.properties.resources.properties.ulimits),
        sorted(CATALOG_VALIDATION_CONTRACT.ulimitKeys),
    );
    assert.deepEqual(
        propertyKeys(policySchema.properties.resources.properties.ulimits.properties.memlock),
        sorted(CATALOG_VALIDATION_CONTRACT.memlockKeys),
    );
    assert.deepEqual(
        propertyKeys(policySchema.properties.devices.items),
        sorted(CATALOG_VALIDATION_CONTRACT.deviceKeys),
    );
    assert.deepEqual(
        sorted(policySchema.properties.devices.items.properties.type.enum),
        sorted(CATALOG_VALIDATION_CONTRACT.deviceTypes),
    );
    assert.deepEqual(
        sorted(policySchema.properties.securityOpt.items.enum),
        sorted(CATALOG_VALIDATION_CONTRACT.securityOpt),
    );
    assert.deepEqual(
        sorted(policySchema.properties.ipc.enum),
        sorted(CATALOG_VALIDATION_CONTRACT.ipc),
    );
});
