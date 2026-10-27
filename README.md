# LLM Benchmark Rankings

LLM 模型基准测试排名看板，支持 18 项前沿及专项评测和综合榜，数据每日自动刷新。

优先展示 Terminal-Bench 4.0、DeepSWE、ARC-AGI-3、FrontierMath v2、HLE（有工具 / 无工具）、BrowseComp、OSWorld 2.1 和 Toolathlon-Verified，再展示编程、办公、多模态、工具调用等专项。已移除 ARC-AGI-2、SWE-bench Verified、Terminal-Bench 2.0、MMLU-Pro、GPQA Diamond、MMMU 等旧项。

若某单项前五名均达到 90 分且差距不超过 5 分，自动从榜单中移除。该启发式只衡量榜首区分度，不代表认定过拟合或训练污染；不跨版本合并成绩，也不据此改动来源综合分。页面维持极简布局，每项仅显示标题、一句话介绍和图表。

## 本地开发

```bash
npm install
npm start
```

访问 http://localhost:6066

## Docker 部署

```bash
docker build -t llm-benchmark .
docker run -p 6066:6066 llm-benchmark
```

## 数据刷新

- 自动：每日北京时间上午 9:00
- 手动：重启容器会自动拉取一次
- 从 [BenchLM 官方公开导出](https://benchlm.ai/data)的 `models.json` 和 `benchmarks.json` 读取各评测原始字段；综合榜使用公开 `displayScore`，不使用类别综合分冒充单项。
- API 保留每项来源、指标、来源更新时间和获取时间，页面不展开这些元数据。工具设置、Agent 配置和题目时间窗可能影响可比性，具体以来源说明为准。
- 请求失败时保留上次成功数据，缓存状态保留在 API 中；没有真实数据时显示暂无成绩。升级前的固定兜底分数不会迁移。
- 导出数据遵循来源的 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可并保留署名。

## 验证

```bash
npm test
```

覆盖独立单项取值、工具设置隔离、无效成绩过滤、旧项与高分聚集项移除、缓存降级和旧数据迁移。

图表保留首次出现时的柱状图入场动画，再次滚回和配色切换不重播；提示框动画关闭。用 IntersectionObserver 仅绘制视口附近的图表，离屏时释放画布；每帧最多处理一张图表，像素倍率上限为 1.5。配色切换仅更新已挂载图表，不重建整个页面。前端回归检查覆盖延迟创建、离屏释放、入场动画、排队取消和配色更新；不支持 IntersectionObserver 的旧浏览器仍按帧分批创建。

## 项目结构

```
├── index.html          # 前端页面
├── server.js           # Node.js 后端 (Express + node-cron)
├── benchmarks.js       # 单项配置、真实成绩映射和展示优先级
├── benchmarks.test.js  # 数据与排序回归检查
├── package.json        # 依赖配置
├── Dockerfile          # Docker 镜像配置
└── .github/workflows/  # GitHub Actions 自动构建
```
