# FieldGrow 图标设计说明

> 产出流程: [op7418/logo-generator-skill](https://github.com/op7418/logo-generator-skill)(SVG 变体探索 → 评审迭代 → 导出交付)

## 设计简报 (Brief)

- **产品**: FieldGrow — 地推拓客桌面端(高德地图检索商户、客户池跟进、数据导出)
- **品牌语义**: **Field(区域/田野/地推覆盖) × Grow(生长/拓客增长)**
- **设计语言**(与 App UI 对齐): 墨绿深底(`#101915`→`#0A3D2B` 渐变)、翠绿强调 `#34D399`、近白 `#F0F6F3`、圆角容器、玻璃拟态、极简线性图标
- **约束**: 单色可用、16px 仍可辨、避免与 WiFi/笑脸等常见图形撞脸

## 方案探索(6 个变体,均为 `viewBox 0 0 100 100` + `currentColor`)

| 文件 | 名称 | 概念 | 评审 |
|---|---|---|---|
| `variant-01-growth-pin.svg` | Growth Pin 点位生长 | 地图点位轮廓内一株新芽 = 落点×增长 | ✅ **选定** |
| `variant-02-leaf-compass.svg` | Leaf Compass 叶之罗盘 | 圆环 + 对角叶片,指南针/取景框意象 | 备选,语义偏"导航" |
| `variant-03-field-rows.svg` | Field Rows 田垄生长 | 三道田垄 + 破土新芽,深耕意象 | 备选,小尺寸细节偏多 |
| `variant-04-beacon.svg` | Ripple Point 落点涟漪 | 落点 + 浅弧涟漪,商圈辐射 | 二轮迭代后成立(初版像 WiFi,二版像笑脸) |
| `variant-05-route-growth.svg` | Route Growth 扫街路线 | S 形路线节点逐级生长 | 概念好,重心偏斜 |
| `variant-06-grid-field.svg` | Grid Field 网格田野 | 三格点位 + 一格长成叶(网格深扫隐喻) | 二轮简化后成立 |

## 当前应用图标(v0.2.6+): 3D 地图导航图标

`final-app-icon-3d.png` —— 用户提供的 3D 风格图标(地图点位 × 商户 × 客户卡),经以下处理后作为应用图标:

1. **去白边**: 源图外层是白色画布 + 3D 白色光泽边框,按"非近白"严格阈值裁进彩色本体,并取正方形居中裁切(1007px)
2. **透明圆角**: 估算圆角半径(≈18.4%)生成 alpha 蒙版,四角透明,深/浅底都无白边
3. **全量替换**: `src-tauri/icons/*`(Win .ico / macOS .icns / Linux / iOS / Android)、`public/logo.png`

源图保留在 `蓝色地图导航与店铺定位图标.png`;处理脚本思路: 边缘扫描 bbox → 收缩防锯齿 → 圆角蒙版 `dest-in`。

以下为此前的设计探索(Growth Pin 方案,仍可作单色备选):

## 定稿: Growth Pin(点位生长)

**为什么是它**

1. **语义直译**: 点位(地推落点/门店)里长出新芽(Growth)= FieldGrow 两个词根一次说清
2. **小尺寸最强**: 轮廓剪影(水滴 pin)在 16–32px 任务栏/托盘下仍是地图 pin,不糊
3. **单色安全**: 全部实心/描边,无白色挖槽、无渐变依赖,传真/钢印/单色菜单栏都成立
4. **与产品同构**: App 内地图大头针(marker)本身就是 pin 形,图标即产品符号

**绘制要点**

- pin 外轮廓: 描边 4–4.5,`stroke-linejoin: round`,头部正圆 A23 强调"圆润负空间"
- 新芽: 一根茎 + 两片不对称叶(左叶低、右叶高),避免呆板对称;叶片实心保证小尺寸
- 容器: `rx=22` 圆角方,135° 墨绿渐变 + 顶部 10% 白色 sheen,与 App 玻璃面板质感一致
- 色彩: pin 近白 `#F0F6F3`,新芽翠绿 `#34D399`(App 强调色)

## 交付物

| 文件 | 用途 |
|---|---|
| `final-app-icon.svg` | 源文件(100×100 含容器) |
| `final-app-icon.png` | 1024×1024 主渲染 |
| `../public/logo.png` | README / 官网用 256px |
| `../../src-tauri/icons/*` | `npx tauri icon` 生成的全平台图标(Win .ico / macOS .icns / Linux png / iOS / Android) |
| `variant-0*.svg/.png` | 6 个探索方案(单色,`currentColor`) |
| `_contact-sheet.png` | 方案对比总览 |
| `showcase.html` | 浏览器打开即可看全部方案在浅/深底、多尺寸下的表现 |

> 注: skill 的 Nano Banana 展示图生成需要 `GEMINI_API_KEY`,本机未配置,故以 `showcase.html` + PNG 渲染交付;如需 AI 氛围图可配好 key 后补充。

## 单色用法

变体 SVG 均以 `currentColor` 继承文字色:

```html
<span style="color:#34D399"><!-- inline variant-01.svg --></span>
```

定稿图标固定配色(容器+双色),如需纯单色版: 取 `variant-01-growth-pin.svg` 直接用。
