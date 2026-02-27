#!/bin/sh
set -e

echo "=== API tests ==="
docker exec wedding_api npm run test

echo ""
echo "=== Bot tests ==="
docker exec wedding_bot npm run test

echo ""
echo "=== Web unit/integration tests ==="
docker exec wedding_web npm run test

echo ""
echo "=== E2E Playwright tests ==="
cd "$(dirname "$0")/apps/web"
npm run e2e

echo ""
echo "=== All tests passed ==="
