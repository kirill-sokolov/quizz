#!/bin/sh
set -e

echo "╔══════════════════════════════════════╗"
echo "║           API coverage               ║"
echo "╚══════════════════════════════════════╝"
docker exec wedding_api npm run test:coverage -- --reporter=verbose --coverage.reporter=text 2>&1 | grep -A 9999 "Coverage report"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║           Bot coverage               ║"
echo "╚══════════════════════════════════════╝"
docker exec wedding_bot npm run test:coverage -- --reporter=verbose --coverage.reporter=text 2>&1 | grep -A 9999 "Coverage report"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║           Web coverage               ║"
echo "╚══════════════════════════════════════╝"
docker exec wedding_web npm run test:coverage -- --reporter=verbose --coverage.reporter=text 2>&1 | grep -A 9999 "Coverage report"
