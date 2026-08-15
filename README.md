# dsh-system-monitor

DSH 插件：在 Web GUI 右上角，与 Session log / DeepSeek 余额按钮**同一行**实时显示 DSH 所在电脑的 **CPU 使用率**与**内存使用率**。

```
┌──────────────────────────────────────────────┐
│  会话标题 …        [模型] [子代理] [任务]      │ ← 现有区域
│             [Session log] [余额] CPU 23% · MEM 58% · 8.2/16GB │ ← 右上角信息行
└──────────────────────────────────────────────┘
```

## 特性

- 服务端（host 半面）每 5 秒用 Node 内置 `os` 模块采样本机性能（两次采样差值计算 CPU 占用，不引入任何第三方依赖）；
- `GET /api/dsh-system-monitor/stats` 输出 JSON；浏览器半面每 5 秒轮询一次并渲染；
- 采集失败时显示 `CPU -- · MEM --` 占位符，恢复后自动更新；
- 不采集任何对话内容、文件内容或网络数据，仅本机资源占用。

## 安装

1. 把本包安装到 dsh profile（以 web profile 为例）：

   ```bash
   cd ~/.dsh/profiles/web
   pnpm add /path/to/dsh-system-monitor
   ```

2. 在 `~/.dsh/profiles/web/cordis.patch.yml` 的 `insert` 列表追加：

   ```yaml
   # dsh-system-monitor 插件：
   # 在 Session Header 右上角（与 Session log / 余额同一行）显示本机 CPU/内存使用率。
   - id: dsh-system-monitor
     name: dsh-system-monitor
   ```

3. 重启 `dsh web` 服务，刷新浏览器页面即可看到新增的性能信息行。

## 数据格式

`GET /api/dsh-system-monitor/stats` 返回：

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "cpu": 23,
    "memPercent": 58,
    "memUsed": 8800000000,
    "memTotal": 16000000000,
    "sampledAt": 1789000000000
  }
}
```

- `status`: `"ok"` / `"error"`（error 时其余字段缺失，前端显示 `--`）；
- `cpu`: 0–100 的整数百分比；启动后首个采样点仅有基准值，`cpu` 为 `null`（约 100ms 后即有有效值）；
- `memUsed` / `memTotal`: 字节数；前端按“总量 ≥1GB 显示 GB（1 位小数），否则按 MB 取整”格式化。

## 测试

```bash
node test/smoke.mjs        # 服务端：路由注册 + 采样结果结构校验
node test/client-sim.mjs   # 前端：bundle 加载 + slot 注册 + 轮询与格式化
```
