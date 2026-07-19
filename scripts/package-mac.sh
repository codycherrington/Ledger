#!/bin/sh
# Builds Ledger.app and installs it to /Applications.
#
# The signing dance below matters: this repo lives in an iCloud-synced
# folder, and File Provider stamps SIP-protected extended attributes
# (com.apple.provenance, com.apple.fileprovider.*) onto the packaged
# bundle, which makes `codesign` fail with "resource fork, Finder
# information, or similar detritus not allowed". So we ditto the bundle
# to a non-synced temp dir without xattrs, ad-hoc sign it there, and
# install from that clean copy.
set -e
cd "$(dirname "$0")/.."

npm run app:build

STAGE_DIR="$(mktemp -d)"
STAGE="$STAGE_DIR/Ledger.app"
ditto --norsrc --noextattr --noqtn "release/mac-arm64/Ledger.app" "$STAGE"
codesign --force --deep --sign - "$STAGE"
codesign --verify --deep --strict "$STAGE"

rm -rf "/Applications/Ledger.app"
ditto "$STAGE" "/Applications/Ledger.app"
rm -rf "$STAGE_DIR"

echo "Installed: /Applications/Ledger.app"
