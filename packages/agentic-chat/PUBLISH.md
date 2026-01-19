# Publishing @shapeshiftoss/chat to npm

## Pre-Publish Checklist

### ✅ Completed
- [x] Package metadata configured (name, version, description, license)
- [x] README.md created with full documentation
- [x] LICENSE file added (MIT)
- [x] .npmignore configured to exclude source files
- [x] Build verified (dist/ folder created)
- [x] Unnecessary dependencies removed (@shapeshiftoss/agentic-server)
- [x] Package exports configured correctly
- [x] TypeScript declarations generated

### 📋 Before Publishing

1. **Audit the Code**
   ```bash
   # Review what will be published
   npm pack --dry-run

   # Check package size
   npm pack
   tar -tzf shapeshiftoss-chat-0.1.0.tgz
   ```

2. **Test the Package Locally**
   ```bash
   # Build the package
   bun run build

   # Verify types
   bun type-check

   # Create a tarball
   npm pack

   # In the main ShapeShift repo, test installation:
   # yarn add /path/to/shapeshiftoss-chat-0.1.0.tgz
   ```

3. **Verify Package Contents**
   - ✅ dist/ folder with .js and .d.ts files
   - ✅ README.md
   - ✅ LICENSE
   - ❌ NO src/ files (source excluded via .npmignore)
   - ❌ NO tsconfig.tsbuildinfo (excluded via .npmignore)
   - ❌ NO node_modules

## Publishing Commands

### First Time Setup

If you haven't published to npm under @shapeshiftoss before:

```bash
# Login to npm (you'll need ShapeShift npm org access)
npm login

# Verify you're logged in
npm whoami

# Verify org access
npm org ls shapeshiftoss
```

### Publish to npm

```bash
# From packages/agentic-chat/ directory:

# 1. Ensure you're on main branch with clean working directory
git status

# 2. Build the package (runs automatically via prepublishOnly, but good to verify)
bun run build

# 3. DRY RUN - See what would be published (RECOMMENDED FIRST)
npm publish --dry-run

# 4. Publish to npm (PUBLIC package)
npm publish --access public
```

### Post-Publish Verification

```bash
# Check it's published
npm view @shapeshiftoss/chat

# Verify version
npm view @shapeshiftoss/chat version

# Test installation in a fresh directory
mkdir test-install && cd test-install
npm init -y
npm install @shapeshiftoss/chat
cat node_modules/@shapeshiftoss/chat/package.json
```

## Version Management

For future updates:

```bash
# Patch version (0.1.0 -> 0.1.1) - bug fixes
npm version patch

# Minor version (0.1.0 -> 0.2.0) - new features, backwards compatible
npm version minor

# Major version (0.1.0 -> 1.0.0) - breaking changes
npm version major

# Then publish
npm publish --access public
```

## Troubleshooting

### "You do not have permission to publish"
- Ensure you're logged in: `npm whoami`
- Verify org membership: `npm org ls shapeshiftoss`
- Contact ShapeShift team for access

### "Version 0.1.0 already exists"
- Bump version: `npm version patch`
- Or manually edit package.json version
- Then publish again

### "Package name too similar to existing package"
- This shouldn't happen with @shapeshiftoss scope
- Contact npm support if needed

### Build fails during prepublishOnly
- Run `bun run build` manually to see errors
- Check TypeScript configuration
- Verify all imports are correct

## Package Info

- **Name**: @shapeshiftoss/chat
- **Current Version**: 0.1.0
- **License**: MIT
- **Visibility**: Public
- **Registry**: <https://registry.npmjs.org/>
- **Package URL**: <https://www.npmjs.com/package/@shapeshiftoss/chat> (after publishing)

## What Gets Published

### Included:
- `dist/` - Compiled JavaScript and TypeScript declarations
- `README.md` - Package documentation
- `LICENSE` - MIT license
- `package.json` - Package metadata

### Excluded (via .npmignore):
- `src/` - Source TypeScript files
- `tsconfig.json` - TypeScript configuration
- `*.tsbuildinfo` - TypeScript build cache
- `node_modules/` - Dependencies
- Development files

## Final Command Summary

```bash
# Review what will be published
npm pack --dry-run

# Publish to npm (PUBLIC)
npm publish --access public

# Verify
npm view @shapeshiftoss/chat
```

---

**Ready to publish when you are!** Just run the commands above after auditing the code.
