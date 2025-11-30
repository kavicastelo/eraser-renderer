#!/bin/bash
echo "Copying built package declaration files..."

# Destination paths relative to the root /vercel/path0
CORE_DEST="/vercel/path0/packages/core"
VIEWER_DEST="/vercel/path0/packages/viewer"

# Copy core dist contents to its root package folder 
# (ng-packagr often expects to find the files right next to package.json)
cp -r packages/core/dist/* $CORE_DEST/
cp -r packages/viewer/dist/* $VIEWER_DEST/

echo "Finished copying types."