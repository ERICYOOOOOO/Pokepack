# Pokepack · 30th Celebration 拆包模拟器

Pokémon TCG **30th Celebration**（英文版，2026-09-16 发售）卡包拆包模拟器，用于概率、统计与经济学教学。

- **开包**：拖动剪刀剪开卡包，逐张翻牌（按稀有度有不同的光效/音效），下方实时显示每张卡的市场价值；每张卡可选择是否收入 Binder（点击/→ 收藏，← 或向左滑动跳过）。支持快速连开 10 包。
- **Binder**：完整 191 张卡表（161 张主系列 + 30 张 Classic Collection），收集进度、筛选、排序、搜索、卡牌详情与全息倾斜效果。
- **概率与经济**：爆率表与每包期望价值（EV）拆解、你的运气 vs 理论期望、蒙特卡洛模拟（均值 vs 中位数）、追卡计算器（几何分布，开包 vs 买单卡）。

## 运行

纯静态页面，无需构建。直接打开 `index.html`，或：

```bash
python3 -m http.server 8000
```

也可以直接用 GitHub Pages 托管。卡图在线加载，需要联网。数据保存在浏览器 localStorage。

## 数据

- 卡表 / 卡图 / 价格：[TCGdex API](https://tcgdex.dev)，部分卡图与卡包图为 TCGplayer 商品图；价格为 2026-11-16 的 TCGplayer market price 快照（`data/cards.js`）。
- 爆率：TCGplayer 3,000+ 包社区统计（Double Rare 21.02%、Illustration Rare 19.72%、Classic Collection 10.15%、Special Illustration Rare 4.88%、Futuristic Rare 0.83%）。官方未公布爆率；RGB Mew 爆率为可调的假设值。

## 声明

仅用于教学演示，非商业用途，与 The Pokémon Company / Nintendo / Creatures / GAME FREAK 无关联。Pokémon 及卡牌图像版权归其权利人所有。
