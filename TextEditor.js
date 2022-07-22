import {ce, findElement, Vec} from "./util.js";
import {SCROLLBAR_SIZE, TextViewer} from "./TextViewer.js";

const TEXT_EDITOR_CLASS = "text-editor";

export class TextEditor extends TextViewer {
    constructor(props) {
        super(props);

        this.state = Object.assign({
            isSelecting: false,
            curMousePos: null, // only for selecting
            outOfBoundsTimer: null,
            fileContentElement: null,
        }, this.state);

        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    handleMouseDown(e) {
        let p = this.calcMouseEventFilePos(e);

        if (p != null) {
            p = p.bound(this.data.lines, false);

            this.setState({
                isSelecting: true,
                curMousePos: new Vec(e.clientX, e.clientY),
                fileContentElement: findElement(e.currentTarget, (e_ => e_.className == "file-content")),
                outOfBoundsTimer: setInterval(() => {
                    if (this.state.isSelecting && (this.state.curMousePos != null) && (this.state.fileContentElement != null)) {
                        let rect = this.state.fileContentElement.getBoundingClientRect();
                        let x = this.state.curMousePos.x;
                        let y = this.state.curMousePos.y;

                        let dx = 0;
                        if (x < rect.x) {
                            dx -= 1;
                        } else if (x > rect.right - SCROLLBAR_SIZE) {
                            dx += 1;
                        }

                        let dy = 0;
                        if (y < rect.y) {
                            dy -= 1;
                        } else if (y > rect.bottom - SCROLLBAR_SIZE) {
                            dy += 1;
                        }

                        if (dx != 0 || dy != 0) {
                            this.props.onChange(this.data.moveCaretBy(dx, dy, false, true).scrollCaretIntoView(this.nVisibleChars, this.nVisibleLines));
                        }
                    }
                }, 20)
            });

            let newData = this.data.moveCaretTo(p.x, p.y, false).scrollCaretIntoView(this.nVisibleChars, this.nVisibleLines);

            this.props.onChange(newData);
            this.handleFocus();
            super.handleMouseDown();
        }
    }
    
    handleMouseMove(e) {
        if (this.state.isSelecting) {
            this.setState({curMousePos: new Vec(e.clientX, e.clientY)});

            let p = this.calcMouseEventFilePos(e);

            if (p != null) {
                p = p.bound(this.data.lines, false);

                this.props.onChange(this.data.moveCaretTo(p.x, p.y, true));
            }
        } else {
            super.handleMouseMove(e);
        }
    }

    handleMouseUp(e) {
        if (this.state.isSelecting) {
            let p = this.calcMouseEventFilePos(e);

            if (p != null) {
                p = p.bound(this.data.lines, false);

                this.props.onChange(this.data.moveCaretTo(p.x, p.y, true));
            } 

            if (this.state.outOfBoundsTimer != null) {
                clearInterval(this.outOfBoundsTimer);
            }

            this.setState({isSelecting: false, curMousePos: null, outOfBoundsTimer: null, fileContentElement: null});
        } else {
            super.handleMouseUp(e);
        }
    }

    handleKeyPress(e) {
        let data = this.data;
        switch(e.key) {
            case "Enter":
                break;
            case "Delete": // needed for chrome
                data = data.deleteForwards();
                break;
            case "Z":
                if (e.ctrlKey) {
                    data = data.redo();
                } else {
                    data = data.insert(e.key);
                    break;
                }
            default:
                data = data.insert(e.key);
                break;
        }

        if (data != this.data) {
            this.props.onChange(data.scrollCaretIntoView(this.nVisibleChars, this.nVisibleLines));
        }
    }

    handleKeyDown(e) {
        let data = this.data;

        switch(e.key) {
            case "Tab":
                if (e.shiftKey) {
                    data = data.unindentSelection();
                } else {
                    data = data.indentSelection();
                }
                e.preventDefault();
                e.stopPropagation();
                break;
            case "Backspace":
                data = data.deleteBackwards();
                break;
            case "Delete":
                data = this.data.deleteForwards();
                break;
            case "Enter":
            case "Return":
                data = data.insert("\n");
                break;
            case "ArrowLeft":
                if (!e.shiftKey && data.haveSelection) {
                    let p = data.selectionStart;

                    if (e.ctrlKey) {
                        p = data.findPrevWordBoundary(p);
                    }

                    data = data.moveCaretTo(p.x, p.y, false);
                } else {
                    if (e.ctrlKey) {
                        let p = data.findPrevWordBoundary();

                        data = data.moveCaretTo(p.x, p.y, e.shiftKey);
                    } else {
                        data = data.moveCaretBy(-1, 0, true, e.shiftKey);
                    }
                }
                e.preventDefault();
                e.stopPropagation();
                break;
            case "ArrowRight":
                if (!e.shiftKey && data.haveSelection) {
                    let p = data.selectionEnd;

                    if (e.ctrlKey) {
                        p = data.findNextWordBoundary(p);
                    }

                    data = data.moveCaretTo(p.x, p.y, false);
                } else {
                    if (e.ctrlKey) {
                        let p = data.findNextWordBoundary();
                        data = data.moveCaretTo(p.x, p.y, e.shiftKey);
                    } else {
                        data = data.moveCaretBy(1, 0, true, e.shiftKey);
                    }
                }
                e.preventDefault();
                e.stopPropagation();
                break;
            case "ArrowDown":
                data = data.moveCaretBy(0, 1, false, e.shiftKey);
                e.preventDefault();
                e.stopPropagation();
                break;
            case "ArrowUp":
                data = data.moveCaretBy(0, -1, false, e.shiftKey);
                e.preventDefault();
                e.stopPropagation();
                break;
            case "Home":
                if (e.ctrlKey) {
                    data = data.moveCaretTo(0, 0, e.shiftKey);
                } else {
                    let p = data.findFirstNonSpace(data.caretPos.y);
                    data = data.moveCaretTo(p.x, p.y, e.shiftKey);
                }
                e.preventDefault();
                e.stopPropagation();
                break;
            case "End":
                let x = data.lines[data.caretPos.y].length;
                let y = e.ctrlKey ? data.nLines - 1 : data.caretPos.y;
                data = data.moveCaretTo(x, y, e.shiftKey);
                e.preventDefault();
                e.stopPropagation();
                break;
            case "x":
                if (e.ctrlKey && data.haveSelection) {
                    navigator.clipboard.writeText(data.selection);
                    data = data.deleteSelection(true);
                }
                break;
            case "c":
                if (e.ctrlKey && data.haveSelection) {
                    navigator.clipboard.writeText(data.selection);
                }
                break;
            // paste is captured via special paste event
            case "a":
                if (e.ctrlKey) {
                    data = data.selectAll();
                }
                break;
            case "z":
            case "Z":
                if (e.ctrlKey) {
                    if (e.shiftKey) {
                        data = data.redo();
                    } else {
                        data = data.undo();
                    }
                }
                break;
            case "s":
                // keep this save here because the file-editor can grab keyboard input, and the parent editor-tab can't
                if (e.ctrlKey) {
                    this.handleSave();
                    e.preventDefault();
                    e.stopPropagation();
                }
                break;
        }

        if (data != this.data) {
            this.props.onChange(data.scrollCaretIntoView(this.nVisibleChars, this.nVisibleLines));
        }

        super.handleKeyDown(e); // in order to ungrab keyboard in case of Escape
    }

    handlePaste(text) {
        this.props.onChange(this.data.insert(text));
    }

    handleSave() {
        if (this.props.onSave != undefined && this.props.onSave != null) {
            this.props.onSave();

            this.setState({});
        }
    }

    render() {
        return ce(
            "div", {
                id: this.props.id,
                className: TEXT_EDITOR_CLASS,
                tabIndex: "0",
                onFocus: this.handleFocus,
                onBlur: this.handleBlur,
                onKeyPress: this.handleKeyPress,
                onKeyDown: this.handleKeyDown,
                onWheel: this.handleWheel,
            }, 
            this.renderLineNumbers(),
            this.renderContent(this.handleMouseDown),
            ...this.renderDecorations(),
        )
    }
}