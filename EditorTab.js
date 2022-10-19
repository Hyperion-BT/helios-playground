import {helios} from "./helios.js";
import {ce, assertClass, setClipboard, FilePos, SHARE_URL} from "./util.js";
import {EditorData} from "./EditorData.js";
import {Component} from "./Component.js";
import {TextViewer} from "./TextViewer.js";
import {TextEditor} from "./TextEditor.js";

export class EditorTab extends Component {
    constructor(props) {
        super(props);

        this.state = {
            lastOK: null, // null -> no check done before 
			lastOutput: null,
            simplify: true,
        };

        this.handleCreate = this.handleCreate.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this.handleCompile = this.handleCompile.bind(this);
        this.handleDownload = this.handleDownload.bind(this);
		this.handleShare = this.handleShare.bind(this);
		this.handleCopyShareLink = this.handleCopyShareLink.bind(this);
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

    handleDelete() {
        this.data.deleteActiveFile().then((newData) => {
            this.props.onChange(newData);
        });
    }

    handleCompile() {
        let raw = this.data.activeFile.raw;

        if (raw != null) {
            try {
                let output = helios.Program.new(raw).compile(this.state.simplify).serialize();

                this.setState({lastOK: raw, lastOutput: output});
            } catch (e) {
                if (!(e instanceof helios.UserError)) {
                    throw e;
                }

                this.setState({lastOK: null, lastOutput: null});

                let newData = this.data.updateActive(fileData => {
                    return TextViewer.scrollErrorToCenter(fileData, e, "error-editor-sizer");
                });

                this.props.onChange(newData);
            }
        }
    }

	handleDownload() {
		let output = this.state.lastOutput;

		if (output !== undefined && output !== null && this.props.data.activeFile !== null) {
			let name = this.props.data.activeFile.name;
			let blob = new Blob([output], {type: 'text/plain'});

			let link = document.createElement('a');
			link.style.display = 'none';
			document.body.appendChild(link);
			link.href = URL.createObjectURL(blob);
			link.download = `${name}.hl`;
			link.click();

			document.body.removeChild(link);
		}
	}

	// TODO: how to prevent double submit?
	// TODO: show a dialog with share link, or with error
	handleShare(e) {
		e.currentTarget.disabled = true;

		const reject = (msg) => {
			this.props.onChange(this.data.updateActive(fileData => {
				return fileData.setShare(new Error(msg));
			}));
		};

		const resolve = (link) => {
			this.props.onChange(this.data.updateActive(fileData => {
				return fileData.setShare(link);
			}));
		};

		let raw = this.data.activeFile.raw;

		const reqObj = {
			"action": "put",
			"data": raw,
		};

		let req = new XMLHttpRequest();

		req.onerror = (e) => {
			reject("Connection error");
		};

		req.onload = (_) => {
			if (req.status == 200) {
				let respObj = JSON.parse(req.responseText);

				let key = respObj.key;

				if (key === undefined) {
					reject("Response format error");
				} else {
					let link = `${window.location.protocol}//${window.location.host}${window.location.pathname}?share=${key}`;
					resolve(link);
				}
			} else {
				reject(req.responseText);
			}
		};

		req.open("POST", SHARE_URL);
		req.setRequestHeader("Content-Type", "application/json");

		req.send(JSON.stringify(reqObj));
	}

	handleCopyShareLink() {
		setClipboard(this.data.activeFile.share);
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

			let isActive = key == this.data.activeKey;

            let li = ce("li", null, ce("button", {
                key: key,
                className: "file-link",
                "name-error": nameError,
                active: (isActive ? "" : null),
                onClick: (isActive ? null : () => {this.handleClickFileLink(key)}),
            }, caption));

            fileList.push(li);
        });
        
        let isActive = this.data.activeKey != null;
        let wasOK = isActive && (this.data.activeFile.raw == this.state.lastOK);
        let wasError = isActive && this.data.activeFile.error != null;
        let simplify = this.state.simplify;

        return ce("div", {id: "editor-tab"},
            ce("button", {id: "new-file", onClick: this.handleCreate}, "New"),
            ce("nav", {id: "file-overview"}, ce("ul", null, ...fileList)),
            isActive && (
                ce("div", {className: "simplify-wrapper"}, 
                        ce("label", {htmlFor: "simplify"}, "Simplify output"),
                        ce("input", {id: "simplify", type: "checkbox", checked: simplify, onChange: (e) => {this.setState({lastOK: "", simplify: e.target.checked})}})
                )
            ),
            isActive && (
                wasOK ? 
                (this.data.activeFile.purpose != "testing" ? 
					ce("button", {id: "download", onClick: this.handleDownload}, "Download") :
					ce("div", {id: "file-is-valid"}, "OK")
				) : 
                ce("button", {id: "compile", onClick: this.handleCompile}, "Compile")
            ),
			isActive && wasOK && (
				(this.data.activeFile.share === null ?
					ce("button", {id: "share", onClick: this.handleShare}, "Share") :
					(this.data.activeFile.share instanceof Error ?
						ce("div", {id: "share-error"}, this.data.activeFile.share.message) :
						ce("div", {id: "share-link"}, 
							ce("a", null, this.data.activeFile.share),
						)
					)
				)
			),
            isActive && ce("button", {id: "delete", onClick: this.handleDelete}, "Delete"),
            wasError && ce("p", {className: "error-message"}, this.data.activeFile.error.message),
            isActive && ce(TextEditor, {
                id: wasError ? "error-editor" : "editor",
                sizer: wasError ? "error-editor-sizer" : "editor-sizer",
                pulsatingCaret: "",
                data: files.get(this.data.activeKey),
                mouseGrabber: this.props.mouseGrabber,
                keyboardGrabber: this.props.keyboardGrabber,
                onMouseGrab: this.props.onMouseGrab,
                onKeyboardGrab: this.props.onKeyboardGrab,
                onChange: (data) => {this.handleFileEditorChange(data)},
            }),
        );
    }
}
