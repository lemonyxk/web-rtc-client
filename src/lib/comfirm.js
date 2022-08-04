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

		this.setState({ open: true });
	}

	onClose() {
		this.setState({ open: false });
	}

	render() {
		return (
			this.state.open && (
				<div className="comfirm">
					<div id="responsive-dialog-title">{this.title}</div>
					<div>
						<div>{this.text}</div>
					</div>
					<div>
						<button autoFocus onClick={() => this.cancel()}>
							取消
						</button>
						<button onClick={() => this.submit()} autoFocus>
							确定
						</button>
					</div>
				</div>
			)
		);
	}
}

export { ComfirmContainer, Comfirm };
