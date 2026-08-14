/**
 * dsh-system-monitor — host half.
 *
 * 每 5 秒采集一次 DSH 所在电脑的 CPU 使用率与内存使用率（Node 内置
 * `os` 模块，两次采样差值计算 CPU 占用），缓存最新结果，并通过
 * `webServer` 服务注册 `GET /api/dsh-system-monitor/stats` 供浏览器半面
 * 轮询读取。
 *
 * 采集失败（如 `os` API 异常）不会崩溃：本次采样被跳过，最近一次成功
 * 结果保留，`status` 字段如实上报；前端据此显示占位符 "--"。
 */
import os from "node:os";

/** 采样周期：5 秒（与前端轮询周期一致）。 */
const SAMPLE_INTERVAL_MS = 5000;

/** 启动后首两个采样点之间的间隔，用于尽快得到第一个有效 CPU 读数。 */
const BOOT_SETTLE_MS = 100;

/** 路由路径。 */
const STATS_PATH = "/api/dsh-system-monitor/stats";

/**
 * 最近一次成功采样（status 为 "ok" 时有效）。
 * cpu 为 null 表示尚无足够采样点（首次采样仅建立基准）。
 */
let latest = { status: "ok", cpu: null, memPercent: null, memUsed: null, memTotal: null, sampledAt: 0 };

/** 上一次 CPU 时间基准（{ total, idle }），null 表示尚未建立基准。 */
let cpuBase = null;

/** 采集一次性能数据并更新 latest。任何异常都被捕获，转为 error 状态。 */
function sample() {
  try {
    const cpus = os.cpus();
    let total = 0;
    let idle = 0;
    for (const cpu of cpus) {
      total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
      idle += cpu.times.idle;
    }
    let cpu = null;
    if (cpuBase !== null && total - cpuBase.total > 0) {
      const busyDelta = total - cpuBase.total - (idle - cpuBase.idle);
      cpu = Math.min(100, Math.max(0, Math.round((busyDelta / (total - cpuBase.total)) * 100)));
    }
    cpuBase = { total, idle };

    const memTotal = os.totalmem();
    const memUsed = memTotal - os.freemem();
    const memPercent = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : null;

    latest = {
      status: "ok",
      cpu,
      memPercent,
      memUsed,
      memTotal,
      sampledAt: Date.now()
    };
  } catch (error) {
    latest = {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      sampledAt: Date.now()
    };
  }
}

/** 发送 JSON 响应。 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(payload);
}

export const inject = ["webServer"];

export function apply(ctx) {
  const webServer = ctx.get("webServer");
  if (webServer === undefined) return;

  // 立即建立第一个采样基准，稍后补第二个采样点得到首个有效 CPU 读数。
  sample();
  const bootTimer = setTimeout(() => sample(), BOOT_SETTLE_MS);
  const interval = setInterval(sample, SAMPLE_INTERVAL_MS);
  interval.unref?.();

  const disposer = webServer.register({
    kind: "exact",
    path: STATS_PATH,
    handler: (req, res) => {
      if (req.method !== "GET") {
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      sendJson(res, 200, { ok: true, data: latest });
    }
  });
  ctx.effect(
    () => {
      clearTimeout(bootTimer);
      clearInterval(interval);
      disposer();
    },
    "dsh-system-monitor: unregister stats route and stop sampler"
  );
}
