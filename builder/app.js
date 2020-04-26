const path = require("path")
const request = require("request")
const rimraf = require("rimraf")
const { newBuilder } = require("./builder")

const {
    BLOG_CONTENTS_URI,
    HTML_TEMPLATE_PATH,
    DIST_URI,
} = process.env

if (!BLOG_CONTENTS_URI) {
    throw new Error("BLOG_CONTENTS_URI is missing")
}
if (!HTML_TEMPLATE_PATH) {
    throw new Error("HTML_TEMPLATE_PATH is missing")
}
if (!DIST_URI) {
    throw new Error("DIST_URI is missing")
}

(async function main() {
    const logger = console
    const builder = newBuilder({ logger })

    request(BLOG_CONTENTS_URI, callback)
    async function callback(err, _, html) {
        try {
            if (err) {
                throw err
            }
            const htmlTemplatePath = path.resolve(__dirname, HTML_TEMPLATE_PATH)
            const distPath = path.resolve(__dirname, DIST_URI)
            await new Promise((resolve, reject) => {
                rimraf(distPath, (err) => {
                    if (err){
                        reject(err)
                        return
                    }
                    resolve()
                })
            })
            await builder.exportPostingFilesFromHtml(
                {
                    htmlTemplatePath,
                    distPath,
                },
                html,
            )
        } catch (err) {
            logger.error(err.message)
            process.exit(1)
        }
    }
})()
