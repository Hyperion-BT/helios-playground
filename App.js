import {ce, assertDefined} from "./util.js";
import {AppData} from "./AppData.js";
import {Component} from "./Component.js";
import {EditorTab} from "./EditorTab.js";
import {DebuggerTab} from "./DebuggerTab.js";

const AppMode = {
    Edit: 0,
    Debug: 1,
};

export class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            mode: AppMode.Edit, // tabs know which mode they are, so doesn't need to be part of data that is passed down to child components
            data: AppData.new(assertDefined(this.props.db)),
            keyboardGrabber: null,
            mouseGrabber: null,
        };

        this.handleMouseGrab    = this.handleMouseGrab.bind(this);
        this.handleKeyboardGrab = this.handleKeyboardGrab.bind(this);
        this.handleMouseMove    = this.handleMouseMove.bind(this);
        this.handleMouseUp      = this.handleMouseUp.bind(this);
        this.handlePaste        = this.handlePaste.bind(this);
    }

    static modeName(mode) {
        switch(mode) {
            case AppMode.Edit:
                return "Edit";
            case AppMode.Debug:
                return "Debug";
            default:
                throw new Error("unhandled");
        }
    }

    componentDidMount() {
        window.addEventListener("paste",     this.handlePaste);
        window.addEventListener("mousemove", this.handleMouseMove);
        window.addEventListener("mouseup",   this.handleMouseUp);
    }

    componentWillUnmount() {
        window.removeEventListener("paste",     this.handlePaste);
        window.removeEventListener("mousemove", this.handleMouseMove);
        window.removeEventListener("mouseup",   this.handleMouseUp);
    }
    
    handleMouseGrab(component) {
        this.setState({mouseGrabber: component});
    }

    handleKeyboardGrab(component, ungrab = false) {
        if (ungrab) {
            if (this.state.keyboardGrabber == component) {
                this.setState({keyboardGrabber: null})
            }
        } else {
            this.setState({keyboardGrabber: component});
        }
    }

    handleMouseMove(e) {
        if (this.state.mouseGrabber != null && this.state.mouseGrabber.handleMouseMove != undefined) {
            this.state.mouseGrabber.handleMouseMove(e);
        }
    }

    handleMouseUp(e) {
        if (this.state.mouseGrabber != null && this.state.mouseGrabber.handleMouseUp != undefined) {
            this.state.mouseGrabber.handleMouseUp(e);

            this.setState({
                mouseGrabber: null,
            })
        }
    }

    handlePaste(e) {
        let text = e.clipboardData.getData("text/plain");

        if (this.state.keyboardGrabber != null && this.state.keyboardGrabber.handlePaste != undefined) {
            this.state.keyboardGrabber.handlePaste(text);
        }
    }

    handleTabChange(mode) {
        if (mode != this.state.mode) {
            this.setState({mode: mode});
        }
    }

    handleChangeEditorData(d) {
        this.setState({data: this.state.data.setEditorData(d)});
    }

    handleChangeDebuggerData(d) {
        this.setState({data: this.state.data.setDebuggerData(d)});
    }

    renderLink(mode) {
        return ce("li", null, ce("button", {
            className: "tab-link",
            active: (mode == this.state.mode ? "" : null),
            onClick: () => {this.handleTabChange(mode)}
        }, App.modeName(mode)));
    }

    renderTab() {
        switch(this.state.mode) {
            case AppMode.Edit:
                return ce(EditorTab, {
                    data: this.state.data.editorData,
                    mouseGrabber: this.state.mouseGrabber,
                    keyboardGrabber: this.state.keyboardGrabber,
                    onMouseGrab: this.handleMouseGrab,
                    onKeyboardGrab: this.handleKeyboardGrab,
                    onChange: (d) => {this.handleChangeEditorData(d)}
                });
            case AppMode.Debug:
                return ce(DebuggerTab, {
                    data: this.state.data.debuggerData,
                    mouseGrabber: this.state.mouseGrabber,
                    keyboardGrabber: this.state.keyboardGrabber,
                    onMouseGrab: this.handleMouseGrab,
                    onKeyboardGrab: this.handleKeyboardGrab,
                    onChange: (d) => {this.handleChangeDebuggerData(d)}
                });
            default:
                throw new Error("unhandled");
        }
    }

    render() {
        return ce("div", {id: "app"},
            ce("nav", {id: "tab-overview"}, ce("ul", null, 
                this.renderLink(AppMode.Edit),
                this.renderLink(AppMode.Debug),
            )),
            this.renderTab()
        )
    }
}