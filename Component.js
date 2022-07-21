export class Component extends React.Component {
    constructor(props) {
        super(props);

        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
    }

    get isGrabbingKeyboard() {
        return this == this.props.keyboardGrabber;
    }

    get isGrabbingMouse() {
        return this == this.props.mouseGrabber;
    }

    handleFocus() {
        this.props.onKeyboardGrab(this, false);
    }

    handleBlur() {
        this.props.onKeyboardGrab(this, true);
    }

    handleMouseDown() {
        // ungrab is done automatically upon mouseup
        this.props.onMouseGrab(this);
    }

    handleKeyDown(e) {
        if (e.key == "Escape") {
            this.handleBlur();
        }
    }
}