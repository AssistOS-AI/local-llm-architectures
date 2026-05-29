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

## Architecture ids

Architecture ids are the values users pass to Ploinky through
`PLOINKY_LLM_ARCHITECTURE_ID`. They must be literal ids from this catalog and
match `[a-z0-9][a-z0-9._-]{0,63}`.

Recommended format:

```text
<accelerator-family>[-runtime-or-backend-variant]-<cpu-architecture>
```

The accelerator is included in the id by convention for readability, but the
authoritative accelerator remains the architecture record's
`accelerator.family` field. Ploinky validates the id against that field, the
OCI platform, required probes, container runtime compatibility, image platform,
and runtime policy before using an override.

Examples:

| Architecture id | Accelerator | Platform | Notes |
| --- | --- | --- | --- |
| `cpu-amd64` | `cpu` | `linux/amd64` | CPU fallback. |
| `cpu-arm64` | `cpu` | `linux/arm64` | CPU fallback. |
| `nvidia-cuda-amd64` | `nvidia-cuda` | `linux/amd64` | Docker `--gpus` policy. |
| `nvidia-cuda-cdi-amd64` | `nvidia-cuda` | `linux/amd64` | Podman NVIDIA CDI policy. |
| `amd-rocm-amd64` | `amd-rocm` | `linux/amd64` | ROCm devices. |
| `intel-openvino-amd64` | `intel-openvino` | `linux/amd64` | Intel/OpenVINO devices. |
| `vulkan-amd64` | `vulkan` | `linux/amd64` | Vulkan backend. |
| `vulkan-arm64` | `vulkan` | `linux/arm64` | Experimental Vulkan backend. |

Usage:

```bash
PLOINKY_LLM_ARCHITECTURE_ID=cpu-amd64 ploinky start base-local
PLOINKY_LLM_ARCHITECTURE_ID=nvidia-cuda-amd64 ploinky start planning-local
PLOINKY_LLM_ARCHITECTURE_ID=nvidia-cuda-cdi-amd64 ploinky start planning-local
```

## Boundary

The catalog is data. Ploinky core owns hardware detection, selection,
container lifecycle, and runtime policy enforcement. Adding fields here that
require Ploinky to execute or interpret new container semantics requires a
matching DS spec change in `ploinky/docs/specs/DS012-...`.
