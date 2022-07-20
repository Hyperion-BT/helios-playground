import * as helios from "./helios.js";

///////////
// Constants
//////
const TAB = "\xA0\xA0\xA0\xA0"; // four spaces
const MAX_HIST = 100;


////////////
// Utilities
////////////
const mkElem = React.createElement;

function assert(cond, msg = "unexpected") {
    if (!cond) {
        throw new Error(msg);
    }
}

function formatInt(i, nDigits) {
    let s = i.toString();

    if (s.length < nDigits) {
        let nPad = nDigits - s.length;
        s = (new Array(nPad)).fill('0').join('') + s;
    }

    return s;
}


const root = ReactDOM.createRoot(document.getElementById('root'));

var activeElement = null; // set by Focusable
var mouseElement = null; // set upon mouseDown

const measuredText = document.getElementById("measured-text");

window.addEventListener("paste", function(e) {
    let text = e.clipboardData.getData("text/plain");

    // react makes it difficult for us to communicate via devents
    if (activeElement != null && activeElement.insert != null) {
        activeElement.insert(text);
    }
});

window.addEventListener("mouseup", function(e) {
    if (mouseElement != null && mouseElement.handleMouseUp != null && e.target != null) {
        mouseElement.handleMouseUp(e);
    }

    mouseElement = null;
});

window.addEventListener("mousemove", function(e) {
    if (mouseElement != null && mouseElement.handleMouseMove != null && e.target != null) {
        mouseElement.handleMouseMove(e);
    }
});

class Component extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
        
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
    }
      
    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }

    handleMouseDown(e) {
        mouseElement = this;
    }

    handleMouseMove(e) {
    }

    handleMouseUp(e) {
    }

    handleClick(e) {
    }

    handleResize() {
    }

    get commonProps() {
        return {
            onMouseDown: this.handleMouseDown,
            onClick: this.handleClick,
        }
    }
}

class Focusable extends Component {
    constructor(props) {
        super(props);

        this.state.isFocused = false;

        this.handleFocus = this.handleFocus.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
    }

    get isFocused() {
        return this.state.isFocused;
    }

    handleClick(e) {
        this.handleFocus();
    }

    handleFocus() {
        activeElement = this;
        this.setState({isFocused: true});
    }

    handleKeyPress(e) {
    }

    handleKeyDown(e) {
        switch(e.key) {
            case "Escape":
                document.activeElement.blur();
                break;
        }
    }

    handleBlur() {
        activeElement = null;
        this.setState({isFocused: false});
    }

    get commonProps() {
        return Object.assign({
            tabIndex: "0",
            onFocus: this.handleFocus,
            onBlur: this.handleBlur,
        }, super.commonProps);
    }
}

class Caret extends Component {
    constructor(props) {
        super(props);

        this.timerId = null;
        this.lastScrollIntoViewTime = null;
    }

    static make() {
        return mkElem(Caret, {now: (new Date()).getTime()})
    }

    componentDidMount() {
        this.timerId = setInterval(() => {
            this.tick();
        }, 1000);

        super.componentDidMount();
    }
    
    static getDerivedStateFromProps(props) {
        return ((new Date()).getTime() < props.now + 500) ? {isVisible: true} : {};
    }

    componentWillUnmount() {
        clearInterval(this.timerId);

        super.componentWillUnmount();
    }

    tick() {
        this.setState({
            isVisible: !this.state.isVisible
        });
    }

    render() {
        return mkElem("span", Object.assign({id: "caret"}, this.state.isVisible ? {visible: ""} : {}), "\xA0");
    }
}

class Pos {
    constructor(x, y) {
        this.x_ = x;
        this.y_ = y;
    }

    get x() {
        return this.x_;
    }

    get y() {
        return this.y_;
    }

    eq(other) {
        return this.x_ == other.x && this.y_ == other.y;
    }

    // return bounded copy
    bound(lines, wrap = true) { // allow wrap
        let x = this.x_;
        let y = this.y_;

        if (y < 0) {
            y = 0;
        } else if (y >= lines.length) {
            y = lines.length - 1;
        }

        if (x < 0) {
            if (y > 0 && wrap) {
                y -= 1;
                x = lines[y].length
            } else {
                x = 0;
            }
        } else if (x > lines[y].length) {
            if (y < lines.length - 1 && wrap) {
                x = 0;
                y += 1;
            } else {
                x = lines[y].length;
            }
        }

        return new Pos(x, y);
    }

    sub(b) {
        return new Pos(this.x_ - b.x, this.y_ - b.y);
    }
}

// props:
//   
//   lineNumbers
class TextInput extends Focusable {
    constructor(props) {
        super(props);

        this.state.lastSave = this.props.initLines;
        this.state.lines = this.props.initLines.replaceAll(" ", "\xA0").replaceAll("\t", TAB).split("\n");
        this.state.pos0 = new Pos(0, 0);
        this.state.pos1 = new Pos(0, 0);
        this.state.xOffset = 0;
        this.state.yOffset = 0;
        this.state.someChange = false;

        this.isSelecting = false;
        this.history = [];
        this.historyIndex = 0;
        this.historyHead = null;
        
        this.isHorScrolling = false;
        this.isVerScrolling = false;
        this.scrollStartMouse = null;
        this.scrollStartOffset = null;

        this.handleRightScrollbarMouseDown = this.handleRightScrollbarMouseDown.bind(this);
        this.handleBottomScrollbarMouseDown = this.handleBottomScrollbarMouseDown.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
    }

    get pos0() {
        return this.state.pos0;
    }

    get pos1() {
        return this.state.pos1;
    }

    get lines() {
        return this.state.lines.slice();
    }

    get haveSelection() {
        return !this.pos0.eq(this.pos1);
    }

    get selectionStart() {
        if (this.pos0.y < this.pos1.y) {
            return this.pos0;
        } else if (this.pos1.y < this.pos0.y) {
            return this.pos1;
        } else if (this.pos0.x < this.pos1.x) {
            return this.pos0;
        } else {
            return this.pos1;
        }
    }

    get selectionEnd() {
        let start = this.selectionStart;

        if (start.eq(this.pos0)) {
            return this.pos1;
        } else {
            return this.pos0;
        }
    }

    static getDerivedStateFromProps(props, state) {
        if (state.lastSave != props.initLines) {
            state = Object.assign({}, state);
            state.lastSave = props.initLines;
            state.lines =  props.initLines.replaceAll(" ", "\xA0").replaceAll("\t", TAB).split("\n");
        } 

        return state;
    }

    pushHistory(lines, pos) {
        while (this.history.length >= MAX_HIST) {
            this.history.shift();
        }

        this.history = this.history.slice(0, this.historyIndex);
        this.history.push([lines, pos]);
        this.historyIndex = this.history.length;
    }

    undo() {
        if (this.historyIndex > 0) {
            if (this.historyHead == null) {
                this.historyHead = [this.lines, this.pos1];
            }

            this.historyIndex -= 1;

            let entry = this.history[this.historyIndex];

            
            this.mutateInternal({lines: entry[0], pos0: entry[1], pos1: entry[1]});
        }
    }

    redo() {
        if (this.historyIndex < this.history.length) {
            this.historyIndex += 1;

            let entry;
            if (this.historyIndex == this.history.length) {
                entry = this.historyHead;
                this.historyHead = null;
            } else {
                entry = this.history[this.historyIndex];
            }

            assert(entry != null);

            this.mutateInternal({lines: entry[0], pos0: entry[1], pos1: entry[1]});
        }
    }

    mutateInternal(state) {
        // at this piont make sure pos1 lies in view
        if (state.pos1 != undefined && state.pos1 != null) {
            let offset = this.contentOffset();
            let dx = 0;
            let nVisibleChars = Math.floor(this.refWidth()/this.charWidth());

            if (state.pos1.x == 0 && this.state.xOffset != 0) {
                dx = -this.state.xOffset;
            } else if (state.pos1.x + offset.x < 0) {
                dx = -(offset.x - state.pos1.x);
            } else if (state.pos1.x + offset.x >= nVisibleChars) {
                dx = nVisibleChars - offset.x - state.pos1.x;
            } else if (this.state.xOffset != null && nVisibleChars - this.state.xOffset > this.maxLineChars()) {
                dx = Math.min(nVisibleChars - this.state.xOffset - this.maxLineChars(), -this.state.xOffset);
            }

            if (dx != 0) {
                let xOffset = this.state.xOffset + dx;
                state.xOffset = xOffset;
            }

            let dy = 0;
            let nVisibleLines = this.visibleLines();

            if (state.pos1.y == 0 && this.state.yOffset != 0) {
                dy = -this.state.yOffset;
            } else if (state.pos1.y + offset.y < 0) {
                dy = -(offset.y - state.pos1.y);
            } else if (state.pos1.y + offset.y >= nVisibleLines) {
                dy = nVisibleLines - offset.y - state.pos1.y;
            } else if (this.state.yOffset != null && nVisibleLines - this.state.yOffset > this.lines.length) {
                dy = Math.min(nVisibleLines - this.state.yOffset - this.lines.length, -this.state.yOffset);
            }

            if (dy != 0) {
                let yOffset = this.state.yOffset + dy;
                state.yOffset = yOffset;
            }
        }

        this.setState(state);
    }

    mutate(lines = null, pos0 = null, pos1 = null) {
        let state = {};
        if (lines != null) {
            this.pushHistory(this.lines, this.pos1);
            state.lines = lines;
            state.someChange = true;
        }

        if (pos0 != null) {
            state.pos0 = pos0;
        }

        if (pos1 != null) {
            state.pos1 = pos1;
        }

        this.mutateInternal(state);
    }

    moveCaretBy(dx, dy, isSelecting = false) {
        let p = this.pos1;
        p = (new Pos(p.x + dx, p.y + dy)).bound(this.lines, dx != 0);

        if (isSelecting) {
            this.mutate(null, null, p);
        } else {
            this.mutate(null, p, p);
        }
    }

    moveCaretTo(x, y, isSelecting = false) {
        let p = new Pos(x, y);

        if (isSelecting) {
            this.mutate(null, null, p);
        } else {
            this.mutate(null, p, p);
        }
    }

    // lines joined by '\n'
    getSelection() {
        let lines = this.lines;
        let start = this.selectionStart;
        let end = this.selectionEnd;

        let res;
        if (start.y == end.y) {
            res = lines[start.y].slice(start.x, end.x);
        } else {
            let selLines = [lines[start.y].slice(start.x)];
            selLines = selLines.concat(lines.slice(start.y+1, end.y));
            selLines.push(lines[end.y].slice(0, end.x));

            res = selLines.join("\n");
        }

        res = res.replaceAll("\xA0", " ");
        return res;
    }

    // return remaining lines
    deleteSelectionInternal() {
        let oldLines = this.lines;
        if (!this.haveSelection) {
            let newLines = oldLines;
            return newLines;
        } else {
            let start = this.selectionStart;
            let end = this.selectionEnd;

            let newLines = oldLines.slice(0, start.y);
            newLines.push(oldLines[start.y].slice(0, start.x) + oldLines[end.y].slice(end.x));
            newLines = newLines.concat(oldLines.slice(end.y + 1));

            return newLines;
        }
    }

    deleteSelection() {
        let newLines = this.deleteSelectionInternal();

        let p = this.selectionStart;

        this.mutate(newLines, p, p);
    }
  
    backspace() {
        if (!this.haveSelection) {
            let oldLines = this.lines;
            if (this.pos1.x > 0) {
                let newLines = oldLines.slice(0, this.pos1.y);
                newLines.push(oldLines[this.pos1.y].slice(0, this.pos1.x - 1) + oldLines[this.pos1.y].slice(this.pos1.x));
                newLines = newLines.concat(oldLines.slice(this.pos1.y + 1));
                let newPos = new Pos(this.pos1.x - 1, this.pos1.y);
                this.mutate(newLines, newPos, newPos);
            } else if (this.pos1.y > 0) {
                let newLines = oldLines.slice(0, this.pos1.y - 1);
                newLines.push(oldLines[this.pos1.y-1] + oldLines[this.pos1.y]);
                newLines = newLines.concat(oldLines.slice(this.pos1.y+1));
                let newPos = new Pos(oldLines[this.pos1.y-1].length, this.pos1.y-1);
                this.mutate(newLines, newPos, newPos);
            }
        } else {
            this.deleteSelection();
        }
    }

    delete() {
        if (!this.haveSelection) {
            let oldLines = this.lines;

            // caret doesn't move
            if (this.pos1.x < oldLines[this.pos1.y].length) {
                let newLines = oldLines.slice(0, this.pos1.y);
                newLines.push(oldLines[this.pos1.y].slice(0, this.pos1.x) + oldLines[this.pos1.y].slice(this.pos1.x+1));
                newLines = newLines.concat(oldLines.slice(this.pos1.y+1));
                
                this.mutate(newLines);
            } else if (this.pos1.y < oldLines.length - 1) {
                let newLines = oldLines.slice(0, this.pos1.y);
                newLines.push(oldLines[this.pos1.y] + oldLines[this.pos1.y + 1]);
                newLines = newLines.concat(oldLines.slice(this.pos1.y + 2));
                this.mutate(newLines);
            }
        } else {
            this.deleteSelection();
        }
    }

    insert(text) {  
        let oldLines = this.deleteSelectionInternal();
        text = text.replaceAll(" ", "\xA0");
        text = text.replaceAll("\t", "\xA0\xA0");
        let insLines = text.split("\n");

        let pos = this.selectionStart;

        let newLines = oldLines.slice(0, pos.y);
        let newPos;

        if (insLines.length == 1) {
            newLines.push(oldLines[pos.y].slice(0, pos.x) + insLines[0] + oldLines[pos.y].slice(pos.x));
            newPos = new Pos(pos.x + insLines[0].length, pos.y);
        } else {
            let firstInsLine = insLines.shift();
            newLines.push(oldLines[pos.y].slice(0, pos.x) + firstInsLine);
            let lastInsLine = insLines.pop();
            newLines = newLines.concat(insLines);
            newLines.push(lastInsLine + oldLines[pos.y].slice(pos.x));
            newPos = new Pos(lastInsLine.length, pos.y + insLines.length + 1);
        }
        newLines = newLines.concat(oldLines.slice(pos.y + 1));

        this.mutate(newLines, newPos, newPos);
    }

    indentSelection() {
        let oldLines = this.lines;
        let selStart = this.selectionStart;
        let selEnd = this.selectionEnd;

        let newLines = oldLines.slice(0, selStart.y);

        newLines = newLines.concat(oldLines.slice(selStart.y, selEnd.y+1).map(line => TAB + line));
        newLines = newLines.concat(oldLines.slice(selEnd.y+1));

        let oldPos1 = this.pos1;
        let oldPos0 = this.pos0;
        let newPos1 = new Pos(oldPos1.x + TAB.length, oldPos1.y);
        let newPos0 = new Pos(oldPos0.x + TAB.length, oldPos0.y);

        this.mutate(newLines, newPos0, newPos1);
    }

    unindentSelection() {
        let oldLines = this.lines;
        let selStart = this.selectionStart;
        let selEnd = this.selectionEnd;

        let newLines = oldLines.slice(0, selStart.y);
        let newPos0 = this.pos0;
        let newPos1 = this.pos1;

        for (let y = selStart.y; y < selEnd.y + 1; y++) {
            let trimmed = oldLines[y];
            let trimCount = TAB.length;
            for (let i = 0; i < TAB.length; i++) {
                if (trimmed[i] == "\xA0") {
                } else {
                    trimCount = i;
                    break;
                }
            }

            newLines.push(trimmed.slice(trimCount));

            // also update the position
            if (y == newPos0.y) {
                newPos0 = new Pos(Math.max(newPos0.x - trimCount, 0), newPos0.y);
            }

            if (y == newPos1.y) {
                newPos1 = new Pos(Math.max(newPos1.x - trimCount, 0), newPos1.y);
            }
        }

        newLines = newLines.concat(oldLines.slice(selEnd.y+1));

        this.mutate(newLines, newPos0, newPos1);
    }

    nLineNumberDigits() {
        let nDigits = Math.max(Math.ceil(Math.log10(this.lines.length)), 2);
        return nDigits;
    }

    // with respect to top-left corner, in number of chars
    contentOffset() {

       let xOffset = this.nLineNumberDigits() + 2 + this.state.xOffset;

       // TODO: include scroll position
       return new Pos(xOffset, this.state.yOffset);
    }

    scrollBarThickness() {
        return 16;
    }

    refHeight() {
        return document.getElementById(this.props.refHeightElement).getBoundingClientRect().height - this.scrollBarThickness();
    }

    refWidth() {
        return document.getElementById(this.props.refWidthElement).getBoundingClientRect().width - this.scrollBarThickness();
    }

    maxLineChars() {
        let n = 0;
        let lines = this.lines;
        for (let line of lines) {
            n = Math.max(n, line.length)
        }

        return (n + this.nLineNumberDigits() + 2)
    }

    // includes the linenumber chars
    maxLineWidth() {
        return this.maxLineChars()*this.charWidth();
    }

    lineHeight() {
        return measuredText.getBoundingClientRect().height;
    }

    charWidth() {
        return measuredText.getBoundingClientRect().width/26;
    }

    mouseEventPos(e) {
        let target = e.target;
        while (target.className != "text-input") {
            target = target.parentElement;
            if (target == null) {
                return null;
            }
        }

        let rect = target.getBoundingClientRect();
        let x0 = rect.x - target.scrollLeft;
        let y0 = rect.y - target.scrollTop;

        let lineHeight = this.lineHeight();
        let charWidth = this.charWidth();

        let x = Math.round((e.clientX - x0)/charWidth);
        let y = Math.floor((e.clientY - y0)/lineHeight);    
        
        return (new Pos(x, y)).sub(this.contentOffset());
    }

    findFirstNonWhiteSpace(y) {
        let lines = this.lines;
        for (let i = 0; i < lines[y].length; i++) {
            if (lines[y][i] != "\xA0") {
                return new Pos(i, y);
            }
        }

        return new Pos(0, y);
    }

    findPrevBoundary(p0 = null) {
        if (p0 == null) {
            p0 = (new Pos(this.pos1.x - 1, this.pos1.y)).bound(this.lines);
        }

        let p = this.findBoundary(p0, -1);

        return (new Pos(p.x + 1, p.y));
    }

    findNextBoundary(p0 = null) {
        if (p0 == null) {
            p0 = this.pos1;
        }

        return this.findBoundary(p0, 1);
    }

    findBoundary(p0, d) {
        let lines = this.lines;
        let p = p0;

        function incr(p_) {
            if (p_.x + d < 0 && p_.y == 0) {
                // don't bound, corrected by findPrevBoundary instead
                return new Pos(p_.x + d, p_.y);
            } else {
                return (new Pos(p_.x + d, p_.y)).bound(lines);
            }
        }
        
        function isWordChar(c) {
            return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c == "_") || (c >= "0" && c <= "9");
        }

        let first = null;
        if (p.y < lines.length && p.x < lines[p.y].length) {
            first = lines[p.y][p.x];
            if (first == "\xA0") { // space doesn't count
                first = null;
            }
        }

        while (true) {
            let prev = p;
            p = incr(prev);

            if (p.eq(prev)) {
                return p;
            }

            if (p.x == lines[p.y].length && first != null) {
                return p;
            } else if (p.x == lines[p.y].length) {
                p = incr(p);
            } else {
                let c = lines[p.y][p.x];

                if (first == null) {
                    if (c != "\xA0") {
                        first = c; 
                    }
                } else {
                    if (isWordChar(first) && !isWordChar(c)) {
                        return p;
                    } else if (!isWordChar(first) && isWordChar(c)) {
                        return p;
                    } else if (c == "\xA0") {
                        return p;
                    }
                }
            }
        }
    }

    bottomScrollBarWidth() {
        return (this.refWidth()*Math.min(1, this.refWidth()/(this.maxLineChars()*this.charWidth())));
    }

    rightScrollBarHeight() {
        return this.refHeight()*Math.min(1, this.refHeight()/(this.lines.length*this.lineHeight()));
    }

    handleMouseDown(e) {
        this.isSelecting = true;

        let p = this.mouseEventPos(e);

        if (p != null) {
            p = p.bound(this.lines, false);
            this.mutate(null, p, p);

            this.handleFocus();
        }

        super.handleMouseDown(e);
    }

    visibleLines() {
        return Math.floor(this.refHeight()/this.lineHeight()) - 1;
    }

    boundYOffset(offset) {
        let nTotalLines = this.lines.length;
        let nVisibleLines = Math.min(nTotalLines, this.visibleLines());

        if (Number.isNaN(offset) || offset > 0) {
            return 0;
        } else if (offset <= nVisibleLines - nTotalLines) {
            return nVisibleLines - nTotalLines;
        } else {
            return offset;
        }
    }

    boundXOffset(offset) {
        let nTotalChars = this.maxLineChars();
        let nVisibleChars = Math.min(nTotalChars, Math.floor(this.refWidth()/this.charWidth()));

        if (Number.isNaN(offset) || offset > 0) {
            return 0;
        } else if (offset <= nVisibleChars - nTotalChars) {
            return nVisibleChars - nTotalChars;
        } else {
            return offset;
        }
    }

    handleMouseMove(e) {
        if (this.isSelecting) {
            let p = this.mouseEventPos(e);

            if (p != null) {
                p = p.bound(this.lines, false);
                this.mutate(null, null, p);
            }
        } else if (this.isVerScrolling) {
            let delta = e.clientY - this.scrollStartMouse.y;

            let nTotalLines = this.lines.length;
            let nVisibleLines = Math.min(nTotalLines, this.visibleLines());
            let rightScrollBarHeight = this.rightScrollBarHeight();
            let remHeight = this.refHeight() - rightScrollBarHeight;

            let offset = this.scrollStartOffset.y - (delta/remHeight)*(nTotalLines - nVisibleLines);

            offset = this.boundYOffset(offset);

            this.mutateInternal({yOffset: offset});
        } else if (this.isHorScrolling) {
            let delta = e.clientX - this.scrollStartMouse.x;

            let nTotalChars = this.maxLineChars();
            let nVisibleChars = Math.min(nTotalChars, Math.floor(this.refWidth()/this.charWidth()));
            let bottomScrollBarWidth = this.bottomScrollBarWidth();
            let remWidth = this.refWidth() - bottomScrollBarWidth;

            let offset = this.scrollStartOffset.x - (delta/remWidth)*(nTotalChars - nVisibleChars);
            offset = this.boundXOffset(offset);

            this.mutateInternal({xOffset: offset});
        }

        super.handleMouseMove(e);
    }

    handleMouseUp(e) {
        if (this.isSelecting) {
            this.isSelecting = false;

            let p = this.mouseEventPos(e);

            if (p != null) {
                p = p.bound(this.lines, false);
                this.mutate(null, null, p);
            }
        } else if (this.isVerScrolling) {
            this.isVerScrolling = false;
            this.scrollStartMouse = null;
            this.scrollStartOffset = null;
        } else if (this.isHorScrolling) {
            this.isHorScrolling = false;
            this.scrollStartMouse = null;
            this.scrollStartOffset = null;
        }

        super.handleMouseUp(e);
    }

    handleRightScrollbarMouseDown(e) {
        this.isVerScrolling = true;
        this.scrollStartMouse = new Pos(e.clientX, e.clientY);
        this.scrollStartOffset = new Pos(this.state.xOffset, this.state.yOffset);

        e.stopPropagation();

        super.handleMouseDown(e);
    }

    handleBottomScrollbarMouseDown(e) {
        this.isHorScrolling = true;
        this.scrollStartMouse = new Pos(e.clientX, e.clientY);
        this.scrollStartOffset = new Pos(this.state.xOffset, this.state.yOffset);

        e.stopPropagation();

        super.handleMouseDown(e);
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

        let state = {};

        if (dx != 0) {
            state.xOffset = this.boundXOffset(this.state.xOffset + Math.round(dx));
        }
        if (dy != 0) {
            state.yOffset = this.boundYOffset(this.state.yOffset + Math.round(dy));
        }

        this.mutateInternal(state);
    }

    handleKeyPress(e) {
        switch(e.key) {
            case "Enter":
                break;
            case "Delete": // needed for chrome
                this.delete();
                break;
            case "Z":
                if (e.ctrlKey) {
                    this.redo();
                } else {
                    this.insert(e.key);
                    break;
                }
            default:
                this.insert(e.key);
                break;
        }

        super.handleKeyPress(e);
    }

    handleKeyDown(e) {
        switch(e.key) {
            case "Tab":
                if (e.shiftKey) {
                    this.unindentSelection();
                } else {
                    this.indentSelection();
                }
                e.preventDefault();
                e.stopPropagation();
                break;
            case "Backspace":
                this.backspace();
                break;
            case "Delete":
                this.delete();
                break;
            case "Enter":
            case "Return":
                this.insert("\n");
                break;
            case "ArrowLeft":
                if (!e.shiftKey && this.haveSelection) {
                    let p = this.selectionStart;

                    if (e.ctrlKey) {
                        p = this.findPrevBoundary(this.selectionStart);
                    }

                    this.moveCaretTo(p.x, p.y, false);
                } else {
                    if (e.ctrlKey) {
                        let p = this.findPrevBoundary();
                        this.moveCaretTo(p.x, p.y, e.shiftKey);
                    } else {
                        this.moveCaretBy(-1, 0, e.shiftKey);
                    }
                }
                e.preventDefault();
                e.stopPropagation();
                break;
            case "ArrowRight":
                if (!e.shiftKey && this.haveSelection) {
                    let p = this.selectionEnd;

                    if (e.ctrlKey) {
                        p = this.findNextBoundary(p);
                    }

                    this.moveCaretTo(p.x, p.y, false);
                } else {
                    if (e.ctrlKey) {
                        let p = this.findNextBoundary();
                        this.moveCaretTo(p.x, p.y, e.shiftKey);
                    } else {
                        this.moveCaretBy(1, 0, e.shiftKey);
                    }
                }
                e.preventDefault();
                e.stopPropagation();
                break;
            case "ArrowDown":
                this.moveCaretBy(0, 1, e.shiftKey);
                e.preventDefault();
                e.stopPropagation();
                break;
            case "ArrowUp":
                this.moveCaretBy(0, -1, e.shiftKey);
                e.preventDefault();
                e.stopPropagation();
                break;
            case "Home":
                if (e.ctrlKey) {
                    this.moveCaretTo(0, 0, e.shiftKey);
                } else {
                    let p = this.findFirstNonWhiteSpace(this.pos1.y);
                    this.moveCaretTo(p.x, p.y, e.shiftKey);
                }
                e.preventDefault();
                e.stopPropagation();
                break;
            case "End":
                this.moveCaretTo(this.lines[this.pos1.y].length, e.ctrlKey ? this.lines.length - 1 : this.pos1.y, e.shiftKey);
                e.preventDefault();
                e.stopPropagation();
                break;
            case "x":
                if (e.ctrlKey && this.haveSelection) {
                    navigator.clipboard.writeText(this.getSelection());
                    this.deleteSelection();
                }
                break;
            case "c":
                if (e.ctrlKey && this.haveSelection) {
                    navigator.clipboard.writeText(this.getSelection());
                }
                break;
            // paste is captured via special paste event
            case "a":
                if (e.ctrlKey) {
                    let lines = this.lines;
                    let n = lines.length;
                    this.mutate(null, new Pos(0, 0), new Pos(lines[n-1].length, n-1));
                }
                break;
            case "z":
            case "Z":
                if (e.ctrlKey) {
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                }
        }

        super.handleKeyDown(e);
    }

    handleResize() {
        this.mutateInternal({lines: this.lines, pos0: this.pos0, pos1: this.pos1});
    }

    // not a static method because needs access to this.isFocused
    renderLine(text, lineNo, xCaret, xSelStart, xSelEnd) {
        let inner;

        if (xCaret == null) {
            if (xSelStart == null && xSelEnd == null) {
                inner = [mkElem("span", null, text)];
            } else if (xSelStart == 0 && xSelEnd == text.length) {
                inner = [mkElem("span", {className: "selection"}, text)];
            } else if ((xSelStart == null || xSelStart == 0) && xSelEnd != null) {
                inner = [
                    mkElem("span", {className: "selection"}, text.slice(0, xSelEnd)),
                    mkElem("span", null, text.slice(xSelEnd)),
                ];
            } else if (xSelStart != null && (xSelEnd == null || xSelEnd == text.length)) {
                inner = [
                    mkElem("span", null, text.slice(0, xSelStart)),
                    mkElem("span", {className: "selection"}, text.slice(xSelStart)),
                ];
            } else if (xSelStart != null && xSelEnd != null) {
                assert(xSelStart <= xSelEnd);
                inner = [
                    mkElem("span", null, text.slice(0, xSelStart)),
                    mkElem("span", {className: "selection"}, text.slice(xSelStart, xSelEnd)),
                    mkElem("span", null, text.slice(xSelEnd)),
                ];
            } else {
                throw new Error("unhandled");
            }
        } else if (xSelStart == null && xSelEnd == null) {
            inner = [
                mkElem("span", null, text.slice(0, xCaret)),
                this.isFocused && Caret.make(),
                mkElem("span", null, text.slice(xCaret)),
            ];
        } else if (xCaret == xSelStart && (xSelEnd == null || xSelEnd == text.length)) {
            inner = [
                mkElem("span", null, text.slice(0, xCaret)),
                this.isFocused && Caret.make(),
                mkElem("span", {className: "selection"}, text.slice(xCaret)),
            ];
        } else if (xCaret == xSelStart && xSelEnd != null) {
            inner = [
                mkElem("span", null, text.slice(0, xCaret)),
                this.isFocused && Caret.make(),
                mkElem("span", {className: "selection"}, text.slice(xCaret, xSelEnd)),
                mkElem("span", null, text.slice(xSelEnd)),
            ];
        } else if (xCaret == xSelEnd && (xSelStart == null || xSelStart == 0)) {
            inner = [
                mkElem("span", {className: "selection"}, text.slice(0, xCaret)),
                this.isFocused && Caret.make(),
                mkElem("span", null, text.slice(xCaret)),
            ];
        } else if (xCaret == xSelEnd && xSelStart != null) {
            inner = [
                mkElem("span", null, text.slice(0, xSelStart)),
                mkElem("span", {className: "selection"}, text.slice(xSelStart, xCaret)),
                this.isFocused && Caret.make(),
                mkElem("span", null, text.slice(xCaret)),
            ];
        } else {
            throw new Error("unhandled");
        }

        if (lineNo != null) {
            inner.unshift(mkElem("span", {className: "line-number"}, lineNo));
        }

        return mkElem("p", {style: {
            left: (this.state.xOffset*this.charWidth()).toString() + "px", 
            top: (this.state.yOffset*this.lineHeight()).toString() + "px",
            position: "relative", 
            width: "max-content"
        }}, ...inner);
    }

    render() {
        let caretPos = this.pos1;
        let selStart = this.selectionStart;
        let selEnd   = this.selectionEnd;

        let nDigits = this.nLineNumberDigits();

        let lineElems = this.lines.map((line, y) => {
            let lineNo = "\xA0" + formatInt(y + 1, nDigits) + "\xA0";
            return this.renderLine(
                line,
                lineNo,
                caretPos.y == y ? caretPos.x : null, 
                selStart.y == y ? selStart.x : (y > selStart.y && y < selEnd.y ? 0 : null),
                selEnd.y == y ? selEnd.x : (y > selStart.y && y < selEnd.y ? line.length : null)
            );
        });

        return [
            this.props.onSave != undefined && this.state.someChange && mkElem("button", {key: "save", className: "save", onClick: () => {this.handleSave()}}, "Save"),
            mkElem(
                "div", 
                Object.assign({
                    id: this.props.id,
                    key: "editor",
                    style: {fontFamily: "monospace", userSelect: "none"},
                    className: "text-input",
                    onKeyPress: this.handleKeyPress,
                    onKeyDown: this.handleKeyDown,
                    onWheel: this.handleWheel,
                }, this.commonProps), 
                mkElem("div", {className: "tl"}, ...lineElems),
                mkElem("div", {className: "tr"}, 
                    mkElem("div", {
                        className: "right-scrollbar", 
                        onMouseDown: this.handleRightScrollbarMouseDown,
                        style: {
                            height: this.rightScrollBarHeight().toString() + "px",
                            top: (-this.state.yOffset*this.refHeight()/this.lines.length).toString() + "px",
                        }
                    })
                ),
                mkElem("div", {className: "bl"},
                    mkElem("div", {
                        className: "bottom-scrollbar", 
                        onMouseDown: this.handleBottomScrollbarMouseDown,
                        style: {
                            left: (-this.state.xOffset*this.refWidth()/this.maxLineChars()).toString() + "px",
                            width: this.bottomScrollBarWidth().toString() .toString() + "px",
                        }
                    })
                ),
                mkElem("div", {className: "br"})
            )
        ];
    }

    handleSave() {
        let data = this.lines.join("\n").replaceAll("\xA0", " ");
        this.props.onSave(data);

        this.setState({someChange: false, lastSave: data});
    }
}

class EditTab extends Component {
    constructor(props) {
        super(props);

        this.state.activeScript = -1;
        this.state.scripts = new Map(); // id => script
        // read all scripts from indexedDB
    }

    componentDidMount() {
        this.syncWithDB();
    }

    syncWithDB() {
        let transaction = this.props.db.transaction(["scripts"], "readonly");
        let store = transaction.objectStore("scripts");

        let request = store.openCursor();

        let all = new Map();
        request.onsuccess = (e)  => {
            let cursor = e.target.result;

            if (cursor != null) {
                all.set(cursor.key, cursor.value);

                cursor.continue();
            } else {
                this.setState({scripts: all});
            }
        }
    }

    showScript(key) {
        this.setState({activeScript: key});
    }

    addScript() {
        // add to db immediately
        let transaction = this.props.db.transaction(["scripts"], "readwrite");
        let store = transaction.objectStore("scripts");

        let request = store.add({name: "untitled", data: "test untitled;"});
        request.onsuccess = (e) => {
            this.setState({activeScript: e.target.result});
            this.syncWithDB();
        }
    }
 
    saveActiveScript(data) {
        let transaction = this.props.db.transaction(["scripts"], "readwrite");
        let store = transaction.objectStore("scripts");

        let name = helios.getName(data);
        let obj = {name: name, data: data};
        void store.put(obj, this.state.activeScript);

        let newScripts = new Map();
        for (let pair of this.state.scripts) {
            newScripts.set(pair[0], pair[1]);
        }
        newScripts.set(this.state.activeScript, obj);

        this.setState({scripts: newScripts});
    }

    render() {
        let allScripts = [];
        this.state.scripts.forEach((value, key) => {
            allScripts.push(mkElem("p", {className: "script-link", key: key, onClick: () => this.showScript(key)}, value.name));
        });

        return mkElem("div", {id: "edit-tab"},
            mkElem("button", {className: "new-script", onClick: () => this.addScript()}, "New"),
            mkElem("div", {className: "all-scripts"}, ...allScripts),
            this.state.activeScript != -1 && this.state.scripts.has(this.state.activeScript) && mkElem(TextInput, {
                initLines: this.state.scripts.get(this.state.activeScript).data,
                id: "editor", 
                refHeightElement: "ref-editor", 
                refWidthElement: "ref-editor",
                onSave: (data) => {this.saveActiveScript(data)}
            }),
        );
    }
}

// props.db contains the indexeddb
class App extends Component {
    constructor(props) {
        super(props);

        this.state.index = 0;
    }

    handleTabChange(index) {
        this.setState({index: index});
    }

    render() {
        let inner;

        switch(this.state.index) {
            case 0:
                inner = mkElem(EditTab, {db: this.props.db});
                break;
            case 1:
                inner = mkElem("p", null, "Tab 2");
                break
        }

        return mkElem("div", {id: "app"},
            mkElem("nav", null,
                mkElem("p", {className: "nav-link", onClick: () => {this.handleTabChange(0)}}, "Edit"),
                mkElem("p", {className: "nav-link", onClick: () => {this.handleTabChange(1)}}, "Debug")
            ),
            mkElem("div", {id: "tab-page"}, inner)
        )
    }
}

function openDb() {
    return new Promise(function(resolve, reject) {
        const dbVersion = 1;

        let request = indexedDB.open("helios-playground", dbVersion);

        request.onerror = function(e) {
            reject(e);
        }

        request.onsuccess = function(e) {
            resolve(e.target.result);
        }

        request.onupgradeneeded = function(e) {
            let db = e.target.result;

            // create the tables
            if (e.oldVersion < 1) {
                db.createObjectStore("scripts", {autoIncrement: true});
                console.log("done creating helios-playground database");
            }
        }
    });
}

openDb().then((db) => {
    root.render(mkElem(App, {db: db}));
});