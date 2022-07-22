import {assertDefined} from "./util.js";
import {FileData} from "./FileData.js";

export class EditorData {
    constructor(db, files, active) {
        this.db_ = db; // the db should as much as possible be the single source of truth for scripts, however we don't necessarily want to save 

        this.files_  = files; // map of db key -> FileData
        this.active_ = active; // file currently being displayed, null -> nothing
    }

    static new(db) {
        return new EditorData(assertDefined(db), new Map(), null, null);
    }

    get db() {
        return this.db_;
    }

    get activeKey() {
        if (this.active_ != null && this.files_.has(this.active_)) {
            return this.active_;
        } else {
            return null
        }
    }
    
    get activeFile() {
        if (this.active_ != null && this.files_.has(this.active_)) {
            return this.files_.get(this.active_);
        } else {
            return null;
        }
    }    

    isSynced(files) {
        for (let [key, _] of files) {
            if (!this.files_.has(key)) {
                return false;
            }
        }

        for (let [key, _] of this.files_) {
            if (!files.has(key)) {
                return false;
            }
        }

        return true;
    }

    // doesn't mutate, returns new EditorData
    syncFiles(files) {
        let newFiles = new Map();

        // only copy FileData for files that are in db
        for (let [key, fileData] of this.files_) {
            if (files.has(key)) {
                newFiles.set(key, fileData);
            }
        }

        // next open files that aren't yet opened
        for (let [key, file] of files) {
            if (!this.files_.has(key)) {
                newFiles.set(key, FileData.new(file.data));
            }
        }

        let activeKey = this.active_;
        if (!newFiles.has(activeKey)) {
            activeKey = null;
        }

        return new EditorData(this.db_, newFiles, activeKey);
    }

    // returns map of files
    getFiles(callback) {
        this.db_.getFiles().then((files) => {
            // now we must open all the files
            if (!this.isSynced(files)) {
                callback(this.syncFiles(files));
            }
        });

        return this.files_;
    }


    // doesn't mutate, returns new EditorData
    setActive(key) {
        if (this.files_.has(key)) {
            return new EditorData(this.db_, this.files_, key);
        } else {
            return new EditorData(this.db_, this.files_, null);
        }
    }

    // doesn't mutate, returns new EditorData
    setActiveFileData(fileData) {
        if (this.active_ == null) {
            return this;
        } else {
            let newFiles = new Map();
            for (let [key, _] of this.files_) {
                newFiles.set(key, this.files_.get(key));
            }

            newFiles.set(this.active_, fileData);

            return new EditorData(this.db_, newFiles, this.active_);
        }
    }

    updateActive(fn) {
        if (this.active_ != null && this.files_.has(this.active_)) {
            return this.setActiveFileData(fn(this.files_.get(this.active_)));
        }
    }

    get isActiveDirty() {
        if (this.active_ != null) {
        let files = this.db_.getFilesSync();

        if (files.has(this.active_) && this.files_.has(this.active_)) {
            return files.get(this.active_).data != this.files_.get(this.active_).raw;
        } else {
            return false;
        }
        } else {
            return false;
        }
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