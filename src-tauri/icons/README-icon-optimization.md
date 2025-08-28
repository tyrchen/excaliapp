# OwnExcaliDesk 图标优化指南

## 当前配置
- ✅ 生成完整尺寸系列：16, 32, 64, 128, 256, 512px
- ✅ 更新tauri.conf.json包含所有尺寸
- ✅ 512x512提供最高清晰度支持

## 图标清晰度优化

### 1. 高DPI支持
当前配置自动支持：
- Retina显示器（2x DPI）
- 高分辨率显示器（3x DPI及以上）
- 系统自动选择最佳尺寸

### 2. SVG优化建议
保持源文件为矢量格式的优势：
```svg
<!-- 使用整数坐标避免模糊 -->
<rect x="8" y="8" width="16" height="16"/>

<!-- 避免非整数stroke-width -->
<circle stroke-width="2" /> <!-- 好 -->
<circle stroke-width="1.5" /> <!-- 可能模糊 -->
```

### 3. 生成命令
```bash
# 标准生成（所有平台格式）
npm run tauri icon src-tauri/icons/icon.svg

# 自定义高分辨率PNG
npx tauri icon src-tauri/icons/icon.svg --png 16,32,64,128,256,512

# 仅生成特定格式
npx tauri icon src-tauri/icons/icon.svg --png 512
```

### 4. 测试清晰度
- 在不同DPI设置下测试
- 在系统任务栏/dock中检查
- 在应用启动器中验证
- 确保小尺寸(16px)仍清晰可辨

### 5. 文件大小优化
当前512x512 PNG约为 ~8KB，已经很优化

## 应用内矢量图标使用

对于应用内部的图标，可以直接使用SVG：

```jsx
// React组件中使用SVG
import iconSvg from './icons/icon.svg';

function AppIcon() {
  return <img src={iconSvg} alt="OwnExcaliDesk" width="24" height="24" />;
}
```

这样在应用内部可以获得完美的矢量清晰度！