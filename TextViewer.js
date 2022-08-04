import * as helios from "./external/helios.js";
import {SPACE, ce, assert, assertClass, formatPaddedInt, findElement, FilePos} from "./util.js";
import {FileData} from "./FileData.js";
import {Caret} from "./Caret.js";
import {Component} from "./Component.js";

const refTextElement = document.getElementById("text-sizer");
export const SCROLLBAR_SIZE = 16; // px
const LINE_NUMBER_MARGIN_RIGHT = 2; // px
const TEXT_VIEWER_CLASS = "text-viewer";

export class TextViewer extends Component {
    constructor(props) {
        super(props);

        this.state = {
            isHorScrolling: false,
            isVerScrolling: false,
            scrollStart: null, // pair of mouse pos and start viewPos, viewPos is only committed when scrolling ends
        };

        this.handleResize = this.handleResize.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleHorScrollbarThumbMouseDown = this.handleHorScrollbarThumbMouseDown.bind(this);
        this.handleHorScrollbarTrackMouseDown = this.handleHorScrollbarTrackMouseDown.bind(this);
        this.handleVerScrollbarThumbMouseDown = this.handleVerScrollbarThumbMouseDown.bind(this);
        this.handleVerScrollbarTrackMouseDown = this.handleVerScrollbarTrackMouseDown.bind(this);
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
        return this.lineNumberPadding + this.nLineNumberDigits*this.charWidth + LINE_NUMBER_MARGIN_RIGHT;
    }

    get innerWidth() {
        return this.outerWidth - SCROLLBAR_SIZE - this.lineNumberColumnWidth;
    }

    get innerHeight() {
        return this.outerHeight - SCROLLBAR_SIZE;
    }

    get nVisibleChars() {
        return Math.floor(this.innerWidth/this.charWidth);
    }
    
    get nVisibleLines() {
        return Math.floor(this.innerHeight/this.lineHeight);
    }

    static estimateNumVisibleLines(sizerId) {
        let outerHeight = document.getElementById(sizerId).getBoundingClientRect().height;
        let innerHeight = outerHeight - SCROLLBAR_SIZE;
        let lineHeight = refTextElement.getBoundingClientRect().height;

        return Math.floor(innerHeight/lineHeight);
    }

    // refactor functions above with one part as a static member so the logic can be reused here
    static estimateNumVisibleChars(nLines, sizerId) {
        let outerWidth = document.getElementById(sizerId).getBoundingClientRect().width;
        let nLineNumberDigits = Math.max(Math.ceil(Math.log10(nLines)), 2);
        let charWidth = refTextElement.getBoundingClientRect().width/26;
        let innerWidth = outerWidth - SCROLLBAR_SIZE - ((2 + nLineNumberDigits)*charWidth + LINE_NUMBER_MARGIN_RIGHT);
        return Math.floor(innerWidth/charWidth);
    }

    static scrollCaretToCenter(data, sizer) {
        assertClass(data, FileData);
        let nLines = data.nLines;

        let nVisibleChars = TextViewer.estimateNumVisibleChars(nLines, sizer);
        let nVisibleLines = TextViewer.estimateNumVisibleLines(sizer);
        
        return data.scrollCaretToCenter(nVisibleChars, nVisibleLines);
    }

	static scrollCaretIntoView(data, sizer) {
        assertClass(data, FileData);
        let nLines = data.nLines;

        let nVisibleChars = TextViewer.estimateNumVisibleChars(nLines, sizer);
        let nVisibleLines = TextViewer.estimateNumVisibleLines(sizer);

		return data.scrollCaretIntoView(nVisibleChars, nVisibleLines);
	}

    static scrollErrorToCenter(data, error, sizer) {
        return TextViewer.scrollCaretToCenter(data.setError(error), sizer);
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
        let target = findElement(e.target, elem => elem.className.startsWith("text-"));
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

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
    }
      
    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }

    handleResize() {
        this.props.onChange(this.data.boundViewPos(this.nVisibleChars, this.nVisibleLines));
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

        this.props.onChange(this.data.setViewPos(this.data.viewPos.add(new FilePos(dx,dy))).boundViewPos(this.nVisibleChars, this.nVisibleLines));
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

        this.props.onChange(this.data.setViewPos(new FilePos(x, this.data.viewPos.y)).boundViewPos(this.nVisibleChars, this.nVisibleLines));

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

        this.props.onChange(this.data.setViewPos(new FilePos(this.data.viewPos.x, y)).boundViewPos(this.nVisibleChars, this.nVisibleLines));

        e.stopPropagation();
        super.handleMouseDown();
    }

    handleMouseMove(e) {
        if (this.state.isHorScrolling) {
            let clientDelta = e.clientX - this.state.scrollStart[0];

            let frac = clientDelta/this.innerWidth;

            let charDelta = this.fileWidth*frac/this.charWidth;

            let x = this.state.scrollStart[1] + Math.round(charDelta);

            this.props.onChange(this.data.setViewPos(new FilePos(x, this.data.viewPos.y)).boundViewPos(this.nVisibleChars, this.nVisibleLines));
        } else if (this.state.isVerScrolling) {
            let clientDelta = e.clientY - this.state.scrollStart[0];

            let frac = clientDelta/this.innerHeight;

            let lineDelta = this.fileHeight*frac/this.lineHeight;

            let y = this.state.scrollStart[1] + Math.round(lineDelta);

            this.props.onChange(this.data.setViewPos(new FilePos(this.data.viewPos.x, y)).boundViewPos(this.nVisibleChars, this.nVisibleLines));
        }
    }

    handleMouseUp(e) {
        if (this.state.isVerScrolling) {
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

    renderCaret() {
        return Caret.new(this.props.pulsatingCaret != null);
    }

    renderLineNumber(lineNo) {
        return ce("span", {key: lineNo, className: "line-number"}, lineNo);
    }

    renderLineNumbers() {
        let lineNumbers = [];

        let nDigits = this.nLineNumberDigits;
        let y0 = this.data.viewPos.y;

        assert(y0%1.0 == 0);

        for (let y = y0; y < Math.min(y0 + Math.ceil((this.innerHeight + SCROLLBAR_SIZE)/this.lineHeight), this.data.nLines); y++) {
            let lineNumber = SPACE + formatPaddedInt(y + 1, nDigits) + SPACE;

            lineNumbers.push(this.renderLineNumber(lineNumber));
        }

        return ce("div", {className: "line-number-column", style: {width: this.lineNumberColumnWidth.toString() + "px"}}, lineNumbers);
    }

	renderText(text, highlighting, start, end) {
		let elems = [];

		let prev = start;
		let h = highlighting[start];

		if (h !== undefined) {
			for (let i = start+1; i < end; i++) {
				if (highlighting[i] != h) {
					elems.push(ce("span", {"c": h.toString()}, text.slice(prev, i)));
					h = highlighting[i];
					prev = i;
				}
			}
			
			if (prev < end) {
				if (h !== undefined) {
					elems.push(ce("span", {"c": h.toString()}, text.slice(prev, end)));
				}
			}
		}

		if (elems.length == 0) {
			elems.push(ce("span", null, ""));
		}

		return elems;
	}

    renderContentLine(y, text, highlighting, xCaret, xSelStart, xSelEnd) {
        let inner;

        if (xCaret == null) {
            if (xSelStart == null && xSelEnd == null) {
                inner = this.renderText(text, highlighting, 0, text.length);
            } else if (xSelStart == 0 && xSelEnd == text.length) {
                inner = [ce("span", {className: "selection"}, text)];
            } else if ((xSelStart == null || xSelStart == 0) && xSelEnd != null) {
                inner = [
                    ce("span", {className: "selection"}, text.slice(0, xSelEnd)),
                    ...this.renderText(text, highlighting, xSelEnd, text.length),
                ];
            } else if (xSelStart != null && (xSelEnd == null || xSelEnd == text.length)) {
                inner = [
                    ...this.renderText(text, highlighting, 0, xSelStart),
                    ce("span", {className: "selection"}, text.slice(xSelStart)),
                ];
            } else if (xSelStart != null && xSelEnd != null) {
                assert(xSelStart <= xSelEnd);
                inner = [
					...this.renderText(text, highlighting, 0, xSelStart),
                    ce("span", {className: "selection"}, text.slice(xSelStart, xSelEnd)),
					...this.renderText(text, highlighting, xSelEnd, text.length),
                ];
            } else {
                throw new Error("unhandled");
            }
        } else if (xSelStart == null && xSelEnd == null) {
            inner = [
				...this.renderText(text, highlighting, 0, xCaret),
                this.renderCaret(),
				...this.renderText(text, highlighting, xCaret, text.length),
            ];
        } else if (xCaret == xSelStart && (xSelEnd == null || xSelEnd == text.length)) {
            inner = [
				...this.renderText(text, highlighting, 0, xCaret),
                this.renderCaret(),
                ce("span", {className: "selection"}, text.slice(xSelStart)),
            ];
        } else if (xCaret == xSelStart && xSelEnd != null) {
            inner = [
				...this.renderText(text, highlighting, 0, xCaret),
                this.renderCaret(),
                ce("span", {className: "selection"}, text.slice(xCaret, xSelEnd)),
				...this.renderText(text, highlighting, xSelEnd, text.length),
            ];
        } else if (xCaret == xSelEnd && (xSelStart == null || xSelStart == 0)) {
            inner = [
                ce("span", {className: "selection"}, text.slice(0, xCaret)),
                this.renderCaret(),
				...this.renderText(text, highlighting, xCaret, text.length),
            ];
        } else if (xCaret == xSelEnd && xSelStart != null) {
            inner = [
				...this.renderText(text, highlighting, 0, xSelStart),
                ce("span", {className: "selection"}, text.slice(xSelStart, xCaret)),
                this.renderCaret(),
				...this.renderText(text, highlighting, xCaret, text.length),
            ];
        } else if (xCaret < xSelEnd && xCaret > xSelStart) {
            inner = [
				...this.renderText(text, highlighting, 0, xSelStart),
                ce("span", {className: "selection"}, text.slice(xSelStart, xCaret)),
                this.renderCaret(),
                ce("span", {className: "selection"}, text.slice(xCaret, xSelEnd)),
				...this.renderText(text, highlighting, xSelEnd, text.length),
            ];
        } else if (xCaret < xSelStart) {
            inner = [
				...this.renderText(text, highlighting, 0, xCaret),
                this.renderCaret(),
				...this.renderText(text, highlighting, xCaret, xSelStart),
                ce("span", {className: "selection"}, text.slice(xSelStart, xSelEnd)),
				...this.renderText(text, highlighting, xSelEnd, text.length),
            ];
        } else if (xCaret > xSelEnd) {
            inner = [
				...this.renderText(text, highlighting, 0, xSelStart),
                ce("span", {className: "selection"}, text.slice(xSelStart, xSelEnd)),
				...this.renderText(text, highlighting, xSelEnd, xCaret),
                this.renderCaret(),
				...this.renderText(text, highlighting, xCaret, text.length),
            ];
        } else {
            throw new Error("unhandled");
        }

        return ce("p", {key: y}, ...inner);
    }

    renderContent(onMouseDown = null) {
        let caretPos = this.data.caretPos;
        let selStart = this.data.selectionStart;
        let selEnd   = this.data.selectionEnd;
        
        let hasError = this.data.error != null;
        if (hasError) {
            let [x, y] = this.data.error.getFilePos();
            selStart = new FilePos(x, y);
            selEnd = new FilePos(x+1, y);
        }

        let contentLines = [];

        let caretVisible = this.isGrabbingKeyboard || (this.props.caretVisible !== undefined && this.props.caretVisible !== null);
        let y0 = this.data.viewPos.y;

		let highlighting = helios.highlight(this.data.raw);
		let highlightPos = 0;
		for (let y = 0; y < y0; y++) {
			highlightPos += this.data.lines_[y].length + 1; // include new line char
		}

        for (let y = y0; y < Math.min(y0 + Math.ceil((this.innerHeight + SCROLLBAR_SIZE)/this.lineHeight), this.data.nLines); y++) {
            let line = this.data.lines_[y];

			let lineHighlighting = highlighting.slice(highlightPos, highlightPos + line.length);
			highlightPos += line.length + 1;

            contentLines.push(
                this.renderContentLine(
                    y,
                    line,
					lineHighlighting,
                    (caretPos.y == y && caretVisible) ? caretPos.x : null, 
                    selStart.y == y ? selStart.x : (y > selStart.y && y < selEnd.y ? 0 : null),
                    selEnd.y == y ? selEnd.x : (y > selStart.y && y < selEnd.y ? line.length : null),
                )
            );
        }

        return ce("div", {
            className: "file-content",
            error: hasError ? "" : null,
            style: {left: (-this.data.viewPos.x*this.charWidth).toString() + "px"},
            onMouseDown: onMouseDown,
        }, contentLines);
    }

    renderDecorations() {
        return [
            ce("div", {className: "bottom-left-corner"}),
            ce("div", {className: "bottom-right-corner"}),
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
        ];
    }

    render() {
        return ce(
            "div", {
                id: this.props.id,
                className: TEXT_VIEWER_CLASS,
                tabIndex: "0",
                onWheel: this.handleWheel,
            },
            this.renderLineNumbers(),
            this.renderContent(null),
            ...this.renderDecorations(),
        )
    }
}
