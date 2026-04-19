#!/bin/bash
# jira2claw 打包发布脚本
# 只上传 tgz 到 GitHub Release，不推送源码
set -e

# 1. 从 package.json 读取版本号
VERSION=$(node -p "require('./package.json').version")
echo "==> Version: $VERSION"

# 2. 同步版本号到 src/cli/index.ts（防止版本不同步）
sed -i '' "s/\.version('[^']*')/\.version('$VERSION')/" src/cli/index.ts
echo "==> Synced version to src/cli/index.ts"

# 3. 编译
npm run build
echo "==> Build complete"

# 4. 打包（package.json files 字段已排除 .map 和 src/）
TGZ="jira2claw-cli-${VERSION}.tgz"
npm pack
echo "==> Packed $TGZ"

# 5. 安全检查：确保不含 .map 文件和鉴权信息
MAP_COUNT=$(tar tzf "$TGZ" | grep -c '\.map' || true)
if [ "$MAP_COUNT" -gt 0 ]; then
  echo "ERROR: tgz contains .map files!"
  exit 1
fi

SECRET_CHECK=$(tar xzf "$TGZ" -O package/package.json 2>/dev/null | grep -cE '"(pat|cfClientSecret|cfCookie)"\s*:\s*"[^"]+"' || true)
if [ "$SECRET_CHECK" -gt 0 ]; then
  echo "ERROR: package.json contains secrets!"
  exit 1
fi

echo "==> Security check passed (no .map, no secrets)"

# 6. 上传到 GitHub Release
if gh release view "v$VERSION" --repo fightmonster/j2c > /dev/null 2>&1; then
  echo "==> Release v$VERSION exists, updating..."
  gh release upload "v$VERSION" "$TGZ" --repo fightmonster/j2c --clobber
else
  echo "==> Creating release v$VERSION..."
  gh release create "v$VERSION" "$TGZ" \
    --repo fightmonster/j2c \
    --title "v$VERSION" \
    --generate-notes
fi

echo ""
echo "==> Done! https://github.com/fightmonster/j2c/releases/tag/v$VERSION"
echo "==> Install: npm install -g https://github.com/fightmonster/j2c/releases/download/v$VERSION/$TGZ"
