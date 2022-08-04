import {FileViewerData} from "./FileViewerData.js";

export class EditorData extends FileViewerData {
    constructor(db, files, active) {
        super(db, files, active);
    }

    static async new(db, initKey = null) {
        let dbFiles = await db.getFiles();

		let that = (new EditorData(db, new Map(), null)).sync(dbFiles);

		if (initKey !== null) {
			that = that.setActive(initKey);
        }

        return that;
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

		// autosave (shoot and forget)
		this.db_.setFile(this.active_, fileData.raw);

        return new EditorData(
            that.db_,
            that.files_,
            that.active_,
        );
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
