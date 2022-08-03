class Socket {
	constructor(config) {
		// 配置
		this.Config = Object.assign(
			{
				autoHeartBeat: true,
				heartBeatInterval: 1,
				reconnect: true,
				reonnectInterval: 1,
			},
			config || {}
		);
		// 事件对象
		this.event = {};
		// 服务对象
		this.server = {};
		// 连接状态
		this.status = false;
		// 禁止自动连接
		this.nologin = false;
		// 错误标记
		this.error = false;
		// 心跳定时器
		this.t = null;
		// 连接间隔器
		this.ct = null;
		// callback
		this.callback = null;
		// Global
		this.Global = {};
		// StartTimes
		this.before = null;
		this.StartTimes = 0;
		this.OnError = null;
		this.OnClose = null;
		this.OnOpen = null;
		this.OnSend = null;
		this.OnMessage = null;
	}

	Close(e) {
		this.server.close();
		this.nologin = true;
		this.server = null;
		this.callback = null;
		this.event = null;
		this.status = false;
		this.before = null;
		this.Global = null;
		this.Config = null;
		this.OnError = null;
		this.OnOpen = null;
		clearInterval(this.t);
		clearTimeout(this.ct);
		this.OnClose = null;
	}

	Start(callback) {
		this.connect();
		// 连接成功回调函数
		this.callback = callback || function () {};
	}

	connect() {
		let addr = this.Config.addr;

		// console.log("开始连接服务器", `${addr}`);

		// 清除两个定时器
		clearInterval(this.t);
		clearTimeout(this.ct);
		// 连接WS服务器
		// NODE
		if (typeof module !== "undefined" && module.exports) {
			let W3CWebSocket = require("websocket").w3cwebsocket;
			this.server = new W3CWebSocket(addr);
		} else {
			this.server = new WebSocket(addr);
		}

		// 连接成功事件
		this.server.onopen = this.onopen.bind(this);
		// 收到消息事件
		this.server.onmessage = this.onmessage.bind(this);
		// 关闭事件
		this.server.onclose = this.onclose.bind(this);
		// 错误事件
		this.server.onerror = this.onerror.bind(this);
		// 心跳函数
		if (this.Config.autoHeartBeat) this.HeartBeat();
	}

	onopen() {
		this.status = true;
		this.error = false;
		this.StartTimes++;
		this.OnOpen && this.OnOpen();
		// 开启成功回调 每次断线重连 都要重新执行的函数
		this.callback.call(this, this);
		// console.log("连接成功");
	}

	onmessage(e) {
		if (typeof e.data === "object") return;
		this.OnMessage && this.OnMessage(e);
		// 事件触发器
		try {
			let message = JSON.parse(e.data);

			if (message.id) {
				if (this.promiseList[message.id]) {
					if (this.promiseList[message.id].visit == false) {
						this.promiseList[message.id].visit = true;
						clearTimeout(this.promiseList[message.id].timeout);
						this.promiseList[message.id].resolve(message);
						delete this.promiseList[message.id];
						return;
					}
				}
			}

			if (message.event && message.event in this.event) {
				return this.event[message.event].call(this, this, message.data, message.event);
			}

			if (this.event["*"]) {
				return this.event["*"].call(this, this, message.data, message.event);
			}
		} catch (error) {
			console.log("socket错误:", error);
		}
	}

	onclose(e) {
		this.status = false;
		this.OnClose && this.OnClose(e);
		// 关闭回调:清空定时器 判断是否禁止登录 判断错误回调是否在处理 重连
		clearInterval(this.t);
		if (this.nologin) return false;
		if (this.Config.reconnect) {
			this.ct = setTimeout(() => {
				if (this.error) return false;
				console.log("close");
				this.connect();
			}, 1000 * this.Config.reonnectInterval || 1000);
		}
	}

	onerror(e) {
		this.error = true;
		this.status = false;
		this.OnError && this.OnError(e);
		// 错误回调:清空定时器 判断是否禁止登录 设置错误处理标识 重连
		clearInterval(this.t);
		if (this.nologin) return false;

		if (this.Config.reconnect) {
			this.ct = setTimeout(() => {
				console.log("error");
				this.connect();
			}, 1000 * this.Config.reonnectInterval || 1000);
		}
	}

	HeartBeat() {
		// 心跳检测 发送空字符 目前WEBSOCKET不支持PING 仅支持自动返回PONG帧
		this.t = setInterval(() => {
			try {
				if (this.nologin || this.error || !this.status) return false;
				this.server.send("");
			} catch (error) {
				console.log("心跳错误:", error);
			}
		}, 1000 * this.Config.heartBeatInterval || 5000);
	}

	Send(message) {
		this.OnSend && this.OnSend(message);
		this.server.send(message);
	}

	Emit(event, message) {
		this.before && this.before();

		// 发送消息事件
		if (this.nologin || this.error || !this.status) return false;

		try {
			if (!message) {
				this.server.send(JSON.stringify({ event: event }));
				return true;
			}

			let data = null;
			if (typeof message !== "object") {
				data = message;
			} else {
				data = { ...message, ...this.Global };
			}

			this.OnSend && this.OnSend({ event: event, data: data });

			this.server.send(JSON.stringify({ event: event, data: data }));

			return true;
		} catch (error) {
			console.log("发送事件错误:", error);
			return false;
		}
	}

	AddListener(event, callback) {
		// 监听事件
		if (!this.event[event]) this.event[event] = callback;
	}

	RemoveListener(event) {
		// 监听事件
		this.event && delete this.event[event];
	}

	messageID = 0;
	promiseList = {};
	async Do(event, message) {
		// 发送消息事件

		this.before && this.before();

		return new Promise((resolve, reject) => {
			if (this.nologin || this.error || !this.status) {
				reject("not connect");
				return;
			}

			this.messageID++;
			this.promiseList[this.messageID] = { resolve, timeout: null, visit: false };

			try {
				if (!message) {
					this.server.send(JSON.stringify({ event: event, id: this.messageID }));
					return;
				}

				let data = null;
				if (typeof message !== "object") {
					data = message;
				} else {
					data = { ...message, ...this.Global };
				}

				this.server.send(JSON.stringify({ event: event, data: data, id: this.messageID }));
				return;
			} catch (error) {
				reject(error);
				return;
			} finally {
				this.promiseList[this.messageID].timeout = setTimeout(() => {
					this.promiseList[this.messageID].visit = true;
					clearTimeout(this.promiseList[this.messageID].timeout);
					delete this.promiseList[this.messageID];
					reject("timeout");
				}, 1000 * this.Config.timeout || 5000);
			}
		});
	}
}

export default Socket;
