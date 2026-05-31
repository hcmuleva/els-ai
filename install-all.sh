#!/bin/bash

echo "Starting npm install in all directories with package.json..."

# Find all package.json files, excluding node_modules, and run npm i in their directory
find . -type f -name "package.json" -not -path "*/node_modules/*" | while read -r package_file; do
    dir=$(dirname "$package_file")
    echo "=========================================================="
    echo "Installing dependencies in $dir"
    echo "=========================================================="
    (cd "$dir" && npm i)
done

echo "Done!"
