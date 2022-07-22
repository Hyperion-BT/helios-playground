
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
        if (!this.props.data.isRunning) {
            this.props.data.program.run({
                onPrint: (msg) => {
                    this.props.onChange(this.props.data.addConsoleMessage(msg));
                }
            }).then((result) => {
                this.props.onChange(this.props.data.pushStackVariable(["", result]).endRun());
            });

            this.props.onChange(this.props.data.startRun());
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
                    mouseGrabber: this.props.mouseGrabber,
                    onMouseGrab: this.props.onMouseGrab,
                    onChange: (data) => {this.handleChangeIRView(data)},
                }));

                (!this.props.data.isRunning) && children.push(ce("button", {id: "run", onClick: this.handleRun}, "Run"));

                children.push(ce("div", {id: "console"}, []));

                children.push(ce("div", {id: "stack"}, []));
            } else {
                throw new Error("unexpected");
            }
        }

        return ce("div", {id: "debugger-tab"},
            ...children,
        );
    }
}