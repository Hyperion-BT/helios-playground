import {ce, assertClass} from "./util.js";
import {EditorData} from "./EditorData.js";
import {Component} from "./Component.js";
import {FileEditor} from "./FileEditor.js";

export class EditorTab extends Component {
    constructor(props) {
        super(props);
    }

    get data() {
        return assertClass(this.props.data, EditorData);
    }

    handleClickFileLink(key) {
        this.props.onChange(this.data.setActive(key));
    }

    handleClickNewFile() {
        this.data.db.newFile().then(
            key => {
                void this.data.getFiles(this.props.onChange);
            }
        );
    }

    handleFileEditorChange(fileData) {
        this.props.onChange(this.data.setActiveFileData(fileData));
    } 

    handleSave(raw) {
        void this.data.saveActiveFile(raw);
    }

    render() {
        let files = this.data.getFiles(this.props.onChange);

        let fileList = [];
        files.forEach((fileData, key) => {
            let li = ce("li", null, ce("button", {
                key: key,
                className: "file-link",
                active: (key == this.data.active ? "" : null),
                onClick: () => {this.handleClickFileLink(key)},
            }, fileData.name));

            fileList.push(li);
        });

        return ce("div", {id: "editor-tab"},
            ce("button", {id: "new-file", onClick: () => {this.handleClickNewFile()}}, "New"),
            ce("nav", {id: "file-overview"}, ce("ul", null, ...fileList)),
            this.data.active != null && ce(FileEditor, {
                id: "editor",
                sizer: "editor-sizer",
                data: files.get(this.data.active),
                mouseGrabber: this.props.mouseGrabber,
                keyboardGrabber: this.props.keyboardGrabber,
                onMouseGrab: this.props.onMouseGrab,
                onKeyboardGrab: this.props.onKeyboardGrab,
                onChange: (data) => {this.handleFileEditorChange(data)},
                onSave: (raw) => {this.handleSave(raw)}
            }),
        );
    }
}