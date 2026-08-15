window.__ModuleLoader__.load({
	id: "dsh-system-monitor",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		/**
		 * 浏览器半面：在 Session Header 右上角（Session log / 余额按钮所在行）
		 * 同行显示 DSH 所在电脑的实时性能：CPU 使用率与内存使用率。
		 *
		 * 注册到 `conversation.session.header.utilities` list slot（与
		 * session-log-download、deepseek-balance 同一 slot），让监控信息
		 * 与这两个控件保持在同一个右上角行内。
		 *
		 * 数据经 GET /api/dsh-system-monitor/stats 每 5 秒轮询一次；
		 * 采集不可用时显示占位符 "--"，恢复后自动更新。
		 */
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");

		/** 插件样式（固定类名前缀 dsm-）。 */
		var css = [
			".dsm-line{display:flex;align-items:center;gap:8px;min-height:24px;box-sizing:border-box;padding:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font-family);font-variant-numeric:tabular-nums}",
			".dsm-item{white-space:nowrap}",
			".dsm-sep{color:var(--dsw-alias-label-caption)}",
			".dsm-err{color:var(--dsw-alias-state-warning-primary)}"
		].join("");
		var tagId = "dsh-system-monitor/SystemMonitorLine.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			var tag = document.createElement("style");
			tag.dataset.plugin = "dsh-system-monitor";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		/** 宿主接口基础地址。 */
		function hostBase() {
			var origin = globalThis.location && globalThis.location.origin;
			return origin !== void 0 && origin !== null && origin !== "null" ? origin : "http://dsh.internal";
		}

		/** 轮询周期（与服务端采样周期一致）。 */
		var POLL_MS = 5000;

		/** 容量格式化：≥1GB 显示 GB（保留 1 位小数）；总量不足 1GB 时按 MB 取整。 */
		function formatBytes(bytes) {
			if (typeof bytes !== "number" || !isFinite(bytes) || bytes < 0) return "--";
			var GB = 1024 * 1024 * 1024;
			var MB = 1024 * 1024;
			if (bytes >= GB) return (bytes / GB).toFixed(1) + "GB";
			if (bytes >= MB) return Math.round(bytes / MB) + "MB";
			return Math.round(bytes / 1024) + "KB";
		}

		/** 拉取一次性能数据；resolve 最新载荷（data），失败或状态非 ok 时 resolve null。 */
		function fetchStats() {
			return fetch(new URL("/api/dsh-system-monitor/stats", hostBase()), {
				method: "GET",
				cache: "no-store"
			})
				.then(function (response) {
					return response.json();
				})
				.then(function (body) {
					if (!body || body.ok !== true || !body.data || body.data.status !== "ok") return null;
					return body.data;
				})
				.catch(function () {
					return null;
				});
		}

		/**
		 * 性能信息行。挂载后立即拉取，此后每 5 秒轮询。
		 */
		function SystemMonitorLine() {
			var state = react.useState(null);
			var data = state[0];
			var setData = state[1];
			var tick = react.useCallback(function () {
				fetchStats().then(setData);
			}, []);

			react.useEffect(function () {
				tick();
				var timer = setInterval(tick, POLL_MS);
				return function () {
					clearInterval(timer);
				};
			}, [tick]);

			var cpu = data !== null && typeof data.cpu === "number" ? data.cpu : null;
			var memPercent = data !== null && typeof data.memPercent === "number" ? data.memPercent : null;
			var memUsed = data !== null ? data.memUsed : null;
			var memTotal = data !== null ? data.memTotal : null;

			var cpuText = cpu === null ? "--" : cpu + "%";
			var memText = memPercent === null ? "--" : memPercent + "%";
			var capText = memTotal === null || memUsed === null ? "--" : formatBytes(memUsed) + "/" + formatBytes(memTotal);

			return react_jsx_runtime.jsx("div", {
				className: "dsm-line",
				"data-dsh-system-monitor": "",
				title: "DSH 所在电脑的实时资源占用（每 5 秒刷新）",
				children: [
					react_jsx_runtime.jsx("span", { className: "dsm-item", children: "CPU " + cpuText }),
					react_jsx_runtime.jsx("span", { className: "dsm-sep", "aria-hidden": true, children: "·" }),
					react_jsx_runtime.jsx("span", { className: "dsm-item", children: "MEM " + memText }),
					react_jsx_runtime.jsx("span", { className: "dsm-sep", "aria-hidden": true, children: "·" }),
					react_jsx_runtime.jsx("span", { className: "dsm-item", children: capText })
				]
			});
		}

		/** 所需服务：slots（注册 header.utilities 条目）。 */
		var inject = ["slots"];

		function apply(ctx) {
			ctx.slots.inject("conversation.session.header.utilities", function () {
				return ctx.slots.register({
					name: "conversation.session.header.utilities",
					id: "system-monitor",
					order: 100,
					label: "System monitor"
				}, SystemMonitorLine);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
