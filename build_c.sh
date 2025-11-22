#!/bin/bash

# Build script for C Dijkstra implementation
echo "🔨 Building C Dijkstra program..."

cd "$(dirname "$0")/src/backend"

# Compile C program
gcc -o dijkstra_c dijkstra_c.c -lm -O3

if [ $? -eq 0 ]; then
    echo "✅ C program compiled successfully!"
    echo "📍 Executable: src/backend/dijkstra_c"
else
    echo "❌ Compilation failed!"
    exit 1
fi

echo "🚀 Ready to use C implementation!"
