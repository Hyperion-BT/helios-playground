
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
            this.props.data.program.run({
                onPrint: (msg) => {
                    this.props.onChange(this.props.data.addConsoleMessage(msg));
                }
            }).then((result) => {
                this.props.onChange(this.props.data.setStack([["", result]]).setIdle());
            });

            this.props.onChange(this.props.data.startRun());
        }
    }

	handleStep() {
		if (this.props.data.isIdle) {
            this.props.data.program.run({
                onPrint: (msg) => {
                    this.props.onChange(this.props.data.addConsoleMessage(msg));
                },
				onNotify: (site, stack) => {
					return new Promise((resolve, _) => {
						this.props.onChange(this.props.data.setStack(stack.list().reverse()).setWaiter(site, resolve));
					});
				}
            }).then((result) => {
                this.props.onChange(this.props.data.setStack([["", result]]).setIdle());
            });

            this.props.onChange(this.props.data.startStep());
		} else if (this.props.data.isStepping && this.props.data.waiter != null) {
			this.props.data.waiter();
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
				(!this.props.data.isRunning) && children.push(ce("button", {id: "step", onClick: this.handleStep}, "Step"));

                children.push(ce("div", {id: "console"}, this.props.data.console.map((msg, i) => {
					return ce("p", {key: i, className: "message"}, msg);
				})));

                children.push(ce("table", {id: "stack"}, 
					ce("thead", null, ce("tr", null, ce("th", null, "name"), ce("th", null, "value"))),
					ce("tbody", null,
						this.props.data.stack.map(([name, value], i) => {
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
						    	isResult ? ce("td", {className: "result"}, "result") : ce("td", null, name),
						    	ce("td", null, value.toString())
						    );
						})
					)
				));
            } else {
                throw new Error("unexpected");
            }
        }

        return ce("div", {id: "debugger-tab"},
            ...children,
        );
    }
}
