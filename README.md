<div align="center">

<img src="public/logo.png" width="96" alt="FieldGrow Logo" />

# FieldGrow · 地推拓客利器

**地图商户检索 · 商户信息管理 · 一键导出**

一款面向地推 / 拓客场景的跨平台桌面工具:在地图上快速找到目标商户,
沉淀进客户池跟进,导出拜访清单 —— 轻量、离线友好、界面高级。

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-34d399)
![Tauri](https://img.shields.io/badge/Tauri%202-Rust-24c8db?logo=tauri)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## ✨ 功能一览

| 模块 | 说明 |
|---|---|
| **多模式商户检索** | 关键词 + 城市/区县检索 / 地图拖拽框选矩形商圈 / 中心点 + 半径周边扫街(圆形范围可视化),三种方式自由组合 |
| **区县筛选** | 按区/县过滤结果,导出的行政区划唯一不混杂 |
| **网格深扫** | 框选/周边区域自动切成 2×2、3×3 小格逐格检索,突破单次检索截断,抓得更全 |
| **多关键词并集** | 一次最多 3 个关键词(如 `咖啡店,奶茶,烘焙`),自动去重合并 |
| **商户信息** | 店名 / 地址 / 电话(自动区分座机·手机)/ 评分 / 类型 / 经纬度;详情页含营业时间、人均、别名、全部电话 |
| **地图可视化** | 高德 JS 地图打点、拖拽框选范围、点选周边中心点(未配置时优雅降级,检索不受影响) |
| **客户池** | 星标收藏商户,状态流转(待跟进/已联系/有意向/已合作/无效)+ 备注,导出拜访清单 |
| **一键导出** | Excel(.xlsx)/ CSV(UTF-8 BOM),选中导出 / 整页导出 / 客户池导出 |
| **配额与节流** | 每日调用上限到顶自动停止、约 3 QPS 节流、调用日志全量留痕 |
| **Key 自助配置** | 高德 Key 在界面输入,仅存本机,不经过任何第三方服务器 |
| **深浅双主题** | 深色为外勤优化,浅色适合办公室;一键切换 |

## 🧭 设计原则(合规)

FieldGrow 遵守高德开放平台协议,并在产品层面强约束:

- **仅人工发起检索**:无批量抓取、无爬虫、无全量拉取接口
- **单页 ≤ 50 条 / 单次 ≤ 3 关键词**:从 UI 到协议层双重限制
- **人工筛选**:结果由人勾选后再收藏 / 导出,不提供自动全量入库
- **临时数据**:检索结果仅本地临时展示;客户池数据可一键清空
- **调用留痕**:每次 API 调用记录端点、结果与报错,可追溯

## 🚀 快速开始

### 安装包(推荐)

前往 [Releases](https://github.com/SmiLeXio/FieldGrow/releases) 下载对应平台安装包:

- Windows:`FieldGrow_x.x.x_x64-setup.exe`(或 `.msi`)
- macOS:`FieldGrow_x.x.x_aarch64.dmg` / `x64.dmg`
- Linux:`FieldGrow_x.x.x_amd64.AppImage` / `.deb`

### 从源码运行

前置依赖:[Node.js 20+](https://nodejs.org) · [Rust](https://rustup.rs) · 平台 WebView(Windows 自带 WebView2;macOS 用系统 WebKit;Linux 需 `webkit2gtk-4.1`)

```bash
git clone https://github.com/SmiLeXio/FieldGrow.git
cd FieldGrow
npm install
npm run tauri dev     # 开发模式
npm run tauri build   # 产出安装包
```

## 🔑 高德 Key 配置(2 分钟)

1. 注册 [高德开放平台](https://lbs.amap.com/) → 控制台 → [应用管理](https://console.amap.com/dev/key/app) → 创建新应用
2. 为应用添加 Key,选择 **「Web服务」** 类型 → 复制 Key
3. 打开 FieldGrow →「设置」→ 粘贴 Key → 点击 **「测试连接」**
4. (可选)再添加一个 **「Web端(JS API)」** 类型的 Key(建议不绑定域名白名单,便于桌面端加载地图),填入「地图可视化」一栏,即可启用地图打点与框选

> 💡 Key 仅保存在本机 localStorage,不上传任何服务器。日配额与 QPS 以你的高德账号认证等级为准。

## 📖 使用指南

1. **检索** —— 选择检索方式(关键词 / 框选 / 周边),输入关键词,点击「开始检索」
2. **筛选** —— 表格中勾选目标商户,或点星标收藏进客户池;点 ⓘ 查看完整商户详情
3. **跟进** —— 在「客户池」标注跟进状态、写备注,导出拜访清单安排路线
4. **导出** —— 支持导出选中 / 整页 / 整个客户池;Excel 或 CSV 自由选择

## 🧱 技术架构

```
FieldGrow/
├── src/                     # 前端(React 19 + TypeScript + Vite)
│   ├── lib/                 #   高德 REST 客户端 / 本地存储 / 导出
│   ├── components/          #   侧边栏 / 地图面板 / 详情弹窗 / UI 基元
│   ├── views/               #   检索 / 客户池 / 日志 / 设置
│   └── styles/              #   设计令牌 + 组件样式(零 UI 框架依赖)
├── src-tauri/               # Tauri 2(Rust)壳
│   └── src/lib.rs           #   高德 REST 代理(端点白名单) + 导出落盘
└── .github/workflows/       # 三平台 CI 构建
```

- **轻量**:安装包约 10 MB 级(对比 Electron 应用动辄 100MB+);前端无 UI 框架、无图标库,xlsx 引擎仅在导出时动态加载
- **安全**:高德 REST 调用经 Rust 代理,端点白名单管控,不开放通用 HTTP 代理
- **跨平台**:一套代码构建 Windows / macOS / Linux

## ⚖️ 免责声明

本工具仅用于合法的商业拓客场景。使用者应遵守当地法律法规及高德开放平台协议,
不得将检索数据用于骚扰、诈骗或其他非法用途;商户信息仅限本次拓客临时使用。

## 📄 License

[MIT](LICENSE) © SmiLeXio
