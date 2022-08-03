import React, { Component } from "react";
import ws from "../../tools/socket";
import Socket from "../../lib/socket";
import "./chat.scss";

let servers = {
	iceServers: [
		{
			urls: ["stun:lemonyxk.com:3478", "turn:lemonyxk.com:3478"],
			credential: "",
			username: "",
		},
	],
};

export default class Chat extends Component {
	render() {
		return (
			<div className="chat">
				<div className="videos">
					<video ref={this.user1} autoPlay></video>
					<div>
						<button
							onClick={() => {
								this.openVideo = true;
								this.setting();
							}}
						>
							open video
						</button>
						<button
							onClick={() => {
								this.openAudio = true;
								this.setting();
							}}
						>
							open audio
						</button>
					</div>
					<video ref={this.user2} autoPlay></video>
				</div>
				<div className="users">
					{this.state.users.map((e) => (
						<div key={e.name}>
							<div>{e.name}</div>
							{this.name != e.name ? <button onClick={() => this.onCall(e)}>call</button> : null}
						</div>
					))}
				</div>
			</div>
		);
	}

	openVideo = false;
	openAudio = false;

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
		ws.socket = new Socket({ addr: "wss://web-rtc-server.lemonyxk.com", heartBeatInterval: 1 });
		ws.socket.before = () => {
			ws.socket.Global = { name: this.name };
		};

		ws.socket.AddListener("/UserList", this.userList.bind(this));
		ws.socket.AddListener("/CreateOffer", this.createOffer.bind(this));
		ws.socket.AddListener("/CreateAnswer", this.createAnswer.bind(this));
		ws.socket.AddListener("/Login", this.login.bind(this));
		ws.socket.AddListener("/RequestAccount", this.requestAccount.bind(this));
		ws.socket.Start(() => ws.socket.Emit("/login", { name: this.name }));
	}

	componentWillUnmount() {
		ws.socket.Close();
		ws.socket.RemoveListener("/UserList");
		ws.socket.RemoveListener("/CreateOffer");
		ws.socket.RemoveListener("/CreateAnswer");
		ws.socket.RemoveListener("/Login");
		ws.socket.RemoveListener("/RequestAccount");
	}

	localStream = null;
	remoteStream = null;
	peerConnection = null;

	offer = null;
	answer = null;

	async login(e, data) {
		ws.socket.Emit("/requestAccount", {});
	}

	async requestAccount(e, data) {
		servers.iceServers[0].credential = data.password;
		servers.iceServers[0].username = data.account;
		await this.initStream();
	}

	async initStream() {
		await this.setting();
	}

	async createPeerConnection(sdpType) {
		this.peerConnection = new RTCPeerConnection(servers);

		this.remoteStream = new MediaStream();
		this.user2.current.srcObject = this.remoteStream;

		this.localStream.getTracks().forEach((track) => {
			this.peerConnection.addTrack(track, this.localStream);
		});

		this.peerConnection.ontrack = async (event) => {
			event.streams[0].getTracks().forEach((track) => {
				this.remoteStream.addTrack(track);
			});
		};
	}

	async wait() {
		let sdp = this.peerConnection.localDescription;

		this.peerConnection.onicecandidate = async (event) => {
			if (event.candidate) {
				sdp = this.peerConnection.localDescription;
			}
		};

		return new Promise((r, j) => {
			this.peerConnection.onicegatheringstatechange = async (event) => {
				switch (this.peerConnection.iceGatheringState) {
					case "new":
						/* gathering is either just starting or has been reset */
						break;
					case "gathering":
						/* gathering has begun or is ongoing */
						break;
					case "complete":
						/* gathering has ended */
						r(sdp);
						break;
				}
			};
		});
	}

	async setting() {
		if (!this.openVideo && !this.openAudio) {
			return;
		}

		this.localStream = await navigator.mediaDevices.getUserMedia({ video: this.openVideo, audio: this.openAudio });
		this.user1.current.srcObject = this.localStream;
		if (this.peerConnection != null) {
			this.localStream.getTracks().forEach((track) => {
				this.peerConnection.addTrack(track, this.localStream);
			});
		}
	}

	userList(e, data) {
		this.setState({ users: data.sort((a, b) => a.name > b.name) });
	}

	async createOffer(e, data) {
		var ok = window.confirm(data.from + " call you!!!");
		if (!ok) return false;

		this.onAnswer(data);
	}

	createAnswer(e, data) {
		// var ok = window.confirm(data.from + " answer you!!!");
		// if (!ok) return false;

		this.onAddAnswer(data);
	}

	async onAddAnswer(data) {
		let answer = JSON.parse(data.data);
		if (!this.peerConnection.currentRemoteDescription) {
			this.peerConnection.setRemoteDescription(answer);
		}
	}

	async onAnswer(data) {
		if (!this.openVideo && !this.openAudio) {
			return alert("At least one of audio and video must be requested");
		}

		await this.createPeerConnection();

		let offer = JSON.parse(data.data);
		await this.peerConnection.setRemoteDescription(offer);

		let answer = await this.peerConnection.createAnswer();
		await this.peerConnection.setLocalDescription(answer);

		this.answer = await this.wait();

		ws.socket.Emit("/createAnswer", { from: data.to, to: data.from, data: JSON.stringify(this.answer) });
	}

	async onCall(user) {
		if (!this.openVideo && !this.openAudio) {
			return alert("At least one of audio and video must be requested");
		}

		await this.createPeerConnection();

		let offer = await this.peerConnection.createOffer();
		await this.peerConnection.setLocalDescription(offer);

		this.offer = await this.wait();

		ws.socket.Emit("/createOffer", { from: this.name, to: user.name, data: JSON.stringify(this.offer) });
	}
}
