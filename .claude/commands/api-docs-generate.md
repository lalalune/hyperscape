Generate comprehensive API documentation from code annotations.

## Instructions

```bash
echo "📚 Generating API Documentation..."

# OpenAPI/Swagger (Node.js)
if [ -f "package.json" ] && grep -q "swagger" package.json; then
  npx swagger-jsdoc -d swaggerDef.js -o openapi.json src/**/*.js
  npx redoc-cli bundle openapi.json -o docs/api.html
  echo "✅ OpenAPI docs generated: docs/api.html"
fi

# JSDoc (JavaScript)
if [ -f "jsdoc.json" ]; then
  npx jsdoc -c jsdoc.json
  echo "✅ JSDoc generated: docs/index.html"
fi

# TypeDoc (TypeScript)
if [ -f "tsconfig.json" ]; then
  npx typedoc --out docs src
  echo "✅ TypeDoc generated: docs/index.html"
fi

# Sphinx (Python)
if [ -f "docs/conf.py" ]; then
  cd docs && make html && cd ..
  echo "✅ Sphinx docs generated: docs/_build/html/index.html"
fi

echo ""
echo "View docs:"
echo "  open docs/index.html"
```
