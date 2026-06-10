# Cocos Creator Spine Toolkit (`cocos-spine-toolkit`)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Cocos%20Creator%203.x-orange.svg)](#)
[![Spine](https://img.shields.io/badge/Spine-3.x%20%7C%204.x-brightgreen.svg)](#)

一套针对 **Cocos Creator 3.x** 的程序化 Spine 骨骼控制与动态换装工具包。旨在解决游戏开发中常见的程序化骨骼追踪（如角色视线跟踪鼠标、手臂指向目标）、运行时动态换装（无缝替换插槽贴图或将自定义 Texture 载入骨骼）、以及骨骼挂载同步等痛点。

此外，本项目还包含一个**完全脱离 Cocos 引擎**的独立网页端 HTML5 Canvas 2D 骨骼动画引擎，用于快速在 Web 浏览器或工具链中预览 Spine 骨骼 JSON 数据。

---

## 🚀 核心特性

- 🎯 **程序化 IK 求解器 (`SpineIKSolver`)**：基于标准 2D 逆运动学（Inverse Kinematics）算法，支持 1 骨骼与 2 骨骼 IK 解算，轻松实现头部/手臂追踪目标。
- 👕 **运行时动态换装 (`SpineAttachmentHelper`)**：提供极简接口，支持在运行时将任何 Cocos `Texture2D` 或 packed `SpriteFrame` 直接实例化为 Spine 的 `RegionAttachment` 载入插槽，实现真正的动态皮肤。
- 🦴 **轻量骨骼同步器 (`SpineBoneFollower`)**：支持将任意外部节点（如血条、特效、粒子、UI）完美绑定至指定的 Spine 骨骼上，提供位置、旋转、缩放的同步，并支持在骨骼局部空间中设置偏移量。
- 💻 **独立 Web 预览引擎 (`web-preview`)**：提取 Spine 骨骼层级变换的核心矩阵算法，提供一套轻量、程序化矢量绘制的 2D Canvas 骨骼动画播放器，支持实时调整西装颜色、动作切换等。

---

## 📂 目录结构

```text
cocos-spine-toolkit/
├── assets/                     # Cocos Creator 3.x TypeScript 组件
│   ├── SpineIKSolver.ts        # 1骨骼与2骨骼 IK 解算追踪组件
│   ├── SpineAttachmentHelper.ts # 运行时插槽动态替换贴图/SpriteFrame 助手
│   └── SpineBoneFollower.ts    # 挂载节点同步跟踪指定骨骼组件
├── web-preview/                # 独立网页版骨骼动画预览工具 (不依赖 Cocos)
│   ├── spine_data/             # Spine 导出的 JSON 骨骼文件目录
│   ├── index.html              # 预览网页入口
│   ├── style.css               # 玻璃拟物化玻璃面板样式
│   └── engine.js               # 独立骨骼变换矩阵解算与程序化 Canvas 渲染引擎
├── package.json                # 项目元数据
├── LICENSE                     # MIT 开源协议
└── README.md                   # 本说明文件
```

---

## 🔧 安装与使用说明

### 1. Cocos Creator 3.x 导入
直接将 `assets/` 目录下的三个 `.ts` 脚本复制到你 Cocos Creator 项目的资源管理器（`assets`）中即可。

### 2. 使用 `SpineIKSolver` 制作视线/手臂追踪

将 `SpineIKSolver` 挂载到挂有 `sp.Skeleton` 组件的节点上：
- **Skeleton**: 拖入该节点的 `sp.Skeleton` 组件。
- **Bone Name**: 输入要旋转的主骨骼名称（例如 `head` 或 `arm`）。
- **Child Bone Name**: （可选）输入子骨骼名称（例如 `forearm`），若填写则自动启用 **2骨骼 IK 弯曲解算**。
- **Target Node**: 拖入想要追踪的目标 Cocos Node（如场景中的敌人、玩家、或虚拟的鼠标追踪点）。
- **Mix**: 混合权重（0 = 无效，1 = 完全指向目标）。
- **Bend Direction**: 2骨骼 IK 的弯曲方向（`1` 或 `-1`）。

> [!TIP]
> **动态修改追踪目标**：你可以在代码中随时通过脚本控制 `SpineIKSolver` 的追踪目标：
> ```typescript
> import { _decorator, Component, Node } from 'cc';
> import { SpineIKSolver } from './SpineIKSolver';
> 
> export class GameController extends Component {
>     public ikSolver: SpineIKSolver = null!;
>     public newTarget: Node = null!;
> 
>     public switchTarget() {
>         // 动态切换 IK 跟踪目标
>         this.ikSolver.targetNode = this.newTarget;
>         // 动态调节融合度
>         this.ikSolver.mix = 0.8;
>     }
> }
> ```

---

### 3. 使用 `SpineAttachmentHelper` 实现运行时动态换装

在运行时，直接更换武器或装备贴图，无需在 Spine 编辑器中预置所有皮肤。

```typescript
import { _decorator, Component, Texture2D, SpriteFrame } from 'cc';
import { SpineAttachmentHelper } from './SpineAttachmentHelper';

export class WeaponSystem extends Component {
    public attachmentHelper: SpineAttachmentHelper = null!;
    
    // 拖入想动态换上去的图片或合图中的 SpriteFrame
    public customWeaponTexture: Texture2D = null!;
    public customShieldSprite: SpriteFrame = null!;

    public equipCustomItems() {
        // 1. 将自定义的独立 Texture2D 挂载到 "weapon" 插槽，并设置大小为 60x120
        this.attachmentHelper.setSlotTexture("weapon", this._getTexture(), 60, 120);

        // 2. 将合图（Atlas）中的一个子图 SpriteFrame 挂载到 "shield" 插槽
        this.attachmentHelper.setSlotSpriteFrame("shield", this.customShieldSprite);
    }
}
```

---

### 4. 运行独立 Web 预览器

在 `web-preview` 目录下，包含一个完整的打工人骨骼变换和程序化矢量渲染演示。
由于浏览器安全策略限制，本地 `fetch` 读取 JSON 骨骼文件需要通过简单的本地服务器打开：

```bash
# 进入目录
cd web-preview

# 方案 A：使用 Python 快速启动本地服务器
python -m http.server 8000

# 方案 B：使用 Node.js 的 live-server 或者 http-server
npx live-server
```
启动后在浏览器打开 `http://localhost:8000`，即可看到完全由 Spine 骨骼数据驱动、并由 Canvas 程序化渲染的**打工人 (🤵 Salaryman)** 动画场景。支持在玻璃拟物化面板中实时调整速度、整体缩放、切换“奔跑、上班赶路、攻击、死亡”动作、以及实时更换西装颜色。

---

## 📄 许可协议
本项目基于 **MIT License** 许可协议开源，其中涉及 Esoteric Software LLC 所有的 Spine 运行时数学逻辑与授权协议已在 [LICENSE](LICENSE) 文件中附注说明。
