import {SPACE, TAB, assert, stringToLines, linesToString, trimSpaces, isWordChar, Vec, FilePos} from "./util.js";

const MAX_HIST = 100;

export class FileData {
    constructor(name, lines, selPos0, selPos1, viewPos, history, histIdx, histHead) {
        assert(!selPos0.isNaN());
        assert(!selPos1.isNaN());
        assert(!viewPos.isNaN());

        this.name_    = name;
        this.lines_   = lines;
        this.selPos0_ = selPos0; 
        this.selPos1_ = selPos1; // if selPos0 == selPos1 then nothing is selected, selPos1 is the cursor position
        this.viewPos_ = viewPos; // determines scroll position in editor

        this.history_  = history; // list of pairs of [lines, caretPos]
        this.histIdx_  = histIdx;
        this.histHead_ = histHead; 
    }

    static new(name, raw) {
        let lines = stringToLines(raw);
        let selPos0 = new FilePos(0, 0);
        let selPos1 = new FilePos(0, 0);
        let viewPos = new FilePos(0, 0);
        let history = [];
        let histIdx = 0;
        let histHead = null;

        return new FileData(name, lines, selPos0, selPos1, viewPos, history, histIdx, histHead);
    }

    get name() {
        return this.name_;
    }

    get raw() {
        return linesToString(this.lines_);
    }

    get lines() {
        return this.lines_.slice();
    }

    get nLines() {
        return this.lines_.length;
    }

    get maxLineChars() {
        let n = 0;
        for (let line of this.lines_) {
            n = Math.max(n, line.length)
        }
        return n;
    }

    get caretPos() {
        return this.selPos1_;
    }

    get haveSelection() {
        return !this.selPos0_.eq(this.selPos1_);
    }

    get selectionStart() {
        if (this.selPos0_.lessThan(this.selPos1_)) {
            return this.selPos0_;
        } else {
            return this.selPos1_;
        }
    }

    get selectionEnd() {
        let selStart = this.selectionStart;

        if (selStart.eq(this.selPos0_)) {
            return this.selPos1_;
        } else {
            return this.selPos0_;
        }
    }

    get selection() {
        let a = this.selectionStart;
        let b = this.selectionEnd;

        let selLines;
        if (a.y == b.y) {
            selLines = [this.lines_[a.y].slice(a.x, b.x)];
        } else {
            selLines = [this.lines_[a.y].slice(a.x)];
            selLines = selLines.concat(this.lines_.slice(a.y+1, b.y));
            selLines.push(this.lines_[b.y].slice(0, b.x));
        }

        return linesToString(selLines);
    }

    get viewPos() {
        return this.viewPos_;
    }

    findFirstNonSpace(y) {
        for (let x = 0; x < this.lines_[y].length; x++) {
            if (this.lines_[y][x] != SPACE) {
                return new FilePos(x, y);
            }
        }

        return new FilePos(0, y);
    }

    // don't use findWordBoundary() directly, use findPrevWordBoundary() or findNextWordBoundary() instead
    findWordBoundary(p0, d) {
        const incr = (p) => {
            if (p.x + d < 0 && p.y == 0) {
                // don't bound, corrected by findPrevBoundary instead
                return new FilePos(p.x + d, p.y);
            } else {
                return (new FilePos(p.x + d, p.y)).bound(this.lines_);
            }
        }

        let p = p0;

        let first = null;

        if (p.y < this.lines_.length && p.x < this.lines_[p.y].length) {
            first = this.lines_[p.y][p.x];
            if (first == SPACE) { // space doesn't count
                first = null;
            }
        }

        while (true) {
            let prev = p;
            p = incr(prev);

            if (p.eq(prev)) {
                return p;
            }

            if (p.x == this.lines_[p.y].length && first != null) {
                return p;
            } else if (p.x == this.lines_[p.y].length) {
                p = incr(p);
            } else {
                let c = this.lines_[p.y][p.x];

                if (first == null) {
                    if (c != SPACE) {
                        first = c; 
                    }
                } else {
                    if (isWordChar(first) && !isWordChar(c)) {
                        return p;
                    } else if (!isWordChar(first) && isWordChar(c)) {
                        return p;
                    } else if (c == SPACE) {
                        return p;
                    }
                }
            }
        }
    }

    // compensates for overshoot
    findPrevWordBoundary(p0 = null) {
        if (p0 == null) {
            p0 = (new FilePos(this.caretPos.x - 1, this.caretPos.y)).bound(this.lines_);
        }

        let p = this.findWordBoundary(p0, -1);

        return (new FilePos(p.x + 1, p.y));
    }

    findNextWordBoundary(p0 = null) {
        if (p0 == null) {
            p0 = this.caretPos;
        }

        return this.findWordBoundary(p0, 1);
    }

    // doesn't mutate, returns a new FileData
    moveCaretTo(x, y, isSelecting = false) {
        assert(arguments.length < 4);

        let newPos = new FilePos(x, y);

        return new FileData(
            this.name_,
            this.lines_,
            isSelecting ? this.selPos0_ : newPos,
            newPos,
            this.viewPos_,
            this.history_,
            this.histIdx_,
            this.histHead_,
        );
    }

    // doesn't mutate, returns a new FileData
    moveCaretBy(dx, dy, wrap = true, isSelecting = false) {
        let newPos = this.caretPos.add(new Vec(dx, dy));

        newPos = newPos.bound(this.lines_, wrap);

        return new FileData(
            this.name_,
            this.lines_,
            isSelecting ? this.selPos0_ : newPos,
            newPos,
            this.viewPos_,
            this.history_,
            this.histIdx_,
            this.histHead_,
        );
    }

    selectAll() {
        let newPos0 = new FilePos(0, 0);
        let nLines = this.lines_.length;
        let newPos1 = new FilePos(this.lines_[nLines-1].length, this.lines_.length-1);

        return new FileData(
            this.name_,
            this.lines_,
            newPos0,
            newPos1,
            this.viewPos_,
            this.history_,
            this.histIdx_,
            this.histHead_,
        );
    }

    // doesn't mutate, returns a new FileData
    setViewPos(p) {
        return new FileData(
            this.name_,
            this.lines_,
            this.selPos0_,
            this.selPos1_,
            p,
            this.history_,
            this.histIdx_,
            this.histHead_,
        );
    }

    // make sure the caret is in the view area
    // doesn't mutate, returns a new FileData
    scrollCaretIntoView(nVisibleChars, nVisibleLines) {
        let relPos = this.caretPos.sub(this.viewPos);

        let x = this.viewPos.x;
        if (relPos.x < 0) {
            x += relPos.x;
        } else if (relPos.x >= nVisibleChars) {
            x += relPos.x - nVisibleChars + 1;
        } else if (this.maxLineChars < nVisibleChars + x - 1 && x > 0) {
            x -= Math.min(nVisibleChars + x - 1 - this.maxLineChars, x);
        }

        let y = this.viewPos.y;
        if (relPos.y < 0) {
            y += relPos.y;
        } else if (relPos.y >= nVisibleLines) {
            y += relPos.y - nVisibleLines + 1;
        } else if (this.nLines < nVisibleLines + y && y > 0) {
            y -= Math.min(nVisibleLines + y - this.nLines, y);
        }

        return new FileData(
            this.name_,
            this.lines_,
            this.selPos0_,
            this.selPos1_,
            new FilePos(x, y),
            this.history_,
            this.histIdx_,
            this.histHead_,
        );
    }

    // doesn't mutate, returns a new FileData
    pushHistory(lines, caretPos) {
        let history = this.history_.slice();
        let histIdx = this.histIdx_;

        if (history.length >= MAX_HIST) {
            history = history.slice(history.length - MAX_HIST + 1, histIdx);
        } else {
            history = history.slice(0, histIdx);
        }

        history.push([lines, caretPos]);
        histIdx = history.length;

        return new FileData(
            this.name_,
            this.lines_, 
            this.selPos0_, 
            this.selPos1_, 
            this.viewPos_, 
            history, 
            histIdx, 
            null,
        );
    }

    // doesn't mutate, returns a new FileData
    undo() {
        let histIdx = this.histIdx_;
        
        if (histIdx > 0) {
            let histHead = this.histHead_;

            if (histHead == null) {
                histHead = [this.lines, this.caretPos];
            }

            histIdx -= 1;

            let [newLines, newPos] = this.history_[histIdx];

            return new FileData(
                this.name_,
                newLines, 
                newPos, 
                newPos, 
                this.viewPos_, 
                this.history_, 
                histIdx, 
                histHead,
            );
        } else {
            return this;
        }
    }

    // doesn't mutate, returns a new FileData
    redo() {
        let histIdx = this.histIdx_;

        if (histIdx < this.history_.length) {
            histIdx += 1;

            let histHead = this.histHead_;

            let newLines;
            let newPos;

            if (histIdx == this.history_.length) {
                [newLines, newPos] = histHead;
                histHead = null;
            } else {
                [newLines, newPos] = this.history_[histIdx];
            }

            return new FileData(
                this.name_,
                newLines, 
                newPos, 
                newPos, 
                this.viewPos_, 
                this.history_, 
                histIdx, 
                histHead,
            );
        } else {
            return this;
        }
    }
    
    // doesn't mutate, returns a new FileData
    // optionally updates the history stack
    deleteSelection(updateHistory = true) {
        if (this.haveSelection) {
            let oldLines = this.lines_;
            let a = this.selectionStart;
            let b = this.selectionEnd;

            let newLines = oldLines.slice(0, a.y);
            newLines.push(oldLines[a.y].slice(0, a.x) + oldLines[b.y].slice(b.x));
            newLines = newLines.concat(oldLines.slice(b.y + 1));

            let newPos = a;

            let that = this;
            if (updateHistory) {
                that = that.pushHistory(oldLines, this.caretPos);
            }

            return new FileData(
                this.name_,
                newLines, 
                newPos, 
                newPos, 
                that.viewPos_, 
                that.history_, 
                that.histIdx_, 
                that.histHead_,
            );
        } else {
            return this;
        }
    }

    // doesn't mutate, returns a new FileData
    // updates the history stack
    deleteForwards() {
        if (this.haveSelection) {
            return this.deleteSelection(true);
        } else {
            let oldLines = this.lines_;
            let p = this.caretPos;
            let newLines;

            // caret doesn't move
            if (p.x < oldLines[p.y].length) {
                newLines = oldLines.slice(0, p.y);
                newLines.push(oldLines[p.y].slice(0, p.x) + oldLines[p.y].slice(p.x+1));
                newLines = newLines.concat(oldLines.slice(p.y+1));
            } else if (p.y < oldLines.length - 1) {
                newLines = oldLines.slice(0, p.y);
                newLines.push(oldLines[p.y] + oldLines[p.y + 1]);
                newLines = newLines.concat(oldLines.slice(p.y + 2));
            } else {
                return this;
            }

            let that = this.pushHistory(oldLines, p);

            return new FileData(
                this.name_,
                newLines, 
                p, 
                p, 
                that.viewPos_, 
                that.history_, 
                that.histIdx_, 
                that.histHead_,
            );
        }
    }

    // doesn't mutate, returns a new FileData
    // updates the history stack
    deleteBackwards() {
        if (this.haveSelection) {
            return this.deleteSelection(true);
        } else {
            let oldLines = this.lines_;
            let p = this.caretPos;
            let newLines;
            let newPos;

            if (p.x > 0) {
                newLines = oldLines.slice(0, p.y);
                newLines.push(oldLines[p.y].slice(0, p.x - 1) + oldLines[p.y].slice(p.x));
                newLines = newLines.concat(oldLines.slice(p.y + 1));
                newPos = new FilePos(p.x - 1, p.y);
            } else if (p.y > 0) {
                newLines = oldLines.slice(0, p.y - 1);
                newLines.push(oldLines[p.y-1] + oldLines[p.y]);
                newLines = newLines.concat(oldLines.slice(p.y+1));
                newPos = new FilePos(oldLines[p.y-1].length, p.y-1);
            } else {
                return this;
            }

            let that = this.pushHistory(oldLines, p);
            return new FileData(
                this.name_, 
                newLines, 
                newPos, 
                newPos, 
                that.viewPos_, 
                that.history_, 
                that.histIdx_, 
                that.histHead_,
            );
        }
    }

    // doesn't mutate, returns a new FileData
    // updates the history stack
    insert(text) {
        let that = this.deleteSelection(false);

        let oldLines = that.lines_;
        let insLines = stringToLines(text);
        let p = that.caretPos;
        
        let newLines = oldLines.slice(0, p.y);
        let newPos;

        if (insLines.length == 1) {
            newLines.push(oldLines[p.y].slice(0, p.x) + insLines[0] + oldLines[p.y].slice(p.x));
            newPos = new FilePos(p.x + insLines[0].length, p.y);
        } else {
            let firstInsLine = insLines.shift();
            newLines.push(oldLines[p.y].slice(0, p.x) + firstInsLine);
            let lastInsLine = insLines.pop();
            newLines = newLines.concat(insLines);
            newLines.push(lastInsLine + oldLines[p.y].slice(p.x));
            newPos = new FilePos(lastInsLine.length, p.y + insLines.length + 1);
        }

        newLines = newLines.concat(oldLines.slice(p.y + 1));

        that = that.pushHistory(this.lines_, this.caretPos);

        return new FileData(
            this.name_, 
            newLines, 
            newPos, 
            newPos, 
            that.viewPos_, 
            that.history_, 
            that.histIdx_, 
            that.histHead_,
        );
    }

    // doesn't mutate, returns a new FileData
    // updates the history stack
    // TODO: align to TAB boundary
    indentSelection() {
        let oldLines = this.lines_;
        let a = this.selectionStart;
        let b = this.selectionEnd;

        let newLines = oldLines.slice(0, a.y);

        newLines = newLines.concat(oldLines.slice(a.y, b.y+1).map(line => TAB + line));
        newLines = newLines.concat(oldLines.slice(b.y+1));

        let oldPos0 = this.selPos0_;
        let oldPos1 = this.selPos1_;
        let newPos0 = new FilePos(oldPos0.x + TAB.length, oldPos0.y);
        let newPos1 = new FilePos(oldPos1.x + TAB.length, oldPos1.y);

        let that = this.pushBoundary(oldLines, this.caretPos);

        return new FileData(
            this.name_,
            newLines, 
            newPos0, 
            newPos1, 
            that.viewPos_, 
            that.history_, 
            that.histIdx_, 
            that.histHead_,
        );
    }

    // doesn't mutate, returns a new FileData
    // updates the history stack
    // TODO: align to TAB boundary
    unindentSelection() {
        let oldLines = this.lines_;
        let a = this.selectionStart;
        let b = this.selectionEnd;

        let newLines = oldLines.slice(0, a.y);
        let newPos0 = this.selPos0_;
        let newPos1 = this.selPos1_;

        for (let y = a.y; y < b.y + 1; y++) {
            let [trimmed, trimCount] = trimSpaces(oldLines[y]);

            newLines.push(trimmed);

            // also update the position
            if (y == newPos0.y) {
                newPos0 = new FilePos(Math.max(newPos0.x - trimCount, 0), newPos0.y);
            }

            if (y == newPos1.y) {
                newPos1 = new FilePos(Math.max(newPos1.x - trimCount, 0), newPos1.y);
            }
        }

        newLines = newLines.concat(oldLines.slice(b.y+1));

        let that = this.pushHistory(oldLines, this.caretPos);

        return new FileData(
            this.name_,
            newLines, 
            newPos0, 
            newPos1, 
            that.viewPos_, 
            that.history_, 
            that.histIdx_, 
            that.histHead_,
        );
    }
}