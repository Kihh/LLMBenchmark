# LLM Benchmark Rankings

LLM 模型基准测试排名看板，数据每日自动刷新。

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

## 项目结构

```
├── index.html          # 前端页面
├── server.js           # Node.js 后端 (Express + node-cron)
├── package.json        # 依赖配置
├── Dockerfile          # Docker 镜像配置
└── .github/workflows/  # GitHub Actions 自动构建
```
