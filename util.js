export const SPACE = "\xA0";

export const TAB = `${SPACE}${SPACE}${SPACE}${SPACE}`;

export const ce = React.createElement;

export function now() {
    return (new Date()).getTime();
}

export function assert(cond, msg = "unexpected") {
    if (!cond) {
        throw new Error(msg);
    }
}

export function assertDefined(x) {
    if (x === undefined) {
        throw new Error("undefined");
    }

    return x;
}

export function assertClass(x, class_) {
    if (x == undefined || !(x instanceof class_)) {
        throw new Error(`expected ${class_.name}`)
    }

    return x;
}

export function findElement(e, cond) {
    while(e != null && !cond(e)) {
        e = e.parentElement;
    }

    return e;
}

export function formatPaddedInt(i, nDigits, padChar = '0') {
    let s = i.toString();

    if (s.length < nDigits) {
        let nPad = nDigits - s.length;
        s = (new Array(nPad)).fill(padChar).join('') + s;
    }

    return s;
}

export function stringToLines(raw) {
    return raw.replaceAll(" ", SPACE).replaceAll("\t", TAB).split("\n");
}

export function linesToString(lines) {
    return lines.join("\n").replaceAll(SPACE, " ");
}

export function trimSpaces(line) {
    let trimCount = TAB.length;
    for (let i = 0; i < TAB.length; i++) {
        if (line[i] == SPACE) {
            continue;
        } else {
            trimCount = i;
            break;
        }
    }

    return [line.slice(trimCount), trimCount];
}

export function isWordChar(c) {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c == "_") || (c >= "0" && c <= "9");
}

export class Vec {
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

    add(other) {
        return new Vec(this.x_ + other.x, this.y_ + other.y);
    }

    sub(other) {
        return new Vec(this.x_ - other.x, this.y_ - other.y);
    }

    isNaN() {
        return Number.isNaN(this.x_) || Number.isNaN(this.y_);
    }
}

export class FilePos extends Vec {
    add(other) {
        return new FilePos(this.x_ + other.x, this.y_ + other.y);
    }

    sub(other) {
        return new FilePos(this.x_ - other.x, this.y_ - other.y);
    }

    // return bounded copy
    bound(lines, wrap = true) {
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

        return new FilePos(x, y);
    }

    lessThan(other) {
        if (this.y_ < other.y) {
            return true;
        } else if (other.y < this.y_) {
            return false;
        } else if (this.x_ < other.x_) {
            return true;
        } else {
            return false;
        }
    }
}