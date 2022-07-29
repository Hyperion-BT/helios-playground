import {ce, now} from "./util.js";
import {Component} from "./Component.js";

const BLINK_DELAY = 250; // ms
const BLINK_INTERVAL = 500; // ms

export class Caret extends Component {
    constructor(props) {
        super(props);

        this.state = {
            isVisible: true,
        };

        this.timer_ = null;
    }

    static new(pulsating) {
        if (pulsating) {
            return ce(Caret, {pulsating: "", start: now()});
        } else {
            return ce(Caret, null);
        }
    }

    static getDerivedStateFromProps(props, state) {
        if (props.pulsating != undefined && now() < props.start + BLINK_DELAY) {
            return {isVisible: true};
        } else {
            return state;
        }
    }

    componentDidMount() {
        if (this.props.pulsating != undefined) {
            this.timer_ = setInterval(() => {
                this.setState({
                    isVisible: !this.state.isVisible
                });
            }, BLINK_INTERVAL);
        }
    }

    componentWillUnmount() {
        if (this.timer_ != undefined) {
            clearInterval(this.timer_);
        }
    }

    render() {
        if (this.props.pulsating != undefined) {
            return ce("span", Object.assign({id: "caret"}, this.state.isVisible ? {visible: ""} : {}), "\xA0");
        } else {
            return ce("span", {id: "caret"}, "\xA0");
        }
    }
}
