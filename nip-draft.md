# NIP draft — moved

The canonical Dominion NIP lives in the [`forgesworn/nip-drafts`](https://github.com/forgesworn/nip-drafts) repository at [`nips/NIP-DOMINION.md`](https://github.com/forgesworn/nip-drafts/blob/main/nips/NIP-DOMINION.md), and is published on nostrhub.io as a kind 30817 event under the `nip-dominion` `d` tag.

This file used to contain a stale, stripped-down copy of the NIP that drifted from the canonical source. It has been replaced with this pointer to prevent confusion and to stop future contributors from accidentally publishing the wrong version.

When updating the NIP:

1. Edit `nips/NIP-DOMINION.md` in the `nip-drafts` repository
2. Run `scripts/publish.sh` from that repo with your signer to republish the kind 30817 event (the addressable `d` tag means a republish replaces the existing entry on nostrhub)
3. Commit and push the `nip-drafts` change

The protocol specification itself lives in [`spec/protocol.md`](spec/protocol.md) in this repository — that is the source of truth for the reference implementation. The NIP is a curated subset of the spec formatted for the Nostr ecosystem.
