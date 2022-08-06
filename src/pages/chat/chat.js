import React, { Component } from "react";
import ws from "../../tools/socket";
import Socket from "../../lib/socket";
import "./chat.scss";
import cfg from "../../config.json";
import { Comfirm } from "../../lib/comfirm";
import PhoneCall from "../../lib/icons8-phone-50.png";
import VideoCall from "../../lib/icons8-video-call-50.png";
import EndCall from "../../lib/icons8-end-call-50.png";

let config = cfg[process.env.NODE_ENV];

let servers = {
	iceServers: [
		{
			urls: [],
			credential: "",
			username: "",
		},
	],
};

export default class Chat extends Component {
	render() {
		return (
			<div className="chat">
				<div className="users">
					{this.state.users
						.filter((e) => e.name == this.name)
						.map((user) => (
							<div key={user.name}>
								<div className="button-2">{user.ip}</div>
								<div className="button-1">SELF</div>
							</div>
						))}
					{this.state.users
						.filter((e) => e.name != this.name)
						.map((user) => (
							<div key={user.name}>
								<div className="button-2">{user.ip}</div>
								<div className="button-1" onClick={() => this.openCall(user)}>
									Call
								</div>
							</div>
						))}
				</div>
			</div>
		);
	}

	started = false;

	user1 = React.createRef();
	user2 = React.createRef();

	state = {
		users: [],
	};

	name = Math.random()
		.toString(36)
		.replace(/[^a-z]+/g, "")
		.slice(0, 8);

	componentDidMount() {
		ws.socket = new Socket({ addr: config.addr, heartBeatInterval: 1 });
		ws.socket.before = () => (ws.socket.Global = { name: this.name });

		ws.socket.AddListener("/UserList", this.userList.bind(this));
		ws.socket.AddListener("/CreateOffer", this.createOffer.bind(this));
		ws.socket.AddListener("/CreateAnswer", this.createAnswer.bind(this));
		ws.socket.AddListener("/AddAnswer", this.start.bind(this));
		ws.socket.AddListener("/EndCall", this.end.bind(this));
		ws.socket.AddListener("/Login", this.login.bind(this));
		ws.socket.AddListener("/RequestAccount", this.requestAccount.bind(this));

		ws.socket.Start(() => ws.socket.Emit("/login", { name: this.name }));
	}

	componentWillUnmount() {
		ws.socket.Close();

		ws.socket.RemoveListener("/UserList");
		ws.socket.RemoveListener("/CreateOffer");
		ws.socket.RemoveListener("/CreateAnswer");
		ws.socket.RemoveListener("/AddAnswer");
		ws.socket.RemoveListener("/EndCall");
		ws.socket.RemoveListener("/Login");
		ws.socket.RemoveListener("/RequestAccount");

		this.clear();
	}

	localStream = null;
	remoteStream = null;
	peerConnection = null;

	offer = null;
	answer = null;

	createCallVideo(user) {
		return (
			<div className="videos">
				<div className="top"></div>
				<div className="middle">
					<video
						ref={this.user1}
						disablePictureInPicture={true}
						// autoPlay
						playsInline
						muted
						style={{ display: "none" }}
					></video>
					<video
						ref={this.user2}
						disablePictureInPicture={true}
						// autoPlay
						playsInline
						style={{ display: "none" }}
					></video>
				</div>
				<div className="bottom">
					<img src={PhoneCall} onClick={() => this.onCall(user, "audio")} />
					<img src={VideoCall} onClick={() => this.onCall(user, "both")} />
					<img onClick={() => this.stop()} src={EndCall} />
				</div>
			</div>
		);
	}

	getWidthAndHeight() {
		let width = window.innerWidth > 800 ? 800 : window.innerWidth;
		let height = window.innerWidth > 800 ? 600 : window.innerHeight;
		return { width, height };
	}

	openCall(user) {
		let w = this.getWidthAndHeight();
		Comfirm.open({
			text: this.createCallVideo(user),
			submit: () => {},
			cancel: () => {},
			width: w.width,
			height: w.height,
			style: {},
			actions: null,
		});
	}

	createAnswerVideo(data) {
		return (
			<div className="videos">
				<div className="top"></div>
				<div className="middle">
					<video
						ref={this.user1}
						disablePictureInPicture={true}
						// autoPlay
						playsInline
						muted
						style={{ display: "none" }}
					></video>
					<video
						ref={this.user2}
						disablePictureInPicture={true}
						// autoPlay
						playsInline
						style={{ display: "none" }}
					></video>
				</div>
				<div className="bottom">
					<img src={PhoneCall} onClick={() => this.onAnswer(data)} />
					<img onClick={() => this.stop()} src={EndCall} />
				</div>
			</div>
		);
	}

	answerCall(user) {
		let w = this.getWidthAndHeight();
		Comfirm.open({
			text: this.createAnswerVideo(user),
			submit: () => {},
			cancel: () => {},
			width: w.width,
			height: w.height,
			style: {},
			actions: null,
		});
	}

	async login(e, data) {
		ws.socket.Emit("/requestAccount", {});
	}

	async requestAccount(e, data) {
		servers.iceServers[0].credential = data.password;
		servers.iceServers[0].username = data.account;
		servers.iceServers[0].urls = config.urls;
	}

	async createPeerConnection() {
		this.clear();

		this.peerConnection = new RTCPeerConnection(servers);

		this.remoteStream = new MediaStream();
		this.user2.current.srcObject = this.remoteStream;

		this.peerConnection.ontrack = async (event) => {
			event.streams[0].getTracks().forEach((track) => {
				this.remoteStream.addTrack(track);
			});
		};
	}

	async wait() {
		let sdp = this.peerConnection.localDescription;

		this.peerConnection.onicecandidate = async (event) => {
			if (event.candidate) sdp = this.peerConnection.localDescription;
		};

		return new Promise((r, j) => {
			this.peerConnection.onicegatheringstatechange = async (event) => {
				// new gathering complete
				if (this.peerConnection.iceGatheringState == "complete") r(sdp);
			};
		});
	}

	userList(e, data) {
		this.setState({ users: data.sort((a, b) => a.name > b.name) });
	}

	async createOffer(e, data) {
		this.answerCall(data);
	}

	createAnswer(e, data) {
		this.onAddAnswer(data);
	}

	async onAddAnswer(data) {
		let answer = JSON.parse(data.data);
		await this.peerConnection.setRemoteDescription(answer);
		await this.start(null, data);
		ws.socket.Emit("/addAnswer", { type: data.type, from: data.to, to: data.from, data: {} });
	}

	getType(type) {
		// let w = this.getWidthAndHeight();
		let video = true;

		let audio = true;

		if (type == "video") return { video: video, audio: false };
		if (type == "audio") return { video: false, audio: audio };
		if (type == "both") return { video: video, audio: audio };
		if (type == "screen") return { video: video, audio: audio };
	}

	clear() {
		if (this.peerConnection) this.peerConnection.close();
		if (this.localStream) {
			this.localStream.getTracks().forEach((track) => {
				track.stop();
			});
		}
	}

	async start(e, data) {
		this.user1.current.play();
		this.user1.current.removeAttribute("style");
		this.user2.current.play();
		this.user2.current.removeAttribute("style");
		this.started = true;
	}

	async end() {
		Comfirm.close();
		this.clear();
		this.started = false;
	}

	async stop(name) {
		Comfirm.close();
		this.clear();
		this.started = false;

		ws.socket.Emit("/endCall", { type: this.info.type, from: this.info.from, to: this.info.to, data: null });
	}

	reset() {}

	async onAnswer(data) {
		if (this.started) return;

		await this.createPeerConnection();

		if (data.type != "screen") {
			this.localStream = await navigator.mediaDevices.getUserMedia(this.getType(data.type));
			this.user1.current.srcObject = this.localStream;
			this.localStream.getTracks().forEach((track) => {
				this.peerConnection.addTrack(track, this.localStream);
			});
		}

		let offer = JSON.parse(data.data);
		await this.peerConnection.setRemoteDescription(offer);

		let answer = await this.peerConnection.createAnswer();
		await this.peerConnection.setLocalDescription(answer);

		this.answer = await this.wait();

		this.info.type = data.type;
		this.info.from = data.to;
		this.info.to = data.from;

		ws.socket.Emit("/createAnswer", { type: data.type, from: data.to, to: data.from, data: JSON.stringify(this.answer) });
	}

	info = {};

	async onCall(user, type) {
		if (this.started) return;

		await this.createPeerConnection();

		if (type == "screen") {
			this.localStream = await navigator.mediaDevices.getDisplayMedia(this.getType(type));
		} else {
			this.localStream = await navigator.mediaDevices.getUserMedia(this.getType(type));
		}

		this.user1.current.srcObject = this.localStream;
		this.localStream.getTracks().forEach((track) => {
			this.peerConnection.addTrack(track, this.localStream);
		});

		let offer = await this.peerConnection.createOffer();
		await this.peerConnection.setLocalDescription(offer);

		this.offer = await this.wait();

		this.info.type = type;
		this.info.from = this.name;
		this.info.to = user.name;

		ws.socket.Emit("/createOffer", { type: type, from: this.name, to: user.name, data: JSON.stringify(this.offer) });
	}
}
