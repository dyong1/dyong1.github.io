const path = require("path")
const request = require("request")
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
            await builder.exportPostingFilesFromHtml(
                {
                    htmlTemplatePath: path.resolve(__dirname, HTML_TEMPLATE_PATH),
                    distUri: path.resolve(__dirname, DIST_URI),
                },
                html,
            )
        } catch (err) {
            logger.error(err.message)
            process.exit(1)
        }
    }
})()
