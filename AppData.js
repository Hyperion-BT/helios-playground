import {assertDefined} from "./util.js";
import {EditorData} from "./EditorData.js";
import {DebuggerData} from "./DebuggerData.js";

export class AppData {
    constructor(db, editorData, debuggerData) {
        this.db_ = assertDefined(db);

        this.editorData_ = editorData;
        this.debuggerData_ = debuggerData;
    }

    static async new(db, initKey = null) {
		let editorData = await EditorData.new(db, initKey);
		let debuggerData = await DebuggerData.new(db);

        return new AppData(db, editorData, debuggerData);
    }

    get editorData() {
        return this.editorData_;
    }

    get debuggerData() {
        return this.debuggerData_;
    }

    // doesn't mutate, returns new AppData
    setEditorData(d) {
        return new AppData(this.db_, d, this.debuggerData_);
    }

    // doesn't mutate, returns new AppData
    setDebuggerData(d) {
        return new AppData(this.db_, this.editorData_, d);
    }
}
