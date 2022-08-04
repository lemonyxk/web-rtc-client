import React, { Component } from "react";
import ws from "../../tools/socket";
import Socket from "../../lib/socket";
import "./chat.scss";
import cfg from "../../config.json";
import { Comfirm } from "../../lib/comfirm";

let config = cfg[process.env.NODE_ENV];

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
					<video
						ref={this.user1}
						disablePictureInPicture={true}
						// onDoubleClick={() => this.user1.current.requestFullscreen()}
						autoPlay
						playsInline
					></video>
					<video
						ref={this.user2}
						disablePictureInPicture={true}
						onDoubleClick={() => this.user2.current.requestFullscreen()}
						autoPlay
						playsInline
					></video>
				</div>
				<div className="users">
					{this.state.users.map((user) => (
						<div key={user.name}>
							<div>{user.name}</div>
							{this.name != user.name ? (
								<>
									<button onClick={() => this.onCall(user, "video")}>video</button>
									<button onClick={() => this.onCall(user, "audio")}>audio</button>
									<button onClick={() => this.onCall(user, "screen")}>screen</button>
									<button onClick={() => this.onCall(user, "both")}>both</button>
								</>
							) : null}
						</div>
					))}
				</div>
			</div>
		);
	}

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

		this.stop();
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
	}

	async createPeerConnection() {
		this.stop();

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
		// let openVideo = false;
		// let openAudio = false;
		// let openScreen = false;

		// Comfirm.open({
		// 	title: `${data.from} want to share with you on ${data.type}`,
		// 	text: (
		// 		<div>
		// 			open video: <input type="checkbox" onChange={(e) => (openVideo = !openVideo)} />
		// 			open audio: <input type="checkbox" onChange={(e) => (openAudio = !openAudio)} />
		// 			open screen: <input type="checkbox" onChange={(e) => (openScreen = !openScreen)} />
		// 		</div>
		// 	),
		// 	submit: () => this.onAnswer(data),
		// });

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
		this.peerConnection.setRemoteDescription(answer);
		// if (!this.peerConnection.currentRemoteDescription) {
		// 	this.peerConnection.setRemoteDescription(answer);
		// }
	}

	getType(type) {
		if (type == "video") return { video: true, audio: false };
		if (type == "audio") return { video: false, audio: true };
		if (type == "both") return { video: true, audio: true };
		if (type == "screen") return { video: true, audio: true };
	}

	stop() {
		if (this.peerConnection) this.peerConnection.close();
		if (this.localStream) {
			this.localStream.getTracks().forEach((track) => {
				track.stop();
			});
		}
	}

	reset() {}

	async onAnswer(data) {
		await this.createPeerConnection();

		if (data.type != "screen") {
			this.localStream = await navigator.mediaDevices.getUserMedia(this.getType(data.type));
			this.user1.current.srcObject = this.localStream;
			this.user1.current.muted = true;
			this.localStream.getTracks().forEach((track) => {
				this.peerConnection.addTrack(track, this.localStream);
			});
		}

		let offer = JSON.parse(data.data);
		await this.peerConnection.setRemoteDescription(offer);

		let answer = await this.peerConnection.createAnswer();
		await this.peerConnection.setLocalDescription(answer);

		this.answer = await this.wait();

		ws.socket.Emit("/createAnswer", { from: data.to, to: data.from, data: JSON.stringify(this.answer) });
	}

	async onCall(user, type) {
		await this.createPeerConnection();

		if (type == "screen") {
			this.localStream = await navigator.mediaDevices.getDisplayMedia(this.getType(type));
		} else {
			this.localStream = await navigator.mediaDevices.getUserMedia(this.getType(type));
		}
		this.user1.current.srcObject = this.localStream;
		this.user1.current.muted = true;
		this.localStream.getTracks().forEach((track) => {
			this.peerConnection.addTrack(track, this.localStream);
		});

		let offer = await this.peerConnection.createOffer();
		await this.peerConnection.setLocalDescription(offer);

		this.offer = await this.wait();
		ws.socket.Emit("/createOffer", { type: type, from: this.name, to: user.name, data: JSON.stringify(this.offer) });
	}
}
