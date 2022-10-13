
import {ce} from "./util.js";
import {FileData} from "./FileData.js";
import {Component} from "./Component.js";
import {FileSelector} from "./FileSelector.js";
import {TextViewer} from "./TextViewer.js";

export class DebuggerTab extends Component {
    constructor(props) {
        super(props);

        this.handleChangeActive = this.handleChangeActive.bind(this);
        this.handleRun = this.handleRun.bind(this);
        this.handleStep = this.handleStep.bind(this);
        this.handleNext = this.handleNext.bind(this);
        this.handleStepOver = this.handleStepOver.bind(this);
        this.handleStepIn = this.handleStepIn.bind(this);
    }

    handleChangeActive(e) {
        let key = e.target.value;

        this.props.onChange(this.props.data.setActive(key == "" ? null : parseInt(key)));
    }

    handleChangeFileView(data) {
        this.props.onChange(this.props.data.setActiveFileData(data));
    }

    handleChangeIRView(data) {
        this.props.onChange(this.props.data.setActiveIRData(data));
    }

    handleRun() {
        // lets go!
        if (this.props.data.isIdle) {
            this.props.data.program.run([], {
                onPrint: (msg) => {
					return new Promise((resolve, _) => {
						this.props.onChange(this.props.data.addConsoleMessage(msg), resolve);
					});
                }
            }).then((result) => {
				if (result instanceof Error) {
					this.props.onChange(this.props.data.addConsoleMessage(result).setIdle());
				} else {
					this.props.onChange(this.props.data.setStack([["", result]]).setIdle());
				}
            });

            this.props.onChange(this.props.data.startRun());
        }
    }

	handleStep() {
		if (this.props.data.isIdle) {
            this.props.data.program.run([], {
                onPrint: (msg) => {
					return new Promise((resolve, _) => {
						this.props.onChange(this.props.data.addConsoleMessage(msg), resolve);
					});
                },
				onStartCall: (site, stack) => {
					return new Promise((resolve, _) => {
						this.props.onChange(this.props.data.setStack(stack).setWaiter(site, resolve).setCalling());
					});
				},
				onEndCall: (site, stack) => {
					return new Promise((resolve, _) => {
						this.props.onChange(this.props.data.setStack(stack).setWaiter(site, resolve).setStepping());
					});
				}
            }).then((result) => {
				if (result instanceof Error) {
					this.props.onChange(this.props.data.addConsoleMessage(result).setIdle());
				} else {
					this.props.onChange(this.props.data.setStack([["", result]]).setIdle());
				}
            });

            this.props.onChange(this.props.data.startStep());
		} 
	}

	handleNext() {
		if (this.props.data.isStepping && (!this.props.data.isCalling) && this.props.data.waiter != null) {
			this.props.data.waiter();
		}
	}

	handleStepIn() {
		if (this.props.data.isCalling && this.props.data.waiter != null) {
			this.props.data.waiter(false);
		}
	}

	handleStepOver() {
		if (this.props.data.isCalling && this.props.data.waiter != null) {
			this.props.data.waiter(true);
		}
	}

    render() {
        let files = this.props.data.getFiles(this.props.onChange);
        let active = this.props.data.activeKey;

        let children = [ce(FileSelector, {onChange: this.handleChangeActive, data: files, active: active})];

        if (active != null) {            
            if (this.props.data.error != null) {
                children.push(ce(TextViewer, {
                    id: "error-debugger",
                    sizer: "error-debugger-sizer",
                    data: this.props.data.activeFile,
                    mouseGrabber: this.props.mouseGrabber,
                    onMouseGrab: this.props.onMouseGrab,
                    onChange: (data) => {this.handleChangeFileView(data)},
                }));

				children.push(ce("p", {className: "error-message"}, this.props.data.error.message));
            } else if (this.props.data.ir != null) {
                children.push(ce(TextViewer, {
                    id: "debugger",
                    sizer: "debugger-sizer",
                    data: this.props.data.activeFile,
					caretVisible: this.props.data.isStepping ? "" : null,
                    mouseGrabber: this.props.mouseGrabber,
                    onMouseGrab: this.props.onMouseGrab,
                    onChange: (data) => {this.handleChangeFileView(data)},
                }));

                children.push(ce(TextViewer, {
                    id: "ir-debugger",
                    sizer: "ir-debugger-sizer",
                    data: this.props.data.ir,
                    caretVisible: this.props.data.isStepping ? "": null,
                    mouseGrabber: this.props.mouseGrabber,
                    onMouseGrab: this.props.onMouseGrab,
                    onChange: (data) => {this.handleChangeIRView(data)},
                }));

                (this.props.data.isIdle) && children.push(ce("button", {id: "run", onClick: this.handleRun}, "Run"));
				(this.props.data.isIdle) && children.push(ce("button", {id: "step", onClick: this.handleStep}, "Step"));
				(this.props.data.isStepping && (!this.props.data.isCalling)) && children.push(ce("button", {id: "next", onClick: this.handleNext}, "Next"));
				(this.props.data.isCalling) && children.push(ce("button", {id: "step-over", onClick: this.handleStepOver}, "Step over"));
				(this.props.data.isCalling) && children.push(ce("button", {id: "step-in", onClick: this.handleStepIn}, "Step in"));

                children.push(ce("div", {id: "console"}, this.props.data.console.map((msg, i) => {
					if (msg instanceof Error) {
						return msg.message.split("\n").map(part => ce("p", {key: part, className: "runtime-error-message"}, part));
					} else {
						return ce("p", {key: i, className: "message"}, msg);
					}
				})));

                children.push(ce("div", {id: "stack"}, ce("table", null, 
					ce("thead", null, ce("tr", null, ce("th", null, "name"), ce("th", null, "value"))),
					ce("tbody", null,
						this.props.data.stack.reverse().map(([name, value], i) => {
							let isResult = false;
							if (name != null) {
								if (name == "") {
									isResult = true;
									name = "result";
								} else {
									name = name.toString();// could still be a Word token
								}
							} else {
								name = "";
							}

						    return ce("tr", {key: i}, 
						    	isResult ? ce("td", {className: "result"}, name) : ce("td", null, name),
						    	ce("td", null, value.toString())
						    );
						})
					)
				)));
            } else {
                throw new Error("unexpected");
            }
        }

        return ce("div", {id: "debugger-tab"},
            ...children,
        );
    }
}
