import * as helios from "./helios.js";
import {ce, assertClass, FilePos} from "./util.js";
import {EditorData} from "./EditorData.js";
import {Component} from "./Component.js";
import {TextViewer} from "./TextViewer.js";
import {TextEditor} from "./TextEditor.js";

export class EditorTab extends Component {
    constructor(props) {
        super(props);

        this.state = {
            lastOK: null, // null -> no check done before 
        };

        this.handleCreate = this.handleCreate.bind(this);
        this.handleSave = this.handleSave.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this.handleCheck = this.handleCheck.bind(this);
    }

    static getDerivedStateFromProps(props, state) {
        state = Object.assign({}, state);

        if ((props.data.activeFile == null) || (props.data.activeFile.raw == null) || (props.data.activeFile.raw != state.lastOK)) {
            state.lastOK = null;
        }
        
        return state;
    }

    get data() {
        return assertClass(this.props.data, EditorData);
    }

    handleClickFileLink(key) {
        this.props.onChange(this.data.setActive(key));
    }

    handleCreate() {
        this.data.db.newFile().then(
            key => {
                void this.data.getFiles(this.props.onChange);
            }
        );
    }

    handleFileEditorChange(fileData) {
        this.props.onChange(this.data.setActiveFileData(fileData));
    } 

    handleSave() {
        this.data.saveActiveFile().then(() => {
            // unnecessary to use this.props.onChange()
            this.setState({});
        });
    }

    handleDelete() {
        this.data.deleteActiveFile().then((newData) => {
            this.props.onChange(newData);
        });
    }

    handleCheck() {
        let raw = this.data.activeFile.raw;

        if (raw != null) {
            try {
                void helios.compile(raw, {stage: helios.CompilationStage.Untype});

                this.setState({lastOK: raw});
            } catch (e) {
                if (!(e instanceof helios.UserError)) {
                    throw e;
                }

                this.setState({lastOK: null});

                let newData = this.data.updateActive(fileData => {
                    return TextViewer.scrollErrorToCenter(fileData, e, "error-editor-sizer");
                });

                this.props.onChange(newData);
            }
        }
    }

    render() {
        let files = this.data.getFiles(this.props.onChange);

        let fileList = [];
        files.forEach((fileData, key) => {
            let name = fileData.name;
            let nameError = null;
            let caption;
            if (name == "") {
                nameError = "empty";
                caption = "empty";
            } else if (name == null) {
                nameError = "invalid-header";
                caption = "invalid header";
            } else {
                caption = name;
            }

            let li = ce("li", null, ce("button", {
                key: key,
                className: "file-link",
                "name-error": nameError,
                active: (key == this.data.activeKey ? "" : null),
                onClick: () => {this.handleClickFileLink(key)},
            }, caption));

            fileList.push(li);
        });
        
        let isActive = this.data.activeKey != null;
        let dirty = this.data.isActiveDirty;
        let wasOK = isActive && (this.data.activeFile.raw == this.state.lastOK);
        let wasError = isActive && this.data.activeFile.error != null;

        return ce("div", {id: "editor-tab"},
            ce("button", {id: "new-file", onClick: this.handleCreate}, "New"),
            ce("nav", {id: "file-overview"}, ce("ul", null, ...fileList)),
            isActive && (wasOK ? 
                ce("div", {id: "file-is-valid"}, "OK") : 
                ce("button", {id: "check-file", onClick: this.handleCheck}, "Check")),
            dirty && ce("button", {id: "save-file", onClick: this.handleSave}, "Save"),
            isActive && ce("button", {id: "delete-file", onClick: this.handleDelete}, "Delete"),
            wasError && ce("p", {className: "error-message"}, this.data.activeFile.error.message),
            isActive && ce(TextEditor, {
                id: wasError ? "error-editor" : "editor",
                sizer: wasError ? "error-editor-sizer" : "editor-sizer",
                data: files.get(this.data.activeKey),
                mouseGrabber: this.props.mouseGrabber,
                keyboardGrabber: this.props.keyboardGrabber,
                onMouseGrab: this.props.onMouseGrab,
                onKeyboardGrab: this.props.onKeyboardGrab,
                onChange: (data) => {this.handleFileEditorChange(data)},
                onSave: (dirty ? this.handleSave : null),
            }),
        );
    }
}