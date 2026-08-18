# dsh-system-monitor

`dsh-system-monitor` 是一个 DSH Web 插件，用于显示运行 DSH 的电脑的实时硬件运行信息：

- CPU 使用率
- 内存使用率
- 内存已用容量 / 总容量

插件只采集 DSH 服务端所在电脑的本机资源，不读取对话内容、文件内容或网络数据。

## 页面位置

信息显示在 Web GUI 右上角，并分为上下两行：

```text
┌──────────────────────────────────────────────────────────────┐
│  会话标题 …                                  [Session log] [余额] │
│                                             CPU 23% · MEM 58% · 8.2GB/16.0GB │
└──────────────────────────────────────────────────────────────┘
```

上行保留 DSH 原有的 Session log 和余额按钮，下行右对齐显示系统监控数据。

实际效果：

![dsh-system-monitor 实际效果](docs/images/dsh-system-monitor.png)

## 工作方式

- 服务端使用 Node.js 内置的 `os` 模块采集 CPU 和内存数据，不引入第三方运行时依赖；
- 服务端每 5 秒更新一次采样结果；
- 浏览器端每 5 秒请求一次统计接口并刷新显示；
- 服务端或接口暂不可用时，界面显示 `--`，恢复后自动更新；
- CPU 使用率通过两次 CPU 时间采样的差值计算。

## 安装

以 Web profile 为例：

```bash
cd ~/.dsh/profiles/web
pnpm add /path/to/dsh-system-monitor
```

也可以直接安装本地目录：

```bash
pnpm add D:/App/code/Project/dph/default/dsh-system-monitor
```

然后在 `~/.dsh/profiles/web/cordis.patch.yml` 的 `insert` 列表中加入：

```yaml
- id: dsh-system-monitor
  name: dsh-system-monitor
```

重启 `dsh web` 服务并刷新浏览器页面即可生效。

## HTTP 接口

插件注册以下接口：

```text
GET /api/dsh-system-monitor/stats
```

成功响应示例：

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

字段说明：

| 字段 | 说明 |
| --- | --- |
| `status` | `ok` 或 `error`；错误时前端显示占位符 |
| `cpu` | 0–100 的整数百分比；首次采样建立基准，可能暂为 `null` |
| `memPercent` | 内存使用率百分比 |
| `memUsed` | 已使用内存，单位为字节 |
| `memTotal` | 总内存，单位为字节 |
| `sampledAt` | 采样时间戳，单位为毫秒 |

容量显示规则：总容量不小于 1GB 时显示 GB 并保留 1 位小数，否则按 MB 取整。

## 测试

在插件目录执行：

```bash
node test/smoke.mjs
node test/client-sim.mjs
```

其中：

- `smoke.mjs` 验证服务端路由、采样数据和清理逻辑；
- `client-sim.mjs` 验证前端 bundle、slot 注册、两行右对齐布局、轮询和容量格式化。

## 目录结构

```text
lib/index.js       # 服务端采样与 HTTP 路由
lib/client.js      # 浏览器端组件与右上角布局
test/smoke.mjs     # 服务端测试
test/client-sim.mjs # 浏览器端模拟测试
docs/需求文档.md   # 原始需求文档
```

## 许可证

MIT
