import React, { Component } from "react";
import "./comfirm.scss";

let Comfirm = {
	__view: null,
	open: (config = {}) => {
		Comfirm.__view.onOpen(config);
	},
	close: () => {
		Comfirm.__view.onClose();
	},
};

class ComfirmContainer extends Component {
	state = { open: false };

	constructor(props) {
		super(props);
		Comfirm.__view = this;
	}

	title = "";
	text = "";

	onOpen(config = {}) {
		this.submit = () => {
			config.submit && config.submit();
			this.setState({ open: false });
		};
		this.cancel = () => {
			config.cancel && config.cancel();
			this.setState({ open: false });
		};

		this.title = config.title || "";
		this.text = config.text || "";
		this.width = config.width || window.innerWidth / 2;
		this.height = config.height || window.innerHeight / 2;
		this.style = config.style || {};
		this.actions = config.actions || <></>;

		this.setState({ open: true });
	}

	onClose() {
		this.setState({ open: false });
	}

	render() {
		return (
			this.state.open && (
				<div
					className="comfirm"
					style={{
						position: "absolute",
						left: (window.innerWidth - this.width) / 2 + "px",
						top: (window.innerHeight - this.height) / 2 + "px",
						width: this.width,
						height: this.height,
						...this.style,
					}}
				>
					{this.title && this.title}
					{this.text && this.text}
					{this.actions ? (
						this.actions
					) : (
						<div>
							<button autoFocus onClick={() => this.cancel()}>
								取消
							</button>
							<button onClick={() => this.submit()} autoFocus>
								确定
							</button>
						</div>
					)}
				</div>
			)
		);
	}
}

export { ComfirmContainer, Comfirm };
