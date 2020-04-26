const cheerio = require("cheerio")
const fs = require("fs").promises
const fx = require("mkdir-recursive")
const path = require("path")

const REPEATIVE_DATE_REGEX = /\d{4}-\d{2}-\d{2}/g

exports.newBuilder = function newBuilder({ logger }) {
    return {
        exportPostingFilesFromHtml,
    }

    async function exportPostingFilesFromHtml(htmlTemplatePath, html) {
        const htmlTemplate = await loadHtmlTemplate(htmlTemplatePath)
        logger.debug("exporting postings from html to files")

        const $ = cheerio.load(html)
        const $head = $To$head($)
        const postings = $ToPostings($)
        if (postings.length === 0) {
            logger.info("no postings")
            return
        }

        try {
            logger.info("start writing postings to files")
            await Promise.all(postings.map((p) =>
                writePostingToFileAsHtml(
                    p,
                    {
                        htmlTemplate,
                        $head,
                    }
                )
            ))
            logger.info("finished writing postings to files")
        } catch (err) {
            throw new Error(`failed to write postings to files: ${err.message}`)
        }
    }

    async function loadHtmlTemplate(templatePath) {
        const templateStr = await fs.readFile(path.resolve(__dirname, templatePath), "utf8")

        const headAt = templateStr.indexOf("{{head}}")
        const headLen = "{{head}}".length
        const contentsAt = templateStr.indexOf("{{contents}}")
        const contentsLen = "{{contents}}".length

        return {
            untilHead: templateStr.slice(0, headAt),
            afterHeadUntilContents: templateStr.slice(headAt + headLen, contentsAt),
            afterContents: templateStr.slice(contentsAt + contentsLen),
        }
    }

    function $To$head($) {
        return $("head")
    }

    function $ToPostings($) {
        const hh = $("h1").map((_, e) => e)
        if (!hh || hh.length === 0) {
            return []
        }

        const postings = []
        let currentBegin = hh[0]
        let nextBegin = hh[1]
        let idx = 0
        while (currentBegin) {
            const $currentBegin = $(currentBegin)
            const titleNode = $currentBegin
            const title = titleNode.text().replace(REPEATIVE_DATE_REGEX, "").trim()
            if (!title) {
                logger.info(`ignore record at ${idx} as valid title is missing`)
                continue
            }
            const contentNodes = titleNode.nextUntil(nextBegin)
            if (contentNodes.length === 0) {
                logger.info(`ignore record at ${idx} as valid contents are missing`)
                continue
            }
            const dateMatch = REPEATIVE_DATE_REGEX.exec(titleNode.text())
            if (!dateMatch) {
                logger.info(`ignore record at ${idx} as valid posted date is missing`)
                continue
            }
            const postedDate = dateMatch[0]
            if (!postedDate) {
                logger.info(`ignore record at ${idx} as valid posted date is missing`)
                continue
            }
            const uri = postingUri(title, postedDate)
            if (!uri) {
                logger.info(`ignore record at ${idx} as valid uri is missing`)
                continue
            }
            postings.push({
                title,
                titleNode,
                contentNodes,
                postedDate,
                uri,
            })
            currentBegin = nextBegin
            nextBegin = hh[idx+1]
            idx++
        }

        return postings
    }
    function postingUri(title, postedDate) {
        if (!title) {
            return null
        }
        if (!postedDate) {
            return null
        }
        const yyyy = postedDate.slice(0, 4)
        const mm = postedDate.slice(5, 7)
        const dd = postedDate.slice(8, 10)
        const t = title.toLowerCase().replace(/\s/g, "-")
        return `/${yyyy}/${mm}/${dd}/${t}`
    }
    async function writePostingToFileAsHtml(posting, { htmlTemplate, $head }) {
        logger.debug(`start writing posting to file [posting.title=${posting.title}]`)
        const filepath = postingFilePath(posting)
        await new Promise((resolve, reject) => {
            fx.mkdir(filepath.slice(0, filepath.lastIndexOf("/")), function (err) {
                if (err) {
                    reject(err)
                    return
                }
                resolve()
            })
        })
        await fs.writeFile(filepath, postingToHtml({htmlTemplate, $head}, posting))
        logger.debug(`finished writing posting to file [posting.title=${posting.title}]`)
    }
    function postingFilePath(p) {
        return path.resolve(__dirname, "dist", `${p.uri.slice(1)}.html`)
    }
    function postingToHtml({htmlTemplate, $head}, posting) {
        const headInnerHtml = $head.html()
        const titleHtml = cheerio.html(posting.titleNode)
        const contentsInnerHtml = cheerio.html(posting.contentNodes)
        return [
            htmlTemplate.untilHead,
            "<head>",
            headInnerHtml,
            "</head>",
            htmlTemplate.afterHeadUntilContents,
            "<article>",
            titleHtml,
            contentsInnerHtml,
            "</article>",
            htmlTemplate.afterContents,
        ].join("")
    }
}
