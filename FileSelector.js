import {ce} from "./util.js";
import {Component} from "./Component.js";

export class FileSelector extends Component {
    constructor(props) {
        super(props);
    }

  
    render() {
        let options = [ce("option", {disabled: "", value: "", style: {display: "none"}}, "-- select a file --")];

        for (let [key, fileData] of this.props.data) {
            let name = fileData.name;

            // file should at least have a valid name to be an option here
            if (name != null && name != "") {
                options.push(ce("option", {value: key}, name));
            }
        }

        return ce("select", {value: this.props.active == null ? "" : this.props.active, className: "file-selector", onChange: this.props.onChange}, ...options);
    }
}