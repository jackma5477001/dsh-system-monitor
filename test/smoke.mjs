// 服务端半面自测：模拟 ctx（webServer / effect），验证：
// 1) 路由 /api/dsh-system-monitor/stats 注册成功
// 2) GET 返回合法 JSON：status=ok、cpu 0-100、memPercent 0-100、容量为正数
// 3) 非 GET 请求返回 405
// 4) 插件停止时清理定时器与路由
import assert from "node:assert/strict";
import { apply } from "../lib/index.js";

const routes = new Map();
let effectCleanup = null;

const ctx = {
  get(name) {
    if (name === "webServer") {
      return {
        register(route) {
          if (routes.has(route.path)) throw new Error(`duplicate route ${route.path}`);
          routes.set(route.path, route);
          return () => routes.delete(route.path);
        },
      };
    }
    return undefined;
  },
  effect(fn) {
    effectCleanup = fn();
  },
};

apply(ctx);

// 1) 路由注册
assert.ok(routes.has("/api/dsh-system-monitor/stats"), "路由已注册");
console.log("PASS: 路由 /api/dsh-system-monitor/stats 注册");

const route = routes.get("/api/dsh-system-monitor/stats");

// 模拟 node:http 请求/响应
function makeReq(method) {
  return { method };
}
function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    payload: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(payload) {
      this.payload = payload;
    },
  };
}

// 2) GET 请求：等待启动采样完成（首个有效 CPU 读数约在 100ms 后产生）
await new Promise((resolve) => setTimeout(resolve, 300));
const res = makeRes();
route.handler(makeReq("GET"), res);
assert.equal(res.statusCode, 200, "GET 应返回 200");
assert.match(res.headers["content-type"], /application\/json/, "JSON 响应头");

const body = JSON.parse(res.payload);
assert.equal(body.ok, true, "ok=true");
assert.equal(body.data.status, "ok", "status=ok");
assert.equal(typeof body.data.cpu, "number", "cpu 为数字");
assert.ok(body.data.cpu >= 0 && body.data.cpu <= 100, `cpu 在 0-100 内（实际 ${body.data.cpu}）`);
assert.equal(typeof body.data.memPercent, "number", "memPercent 为数字");
assert.ok(body.data.memPercent >= 0 && body.data.memPercent <= 100, "memPercent 在 0-100 内");
assert.ok(body.data.memUsed > 0 && body.data.memTotal > 0, "内存容量为正数");
assert.ok(body.data.memUsed <= body.data.memTotal, "已用 ≤ 总量");
assert.ok(body.data.sampledAt > 0, "带采样时间戳");
console.log("PASS: GET 载荷结构", JSON.stringify(body.data));

// 3) 非 GET 返回 405
const res405 = makeRes();
route.handler(makeReq("POST"), res405);
assert.equal(res405.statusCode, 405, "POST 应返回 405");
console.log("PASS: 非 GET 返回 405");

// 4) 清理：停止插件应注销路由（并清定时器，无法直接断言但应可执行）
assert.equal(typeof effectCleanup, "function", "effect 已注册");
effectCleanup();
assert.ok(!routes.has("/api/dsh-system-monitor/stats"), "停止后路由注销");
console.log("PASS: 插件停止后路由注销");

console.log("ALL PASS");
