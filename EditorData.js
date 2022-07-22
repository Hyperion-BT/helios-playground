import {FileViewerData} from "./FileViewerData.js";

export class EditorData extends FileViewerData {
    constructor(db, files, active) {
        super(db, files, active);
    }

    static new(db) {
        return new EditorData(db, new Map(), null);
    }

    sync(dbFiles) {
        let that = super.sync(dbFiles);

        return new EditorData(
            that.db_,
            that.files_,
            that.active_,
        );
    }

    setActive(key) {
        let that = super.setActive(key);

        return new EditorData(
            that.db_,
            that.files_,
            that.active_,
        );
    }

    setActiveFileData(fileData) {
        let that = super.setActiveFileData(fileData);

        return new EditorData(
            that.db_,
            that.files_,
            that.active_,
        );
    }

    saveActiveFile() {
        if (this.files_.has(this.active_)) {
            let raw = this.files_.get(this.active_).raw;

            return this.db_.setFile(this.active_, raw);
        }
    }

    // doesn't mutate, return Promise<EditorData>
    deleteActiveFile() {
        if (this.files_.has(this.active_)) {

            return this.db_.deleteFile(this.active_).then(() => {
                return this.setActive(null);
            });
        } else {
            return new Promise((resolve, reject) => {resolve()});
        }
    }

}