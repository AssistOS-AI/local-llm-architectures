# local-llm-architectures

Declarative catalog of hardware-aware LLM runtime architectures consumed by
Ploinky. This repository contains JSON data and JSON Schemas only — Ploinky
must never execute code from this tree during architecture selection.

## Layout

```
catalog.json                    Catalog index. Lists architectures and images.
schemas/                        JSON Schemas describing each runtime-consumed file.
  catalog.schema.json
  architecture.schema.json
  image.schema.json
  runtime-policy.schema.json
architectures/                  One file per architecture id.
images/                         Image metadata referenced from architecture files.
build/                          Container build sources for image families/variants.
launchers/examples/             Example launcher scripts (not auto-discovered).
tests/                          Catalog and detection fixtures.
```

## Contract

- `catalog.json` lists architecture and image ids and resolves each id to a
  file path under `architectures/` or `images/`. Paths are relative and must
  not traverse outside the catalog root.
- Architectures declare `platform`, `accelerator`, `match`, `image`,
  `runtimePolicy`, and `engineDefaults`. Runtime policy fields are typed; raw
  arguments and unknown keys are rejected by the loader.
- Image metadata may use the literal template token `${AGENT_IMAGE_NAME}` in
  `ref`. Ploinky substitutes only validated identifiers (manifest `id` or
  active alias). It performs no shell-style expansion.
- Image entries may declare a `digest`. Releases should pin digests so that
  reuse hashing detects upgrades.

## Boundary

The catalog is data. Ploinky core owns hardware detection, selection,
container lifecycle, and runtime policy enforcement. Adding fields here that
require Ploinky to execute or interpret new container semantics requires a
matching DS spec change in `ploinky/docs/specs/DS012-...`.
