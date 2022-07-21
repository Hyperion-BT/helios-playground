import {SPACE, ce, assertClass, formatPaddedInt, findElement, Vec, FilePos} from "./util.js";
import {FileData} from "./FileData.js";
import {Component} from "./Component.js";
import {Caret} from "./Caret.js";

const refTextElement = document.getElementById("text-sizer");

export class FileEditor extends Component {
    constructor(props) {
        super(props);

        this.state = {
            isSelecting: false,
            isHorScrolling: false,
            isVerScrolling: false,
            curMousePos: null, // only set selecting
            outOfBoundsTimer: null,
            fileContentElement: null,
            scrollStart: null, // pair of mouse pos and start viewPos, viewPos is only committed when scrolling ends
        };

        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleHorScrollbarThumbMouseDown = this.handleHorScrollbarThumbMouseDown.bind(this);
        this.handleHorScrollbarTrackMouseDown = this.handleHorScrollbarTrackMouseDown.bind(this);
        this.handleVerScrollbarThumbMouseDown = this.handleVerScrollbarThumbMouseDown.bind(this);
        
        this.handleVerScrollbarTrackMouseDown = this.handleVerScrollbarTrackMouseDown.bind(this);
        
        this.handleResize = this.handleResize.bind(this);
    }

    get data() {
        return assertClass(this.props.data, FileData);
    }

    get charWidth() {
        return refTextElement.getBoundingClientRect().width/26;
    }

    get lineHeight() {
        return refTextElement.getBoundingClientRect().height;
    }

    get scrollbarSize() {
        return 16; // px
    }

    get outerWidth() {
        return document.getElementById(this.props.sizer).getBoundingClientRect().width;
    }

    get outerHeight() {
        return document.getElementById(this.props.sizer).getBoundingClientRect().height;
    }

    get lineNumberPadding() {
        return 2*this.charWidth;
    }

    get nLineNumberDigits() {
        return Math.max(Math.ceil(Math.log10(this.data.nLines)), 2); // at least 2
    }

    // in px
    get lineNumberColumnWidth() {
        return this.lineNumberPadding + this.nLineNumberDigits*this.charWidth;
    }

    get innerWidth() {
        return this.outerWidth - this.scrollbarSize - this.lineNumberColumnWidth;
    }

    get innerHeight() {
        return this.outerHeight - this.scrollbarSize;
    }

    get nVisibleChars() {
        return Math.floor(this.innerWidth/this.charWidth);
    }
    
    get nVisibleLines() {
        return Math.floor(this.innerHeight/this.lineHeight);
    }

    // one extra char to accomodate caret at end-of-line
    get fileWidth() {
        return (this.data.maxLineChars + 1)*this.charWidth;
    }

    get fileHeight() {
        return this.data.nLines*this.lineHeight;
    }

    get hasHorOverflow() {
        return this.fileWidth > this.innerWidth;
    }

    get horScrollbarThumbLength() {
        return this.innerWidth*Math.min(1, this.innerWidth/this.fileWidth);
    }

    get horScrollbarThumbPos() {
        if (this.data.maxLineChars <= this.nVisibleChars) {
            return 0;
        } else {
            return this.innerWidth*this.data.viewPos.x/(this.data.maxLineChars+1);
        }
    }

    get verScrollbarThumbLength() {
        return this.innerHeight*Math.min(1, this.innerHeight/this.fileHeight);
    }

    get verScrollbarThumbPos() {
        if (this.data.nLines <= this.nVisibleLines) {
            return 0;
        } else {
            return this.innerHeight*this.data.viewPos.y/this.data.nLines;
        }
    }

    get hasVerOverflow() {
        return this.fileHeight > this.innerHeight;
    }

    calcMouseEventFilePos(e) {
        let target = findElement(e.target, elem => elem.className == "file-editor");
        if (target == null) {
            return null;
        }

        let rect = target.getBoundingClientRect();
        let x0 = rect.x + this.lineNumberColumnWidth;
        let y0 = rect.y;

        let lineHeight = this.lineHeight;
        let charWidth = this.charWidth;

        let x = Math.floor((e.clientX - x0)/charWidth);
        let y = Math.floor((e.clientY - y0)/lineHeight);    
        
        return (new FilePos(x, y)).add(this.data.viewPos);
    }

    boundViewPos(p) {
        let x = p.x;
        let y = p.y;

        if (Number.isNaN(x) || x < 0) {
            x = 0;
        } else if (this.data.maxLineChars < this.nVisibleChars) {
            x = 0;
        } else if (x > this.data.maxLineChars - this.nVisibleChars + 1) {
            x = this.data.maxLineChars - this.nVisibleChars + 1;
        }

        if (Number.isNaN(y) || y < 0) {
            y = 0;
        } else if (this.data.nLines < this.nVisibleLines) {
            y = 0;
        } else if (y > this.data.nLines - this.nVisibleLines) {
            y = this.data.nLines - this.nVisibleLines;
        }

        return new FilePos(x, y);
    }

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
    }
      
    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
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
                        } else if (x > rect.right - this.scrollbarSize) {
                            dx += 1;
                        }

                        let dy = 0;
                        if (y < rect.y) {
                            dy -= 1;
                        } else if (y > rect.bottom - this.scrollbarSize) {
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
        } else if (this.state.isHorScrolling) {
            let clientDelta = e.clientX - this.state.scrollStart[0];

            let frac = clientDelta/this.innerWidth;

            let charDelta = this.fileWidth*frac/this.charWidth;

            let x = this.state.scrollStart[1] + Math.round(charDelta);

            this.props.onChange(this.data.setViewPos(this.boundViewPos(new FilePos(x, this.data.viewPos.y))));
        } else if (this.state.isVerScrolling) {
            let clientDelta = e.clientY - this.state.scrollStart[0];

            let frac = clientDelta/this.innerHeight;

            let lineDelta = this.fileHeight*frac/this.lineHeight;

            let y = this.state.scrollStart[1] + Math.round(lineDelta);

            this.props.onChange(this.data.setViewPos(this.boundViewPos(new FilePos(this.data.viewPos.x, y))));
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
        } else if (this.state.isVerScrolling) {
            this.setState({
                isVerScrolling: false,
                scrollStart: null,
            });
        } else if (this.state.isHorScrolling) {
            this.setState({
                isHorScrolling: false,
                scrollStart: null,
            });
        }
    }

    handleHorScrollbarThumbMouseDown(e) {
        this.setState({
            isHorScrolling: true,
            scrollStart: [e.clientX, this.data.viewPos.x],
        });

        e.stopPropagation();
        super.handleMouseDown();
    }

    handleHorScrollbarTrackMouseDown(e) {
        let rect = e.currentTarget.getBoundingClientRect();

        let frac = (e.clientX - rect.x)/rect.width - 0.5*this.horScrollbarThumbLength/this.innerWidth;

        let x = Math.round(this.fileWidth*frac/this.charWidth);

        this.props.onChange(this.data.setViewPos(this.boundViewPos(new FilePos(x, this.data.viewPos.y))));

        e.stopPropagation();
        super.handleMouseDown();
    }

    handleVerScrollbarThumbMouseDown(e) {
        this.setState({
            isVerScrolling: true,
            scrollStart: [e.clientY, this.data.viewPos.y],
        });

        e.stopPropagation();
        super.handleMouseDown();
    }

    handleVerScrollbarTrackMouseDown(e) {
        let rect = e.currentTarget.getBoundingClientRect();

        let frac = (e.clientY - rect.y)/rect.height - 0.5*this.verScrollbarThumbLength/this.innerHeight;

        let y = Math.round(this.fileHeight*frac/this.lineHeight);

        this.props.onChange(this.data.setViewPos(this.boundViewPos(new FilePos(this.data.viewPos.x, y))));

        e.stopPropagation();
        super.handleMouseDown();
    }

    handleWheel(e) {
        let dx = 0;
        let dy = 0;

        if (e.deltaX < 0) {
            dx = 1;
        } else {
            dx = -1;
        }

        if (e.deltaY < 0) {
            dy = 1;
        } else {
            dy = -1;
        }

        if (Math.abs(dx) <= Math.abs(dy)) {
            dx = 0;
        } else {
            dy = 0;
        }

        this.props.onChange(this.data.setViewPos(this.boundViewPos(this.data.viewPos.add(new FilePos(dx, dy)))));
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

    handleResize() {
        // TODO: recalc optimal viewPos
        //this.mutateInternal({lines: this.lines, pos0: this.pos0, pos1: this.pos1});
        this.setState({});
    }

    handleSave() {
        if (this.props.onSave != undefined && this.props.onSave != null) {
            let raw = this.data.raw;

            this.props.onSave(raw);

            this.setState({});
        }
    }

    renderLineNumber(lineNo) {
        return ce("span", {className: "line-number"}, lineNo);
    }

    renderLine(text, xCaret, xSelStart, xSelEnd) {
        let inner;

        let caretVisible = this.isGrabbingKeyboard;

        if (xCaret == null) {
            if (xSelStart == null && xSelEnd == null) {
                inner = [ce("span", null, text)];
            } else if (xSelStart == 0 && xSelEnd == text.length) {
                inner = [ce("span", {className: "selection"}, text)];
            } else if ((xSelStart == null || xSelStart == 0) && xSelEnd != null) {
                inner = [
                    ce("span", {className: "selection"}, text.slice(0, xSelEnd)),
                    ce("span", null, text.slice(xSelEnd)),
                ];
            } else if (xSelStart != null && (xSelEnd == null || xSelEnd == text.length)) {
                inner = [
                    ce("span", null, text.slice(0, xSelStart)),
                    ce("span", {className: "selection"}, text.slice(xSelStart)),
                ];
            } else if (xSelStart != null && xSelEnd != null) {
                assert(xSelStart <= xSelEnd);
                inner = [
                    ce("span", null, text.slice(0, xSelStart)),
                    ce("span", {className: "selection"}, text.slice(xSelStart, xSelEnd)),
                    ce("span", null, text.slice(xSelEnd)),
                ];
            } else {
                throw new Error("unhandled");
            }
        } else if (xSelStart == null && xSelEnd == null) {
            inner = [
                ce("span", null, text.slice(0, xCaret)),
                caretVisible && Caret.new(),
                ce("span", null, text.slice(xCaret)),
            ];
        } else if (xCaret == xSelStart && (xSelEnd == null || xSelEnd == text.length)) {
            inner = [
                ce("span", null, text.slice(0, xCaret)),
                caretVisible && Caret.new(),
                ce("span", {className: "selection"}, text.slice(xCaret)),
            ];
        } else if (xCaret == xSelStart && xSelEnd != null) {
            inner = [
                ce("span", null, text.slice(0, xCaret)),
                caretVisible && Caret.new(),
                ce("span", {className: "selection"}, text.slice(xCaret, xSelEnd)),
                ce("span", null, text.slice(xSelEnd)),
            ];
        } else if (xCaret == xSelEnd && (xSelStart == null || xSelStart == 0)) {
            inner = [
                ce("span", {className: "selection"}, text.slice(0, xCaret)),
                caretVisible && Caret.new(),
                ce("span", null, text.slice(xCaret)),
            ];
        } else if (xCaret == xSelEnd && xSelStart != null) {
            inner = [
                ce("span", null, text.slice(0, xSelStart)),
                ce("span", {className: "selection"}, text.slice(xSelStart, xCaret)),
                caretVisible && Caret.new(),
                ce("span", null, text.slice(xCaret)),
            ];
        } else {
            throw new Error("unhandled");
        }

        return ce("p", null, ...inner);
    }

    render() {
        let caretPos = this.data.caretPos;
        let selStart = this.data.selectionStart;
        let selEnd   = this.data.selectionEnd;

        let nDigits = this.nLineNumberDigits;

        // TODO: only show lines in view
        let lineNumbers = [];
        let contentLines = [];

        let y0 = this.data.viewPos.y;

        for (let y = y0; y < Math.min(y0 + Math.ceil((this.innerHeight + this.scrollbarSize)/this.lineHeight), this.data.nLines); y++) {
            let lineNumber = SPACE + formatPaddedInt(y + 1, nDigits) + SPACE;

            lineNumbers.push(this.renderLineNumber(lineNumber));

            let line = this.data.lines_[y];
            contentLines.push(
                this.renderLine(
                    line,
                    caretPos.y == y ? caretPos.x : null, 
                    selStart.y == y ? selStart.x : (y > selStart.y && y < selEnd.y ? 0 : null),
                    selEnd.y == y ? selEnd.x : (y > selStart.y && y < selEnd.y ? line.length : null)
                )
            );
        }

        return [
            (this.props.onSave != null) && ce("button", {key: "save", id: "save-file", onClick: () => {this.handleSave()}}, "Save"),
            ce(
                "div", {
                    key: "editor",
                    id: this.props.id,
                    className: "file-editor",
                    tabIndex: "0",
                    onFocus: this.handleFocus,
                    onBlur: this.handleBlur,
                    onKeyPress: this.handleKeyPress,
                    onKeyDown: this.handleKeyDown,
                    onWheel: this.handleWheel,
                    style: {fontFamily: "monospace", userSelect: "none"},
                }, 
                ce("div", {className: "line-number-column", style: {width: this.lineNumberColumnWidth.toString() + "px"}}, ...lineNumbers),
                ce("div", {className: "bottom-left-corner"}),
                ce("div", {
                    className: "file-content",
                    style: {left: (-this.data.viewPos.x*this.charWidth).toString() + "px"},
                    onMouseDown: this.handleMouseDown,
                }, ...contentLines),
                ce("div", {className: "hor-scrollbar", onMouseDown: this.handleHorScrollbarTrackMouseDown},
                    this.hasHorOverflow && ce("div", {
                        className: "hor-scrollbar-thumb", 
                        onMouseDown: this.handleHorScrollbarThumbMouseDown,
                        style: {
                            width: this.horScrollbarThumbLength.toString() + "px",
                            left: (this.horScrollbarThumbPos).toString() + "px",
                        }
                    })
                ),
                ce("div", {className: "ver-scrollbar", onMouseDown: this.handleVerScrollbarTrackMouseDown}, 
                    this.hasVerOverflow && ce("div", {
                        className: "ver-scrollbar-thumb", 
                        onMouseDown: this.handleVerScrollbarThumbMouseDown,
                        style: {
                            height: this.verScrollbarThumbLength.toString() + "px",
                            top:   (this.verScrollbarThumbPos).toString() + "px",
                        }
                    })
                ),
                ce("div", {className: "bottom-right-corner"}),
            )
        ];
    }
}