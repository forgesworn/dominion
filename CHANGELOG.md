## [1.1.1](https://github.com/forgesworn/dominion/compare/v1.1.0...v1.1.1) (2026-04-12)


### Bug Fixes

* resolve development dependency vulnerabilities ([8248b89](https://github.com/forgesworn/dominion/commit/8248b897436d9d3836cf4647e2c88bca67c214bc))

# [1.1.0](https://github.com/forgesworn/dominion/compare/v1.0.0...v1.1.0) (2026-04-10)


### Features

* **epochs:** add daily and monthly epoch ID helpers ([57cbfc3](https://github.com/forgesworn/dominion/commit/57cbfc35a0bf6b814b3c69a8c7c5a849194783a2))

# 1.0.0 (2026-03-31)


### Bug Fixes

* add prepare script for git URL installs ([9f5b573](https://github.com/forgesworn/dominion/commit/9f5b5733940f9e40998be3ee5a98cb9d922c5104))
* bump CI minimum Node to 20, remove NPM_TOKEN ([6685d3d](https://github.com/forgesworn/dominion/commit/6685d3dfed9a284c50067ce00576f422eb0c3825))
* close remaining LOW findings — builder/parser/filter input validation ([bd77f74](https://github.com/forgesworn/dominion/commit/bd77f742a7dbdf3d85ba57cdf029c5d8354c63d9))
* harden input validation and close prototype pollution vector ([18fbe2d](https://github.com/forgesworn/dominion/commit/18fbe2d0a647e8df5f98476ea202477558adf98b))
* holodeck audit — validation, portability, spec alignment, adversarial tests ([3f8c8a8](https://github.com/forgesworn/dominion/commit/3f8c8a8653037493050cd65d2a35b52acdbb0f38))
* rename HKDF salt from vaulstr-ck-v1 to dominion-ck-v1 ([d4424b7](https://github.com/forgesworn/dominion/commit/d4424b7b602a031831c77a869d5d1bf3eccb15ba))
* security audit — GF(256) bounds, input validation, prototype pollution, parser hardening ([1e53db6](https://github.com/forgesworn/dominion/commit/1e53db69ed136e3bd6f04e03e2bdabbe702bb746))
* security audit pass 2 — filter bug, deep validation, parameter alignment ([398504e](https://github.com/forgesworn/dominion/commit/398504e1b0cd48ecd5d7c129315ba3bacd25530a)), closes [#d](https://github.com/forgesworn/dominion/issues/d)
* update @noble/ciphers to v2 (import paths and randomBytes location) ([17a2348](https://github.com/forgesworn/dominion/commit/17a234882c0b7b3cb7f7b63e4421e5c84e8a75f9))
* validate share index range (1-255) in combineShares ([121f6a6](https://github.com/forgesworn/dominion/commit/121f6a64c29707122d13bb89a552f1dd23715d34))


### Features

* add semantic-release, CI workflow, and llms.txt ([9684b72](https://github.com/forgesworn/dominion/commit/9684b72bb40df6dadefc6ce813a49acb7a294b82))
* add types and constants ([38d8a57](https://github.com/forgesworn/dominion/commit/38d8a5721996d6d5ab6155b3a10c99b18a3094f6))
* AES-256-GCM encrypt/decrypt with @noble/ciphers ([f75c9e2](https://github.com/forgesworn/dominion/commit/f75c9e2e91dc9805ae62075d5ea02bef71f0c553))
* Biome linter, security hardening, spec enhancements, expanded tests ([771d6ed](https://github.com/forgesworn/dominion/commit/771d6edfd2369fbad7cae3b55185aa01ad5f077a))
* CK splitting helpers with encode/decode ([1760fec](https://github.com/forgesworn/dominion/commit/1760fec534c0fdc4ab3cfff9b06a7807e2a00c55))
* content key derivation with HKDF-SHA256 ([a907708](https://github.com/forgesworn/dominion/commit/a907708bbeabdfdf6f9fca64d48fcf5e2e2f9bec))
* immutable config mutations for tier management ([16b5630](https://github.com/forgesworn/dominion/commit/16b5630067a04c1291f4ffe9a0dd7535412718b3))
* index files and build verification ([ea9ff0a](https://github.com/forgesworn/dominion/commit/ea9ff0a32f25ad7f5a2bc9154a6eaffbea900ea1))
* interactive SVG explainer for CTOs and technical decision-makers ([c9b9ebb](https://github.com/forgesworn/dominion/commit/c9b9ebbd4a2cd58772ca96345c0ab10658a39e24))
* kind 30480 vault share event builder/parser ([458a55c](https://github.com/forgesworn/dominion/commit/458a55c734950e13462bce84c5a3894320fb16ad))
* kind 30481 vault config event builder/parser ([570995c](https://github.com/forgesworn/dominion/commit/570995cdc0c25c189ba77938d2ccdeeced5b68a1))
* security audit, NIP review fixes, AI discoverability ([f20a89e](https://github.com/forgesworn/dominion/commit/f20a89eaa642485d5e64da3ddf0f87c5c2b87103))
* Shamir secret sharing over GF(256) ([f781d6f](https://github.com/forgesworn/dominion/commit/f781d6feb369bd3fee626cbdedbc511a8c3e6b7f))
