import {ce, now} from "./util.js";
import {Component} from "./Component.js";

const BLINK_DELAY = 500; // ms
const BLINK_INTERVAL = 1000; // ms

export class Caret extends Component {
    constructor(props) {
        super(props);

        this.state = {
            isVisible: true,
        };

        this.timer_ = null;
    }

    static new() {
        return ce(Caret, {start: now()})
    }

    static getDerivedStateFromProps(props) {
        if (now() < props.start + BLINK_DELAY) {
            return {isVisible: true};
        } else {
            return {};
        }
    }

    componentDidMount() {
        this.timer_ = setInterval(() => {
            this.setState({
                isVisible: !this.state.isVisible
            });
        }, BLINK_INTERVAL);
    }

    componentWillUnmount() {
        clearInterval(this.timer_);
    }

    render() {
        return ce("span", Object.assign({id: "caret"}, this.state.isVisible ? {visible: ""} : {}), "\xA0");
    }
}