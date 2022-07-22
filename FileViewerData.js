import {assertDefined} from "./util.js";
import {FileData} from "./FileData.js";

export class FileViewerData {
    constructor(db, files, active) {
        this.db_ = db;
        this.files_ = files; // map of db keys -> FileData
        this.active_ = active; // file currently being displayed, null -> nothing
    }

    static new(db) {
        return new FileViewerData(assertDefined(db), new Map(), null);
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

    isSynced(dbFiles) {
        for (let [key, _] of dbFiles) {
            if (!this.files_.has(key)) {
                return false;
            }
        }

        for (let [key, _] of this.files_) {
            if (!dbFiles.has(key)) {
                return false;
            }
        }

        return true;
    }

    // doesn't mutate, returns new FileViewerData
    sync(dbFiles) {
        let newFiles = new Map();

        // only copy FileData for files that are in db
        for (let [key, fileData] of this.files_) {
            if (dbFiles.has(key)) {
                newFiles.set(key, fileData);
            }
        }

        // next open files that aren't yet opened
        for (let [key, file] of dbFiles) {
            if (!this.files_.has(key)) {
                newFiles.set(key, FileData.new(file.data));
            }
        }

        let activeKey = this.active_;
        if (!newFiles.has(activeKey)) {
            activeKey = null;
        }

        return new FileViewerData(this.db_, newFiles, activeKey);
    }

    // returns map of files
    getFiles(callback) {
        this.db_.getFiles().then((dbFiles) => {
            // now we must open all the files
            if (!this.isSynced(dbFiles)) {
                callback(this.sync(dbFiles));
            }
        });

        return this.files_;
    }

    // doesn't mutate, returns new FileViewerData
    setActive(key) {
        if (this.files_.has(key)) {
            return new FileViewerData(this.db_, this.files_, key);
        } else {
            return new FileViewerData(this.db_, this.files_, null);
        }
    }

    // doesn't mutate, returns new FileViewerData
    setActiveFileData(fileData) {
        if (this.active_ == null) {
            return this;
        } else {
            let newFiles = new Map();
            for (let [key, _] of this.files_) {
                newFiles.set(key, this.files_.get(key));
            }

            newFiles.set(this.active_, fileData);

            return new FileViewerData(this.db_, newFiles, this.active_);
        }
    }

    updateActive(fn) {
        if (this.active_ != null && this.files_.has(this.active_)) {
            return this.setActiveFileData(fn(this.files_.get(this.active_)));
        }
    }
}