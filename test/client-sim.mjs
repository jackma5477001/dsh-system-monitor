// 浏览器半面自测：在模拟浏览器环境里加载 lib/client.js（工厂格式），验证：
// 1) 工厂注册成功，导出 apply / inject（slots）
// 2) apply 注入 conversation.session.header.utilities 条目（id/order/label）
// 3) 组件首帧渲染占位文本（CPU -- · MEM --）
// 4) fetch 返回合法数据后组件渲染 "CPU 23% · MEM 58% · 8.2/16GB"
// 5) 容量格式化：总量 ≥1GB 用 GB（1 位小数），<1GB 用 MB 取整
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(join(here, "../lib/client.js"), "utf8");

// —— 模拟浏览器环境 ——
let registeredHandoff = null;
const window = {
  __ModuleLoader__: {
    load(handoff) {
      registeredHandoff = handoff;
    },
  },
};
const document = {
  querySelector() {
    return null;
  },
  createElement(tag) {
    return {
      tagName: tag,
      dataset: {},
      textContent: "",
      setAttribute() {},
      appendChild() {},
    };
  },
  head: { appendChild() {} },
};
const location = { origin: "http://127.0.0.1:3080" };

// fetch 桩：按路径返回固定性能数据
const fetchCalls = [];
globalThis.fetch = async (url) => {
  fetchCalls.push(url.toString());
  const path = String(url);
  if (path.endsWith("/api/dsh-system-monitor/stats")) {
    return {
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          status: "ok",
          cpu: 23,
          memPercent: 58,
          memUsed: 8800000000,
          memTotal: 17179869184, // 16 GiB → "16.0GB"
          sampledAt: 1789000000000,
        },
      }),
    };
  }
  return { ok: false, json: async () => ({}) };
};

// —— 极简 React 渲染器（支持 useState/useRef/useEffect/useCallback）——
function createRenderer() {
  let hookIndex = 0;
  let current = null;
  const stateCells = [];
  const effectQueue = [];
  const refs = [];
  const callbacks = [];

  function render(Component) {
    hookIndex = 0;
    current = Component();
    return current;
  }
  function useState(initial) {
    const i = hookIndex++;
    if (stateCells[i] === undefined) stateCells[i] = { value: initial };
    const cell = stateCells[i];
    return [
      cell.value,
      (next) => {
        cell.value = typeof next === "function" ? next(cell.value) : next;
      },
    ];
  }
  function useRef(initial) {
    const i = hookIndex++;
    if (refs[i] === undefined) refs[i] = { current: initial };
    return refs[i];
  }
  function useEffect(fn) {
    const i = hookIndex++;
    effectQueue.push({ index: i, fn });
  }
  function useCallback(fn) {
    const i = hookIndex++;
    callbacks[i] = fn;
    return fn;
  }
  function flushEffects() {
    // 按注册顺序执行；返回 cleanup 列表
    const cleanups = [];
    for (const { fn } of effectQueue) {
      const cleanup = fn();
      if (typeof cleanup === "function") cleanups.push(cleanup);
    }
    return cleanups;
  }
  return { render, useState, useRef, useEffect, useCallback, flushEffects };
}
const r = createRenderer();
const reactStub = {
  useState: r.useState,
  useRef: r.useRef,
  useEffect: r.useEffect,
  useCallback: r.useCallback,
};
const jsxRuntimeStub = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
};
function makeRequire() {
  return (spec) => {
    if (spec === "react") return reactStub;
    if (spec === "react/jsx-runtime") return jsxRuntimeStub;
    throw new Error(`unexpected require: ${spec}`);
  };
}

const factoryBody = new Function("window", "document", "require", clientSource);
factoryBody(window, document, makeRequire());

assert.ok(registeredHandoff !== null, "工厂已通过 __ModuleLoader__.load 注册");
assert.equal(registeredHandoff.id, "dsh-system-monitor");
const moduleExports = registeredHandoff.factory(makeRequire());
assert.equal(typeof moduleExports.apply, "function", "导出 apply");
assert.deepEqual(moduleExports.inject, ["slots"]);
console.log("PASS: 工厂注册 + apply/inject 导出");

// —— 模拟 client ctx ——
const slotInjections = [];
const slotRegistrations = [];
const ctx = {
  effect(fn) {
    return fn();
  },
  slots: {
    register(options, component) {
      slotRegistrations.push({ options, component });
      return () => {};
    },
    inject(name, registerFn) {
      slotInjections.push({ name, registerFn });
    },
  },
};

moduleExports.apply(ctx);

const injection = slotInjections.find((s) => s.name === "conversation.session.header.utilities");
assert.ok(injection, "注入了 conversation.session.header.utilities");
injection.registerFn();
assert.equal(slotRegistrations.length, 1, "注册了一个条目");
const { options, component } = slotRegistrations[0];
assert.equal(options.id, "system-monitor");
assert.equal(options.order, 100);
assert.equal(typeof component, "function", "组件已注册");
console.log("PASS: header.utilities 条目（id=system-monitor, order=100）");

// —— 组件渲染：首帧（无数据）——
let vdom = r.render(component);
function collectText(node, out = []) {
  if (node == null) return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  const children = node.props && node.props.children;
  if (Array.isArray(children)) {
    for (const child of children) collectText(child, out);
  } else if (children !== undefined) {
    collectText(children, out);
  }
  return out;
}
let text = collectText(vdom).join("").replace(/\s+/g, " ");
assert.ok(text.includes("CPU --"), `首帧含 CPU 占位（实际: ${text}）`);
assert.ok(text.includes("MEM --"), `首帧含 MEM 占位（实际: ${text}）`);
console.log("PASS: 首帧占位文本:", text.trim());

// 模拟 data-slot（display: contents）与 headerUtilities 的父子关系，
// 验证右上角容器被改成两行右对齐网格。
const utilities = {
  style: {
    display: "",
    gridTemplateColumns: "",
    justifyContent: "",
    alignItems: "",
    gap: "",
  },
};
const slot = { parentElement: utilities };
const lineEl = { parentElement: slot };
vdom.props.ref.current = lineEl;

// —— 执行轮询与布局 effect，等待 fetch 完成 ——
const cleanups = r.flushEffects();
assert.equal(utilities.style.display, "grid", "右上角容器使用网格布局");
assert.equal(utilities.style.gridTemplateColumns, "repeat(2, max-content)", "上行保留两列控件");
assert.equal(utilities.style.justifyContent, "end", "右上角容器右对齐");
await new Promise((resolve) => setTimeout(resolve, 50));
// 验证 fetch 被调用且数据驱动重渲染后文本正确
const setStateFn = r.useState; // 不直接用；通过再次渲染组件读取最新 state
vdom = r.render(component);
text = collectText(vdom).join("").replace(/\s+/g, " ");
// 注意：stub 的 setState 只更新 cell，需要再次 render 才能看到新值
// 首次 flush 后 fetch 完成 → setData 更新 cell → 重渲染应显示真实数据
assert.ok(fetchCalls.some((u) => String(u).endsWith("/api/dsh-system-monitor/stats")), "已轮询 stats 接口");
assert.ok(text.includes("CPU 23%"), `渲染 CPU 23%（实际: ${text}）`);
assert.ok(text.includes("MEM 58%"), `渲染 MEM 58%（实际: ${text}）`);
assert.ok(text.includes("8.2GB/16.0GB"), `渲染容量 8.2GB/16.0GB（实际: ${text}）`);
console.log("PASS: 数据渲染文本:", text.trim());

// —— 容量格式化：<1GB 场景（总量 512MB、已用 300MB）——
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    ok: true,
    data: { status: "ok", cpu: 5, memPercent: 59, memUsed: 314572800, memTotal: 536870912, sampledAt: 1 },
  }),
});
// 重新加载 bundle 以重置状态
let handoff2 = null;
const window2 = {
  __ModuleLoader__: { load(h) { handoff2 = h; } },
};
const r2 = createRenderer();
const reactStub2 = {
  useState: r2.useState,
  useRef: r2.useRef,
  useEffect: r2.useEffect,
  useCallback: r2.useCallback,
};
const jsxStub2 = { jsx: (t, p) => ({ type: t, props: p }), jsxs: (t, p) => ({ type: t, props: p }) };
function makeRequire2() {
  return (spec) => {
    if (spec === "react") return reactStub2;
    if (spec === "react/jsx-runtime") return jsxStub2;
    throw new Error(`unexpected require: ${spec}`);
  };
}
const factoryBody2 = new Function("window", "document", "require", clientSource);
factoryBody2(window2, document, makeRequire2());
const mod2 = handoff2.factory(makeRequire2());
const ctx2 = {
  effect(fn) { return fn(); },
  slots: {
    register(opts, comp) { slotRegistrations.push({ options: opts, component: comp }); return () => {}; },
    inject(name, fn) { fn(); },
  },
};
mod2.apply(ctx2);
const entry2 = slotRegistrations.at(-1);
let vdom2 = r2.render(entry2.component);
const cleanups2 = r2.flushEffects();
await new Promise((resolve) => setTimeout(resolve, 50));
vdom2 = r2.render(entry2.component);
const text2 = collectText(vdom2).join("").replace(/\s+/g, " ");
assert.ok(text2.includes("300MB/512MB"), `小内存按 MB 显示（实际: ${text2}）`);
console.log("PASS: 小容量格式化:", text2.trim());

// —— 清理 ——
for (const cleanup of [...cleanups, ...cleanups2]) {
  if (typeof cleanup === "function") cleanup();
}
assert.equal(utilities.style.display, "", "卸载时恢复右上角容器样式");

console.log("ALL PASS");
