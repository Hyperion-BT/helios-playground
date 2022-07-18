import * as helios from "./helios.js";

const root = ReactDOM.createRoot(document.getElementById('root'));

var activeElement = null; // set by Focusable

window.addEventListener("paste", function(e) {
    let text = e.clipboardData.getData("text/plain");

    // react makes it difficult for us to communicate via devents
    if (activeElement != null && activeElement.insert != null) {
        activeElement.insert(text);
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
    }

    handleMouseDown(e) {
    }

    handleMouseMove(e) {
    }

    handleMouseUp(e) {
    }

    handleClick(e) {
    }

    get commonProps() {
        return {
            onMouseDown: this.handleMouseDown,
            onMouseMove: this.handleMouseMove,
            onMouseUp: this.handleMouseUp,
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

class Cursor extends Component {
    constructor(props) {
        super(props);

        this.timerId = null;
    }

    componentDidMount() {
        this.timerId = setInterval(() => {
            this.tick();
        }, 1000);
    }
    
    static getDerivedStateFromProps(props) {
        return ((new Date()).getTime() < props.now + 500) ? {isVisible: true} : {};
    }

    componentWillUnmount() {
        clearInterval(this.timerId);
    }

    tick() {
        this.setState({
            isVisible: !this.state.isVisible
        });
    }

    render() {
        if (this.state.isVisible) {
            return <span className="cursor">&nbsp;</span>;
        } else {
            return null;
        }
    }
}

// TODO: multiline
class TextInput extends Focusable {
    constructor(props) {
      super(props);

      this.state.value = "init";
      this.state.col0 = 0;
      this.state.col1 = 0;

      this.isDragging = false;
      this.handlePaste = this.handlePaste.bind(this);
    }

    get col0() {
        return this.state.col0;
    }

    get col1() {
        return this.state.col1;
    }

    get value() {
        return this.state.value;
    }

    get isCursor() {
        return this.col0 == this.col1;
    }

    get selectionStart() {
        return Math.min(this.col0, this.col1);
    }

    get selectionEnd() {
        return Math.max(this.col0, this.col1);
    }

    boundCol(c) {
        if (c < 0) {
            c = 0;
        } else if (c > this.value.length) {
            c = this.value.length;
        }

        return c;
    }

    set col(c) {
        c = this.boundCol(c);

        this.setState({col0: c, col1: c});
    }

    set col0(c) {
        c = this.boundCol(c);

        this.setState({col0: c});
    }

    set col1(c) {
        c = this.boundCol(c);

        this.setState({col1: c});
    }

    set value(v) {
        this.setState({value: v});
    }

    moveCursorBy(dCol, dRow) {
        let col = this.col1;
        col += dCol;

        this.col = col;
    }

    moveSelectionBy(dCol, dRow) {
        this.col1 = this.col1 + dCol;
    }

    moveCursorTo(col, line) {
        if (line == undefined) {
            // stay on current line
        }

        this.col = col;
    }

    deleteSelection() {
        let value = this.value;
        let start = this.selectionStart;
        let end = this.selectionEnd;
        value = value.slice(0, start) + value.slice(end);

        this.setState({value: value});
        this.col = start;
    }
    
    getSelection() {
        let start = this.selectionStart;
        let end = this.selectionEnd;

        return this.value.slice(start, end);
    }

    backspace() {
        let value = this.value;
        if (this.isCursor) {
            
            if (this.col1 > 0) {
                if (this.col1 >= value.length) {
                    value = value.slice(0, value.length - 1);
                    this.setState({value: value});
                } else {
                    value = value.slice(0, this.col1 - 1) + value.slice(this.col1);
                    this.setState({value: value});
                }
                this.moveCursorBy(-1, 0);
            }
        } else {
            this.deleteSelection();
        }
    }

    // TODO: for selection
    delete() {
        if (this.isCursor) {
            let value = this.value;

            if (this.col1 < value.length) {
                value = value.slice(0, this.col1) + value.slice(this.col1+1);

                this.value = value;
            }
        } else {
            this.deleteSelection();
        }
    }

    insert(text) {
        let value = this.value;
        let col = this.col1;
        if (!this.isCursor) {
            let start = this.selectionStart;
            let end = this.selectionEnd;
            value = value.slice(0, start) + value.slice(end);
            col = start;
        }

        if (col >= value.length) {
            value += text;
        } else {
            value = value.slice(0, col) + text + value.slice(col);
        }
        col += text.length;

        this.setState({value: value, col0: col, col1: col});
    }

    mouseEventPosToCol(e) {
        let rect = e.currentTarget.getBoundingClientRect();

        // get width of current line
        let lineWidth = e.currentTarget.children[0].getBoundingClientRect().width;

        let i = Math.round(this.value.length * (e.clientX - rect.x) / lineWidth);

        return i;
    }

    handlePaste(e) {
        console.log(e);
    }

    handleMouseDown(e) {
        this.isDragging = true;

        this.col = this.mouseEventPosToCol(e);

        this.handleFocus();
    }

    handleMouseMove(e) {
        if (this.isDragging) {
            this.col1 = this.mouseEventPosToCol(e);
        }
    }

    handleMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;

            this.col1 = this.mouseEventPosToCol(e);
        } else {
            this.col = this.mouseEventPosToCol(e);
        }
    }

    handleKeyPress(e) {
        switch(e.key) {
            case "Delete": // needed for chrome
                this.delete();
                break;
            case " ":
                this.insert("\xA0");
                break;
            default:
                this.insert(e.key);
                break;
        }

        super.handleKeyPress(e);
    }

    handleKeyDown(e) {
        console.log(e.key);
        switch(e.key) {
            case "Backspace":
                this.backspace();
                break;
            case "Delete":
                this.delete();
                break;
            case "ArrowRight":
                if (e.shiftKey) {
                    this.moveSelectionBy(1, 0);
                } else {
                    this.moveCursorBy(1, 0);
                }
                break;
            case "ArrowLeft":
                if (e.shiftKey) {
                    this.moveSelectionBy(-1, 0);
                } else {
                    this.moveCursorBy(-1, 0);
                }
                break;
            case "Home":
                if (e.shiftKey) {
                    this.col1 = 0;
                } else {
                    this.moveCursorTo(0);
                }
                break;
            case "End":
                if (e.shiftKey) {
                    this.col1 = this.value.length;
                } else {
                    this.moveCursorTo(this.value.length);
                }
                break;
            case "x":
                if (e.ctrlKey && !this.isCursor) {
                    navigator.clipboard.writeText(this.getSelection());
                    this.deleteSelection();
                }
                break;
            case "c":
                if (e.ctrlKey && !this.isCursor) {
                    navigator.clipboard.writeText(this.getSelection());
                }
                break;
            // paste is captured via special paste event
            case "v":
                if (e.ctrlKey) {
                    let activeElement = document.activeElement;
                    /*getClipboard((e) => {
                        let text = e.clipboardData.getData("text/plain");
                        console.log("can paste", text);
                        activeElement.focus();
                    });
                    document.execCommand("paste"); // make sure paste event is triggered if it wasn't already the case
                    console.log(pasteCaptureArea.innerText);*/
                }
                break;
        }

        super.handleKeyDown(e);
    }

    render() {
        if (this.isCursor) {
            let beforeCursor = this.value.slice(0, this.col0);
            let afterCursor = this.value.slice(this.col0);
            return (
                <div {...this.commonProps} 
                    style={{fontFamily: "monospace", userSelect: "none"}} 
                    className="text-input"
                    onKeyPress={this.handleKeyPress}    
                    onKeyDown={this.handleKeyDown}>
                    <p style={{position: "relative", width: "max-content"}}>
                        <span>{beforeCursor}</span>
                        {this.state.isFocused && <Cursor now={(new Date()).getTime()}/>}
                        <span>{afterCursor}</span>
                    </p>
                </div>
            );
        } else {
            let start = this.selectionStart;
            let end = this.selectionEnd;
            let beforeSelection = this.value.slice(0, start);
            let selection = this.value.slice(start, end);
            let afterSelection = this.value.slice(end);

            return (
                <div {...this.commonProps} 
                    style={{fontFamily: "monospace", userSelect: "none"}} 
                    className="text-input"
                    onKeyPress={this.handleKeyPress}    
                    onKeyDown={this.handleKeyDown}
                    onPaste={this.handlePaste}>
                    <p style={{position: "relative", width: "max-content"}}>
                        <span>{beforeSelection}</span>
                        {this.state.isFocused && (this.col1 < this.col0) && <Cursor now={(new Date()).getTime()}/>}
                        <span className="selection">{selection}</span>
                        {this.state.isFocused && (this.col1 > this.col0) && <Cursor now={(new Date()).getTime()}/>}
                        <span>{afterSelection}</span>
                    </p>
                </div>
            );
        }
    }
  }


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
                inner = <TextInput/>
                break;
            case 1:
                inner = <p>Tab 2</p>
                break
        }

       return <div>
            <div>
                <button onClick={() => {this.handleTabChange(0)}}>tab 1</button>
                <button onClick={() => {this.handleTabChange(1)}}>tab 2</button>
            </div>
            <div>
                {inner}
            </div>
        </div>
    }
}

root.render(<App/>);