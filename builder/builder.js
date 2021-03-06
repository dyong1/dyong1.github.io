const cheerio = require("cheerio")
const fs = require("fs")
const fsp = fs.promises
const fx = require("mkdir-recursive")
const path = require("path")

const REPEATIVE_DATE_REGEX = /\d{4}-\d{2}-\d{2}/g

exports.newBuilder = function newBuilder({ logger, useHugo }) {
    return {
        exportPostingFilesFromHtml,
    }

    async function exportPostingFilesFromHtml({ htmlTemplatePath, distPath }, html) {
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
            postings.reduce(async (prevPromise, p) => {
                await prevPromise
                return writePostingToFileAsHtml(
                    {
                        htmlTemplate,
                        $head,
                        distPath,
                    },
                    p,
                )
            }, Promise.resolve())
            logger.info("finished writing postings to files")
        } catch (err) {
            throw new Error(`failed to write postings to files: ${err.message}`)
        }
    }

    async function loadHtmlTemplate(templatePath) {
        const templateStr = await fsp.readFile(templatePath, "utf8")

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
        for (
            currentBegin = hh[0], nextBegin = hh[1], idx = 0;
            currentBegin;
            currentBegin = nextBegin, nextBegin = hh[idx + 1], idx++
        ) {
            const $currentBegin = $(currentBegin)
            const titleNode = $currentBegin
            let title = titleNode.text().replace(REPEATIVE_DATE_REGEX, "").trim()
            if (!title) {
                logger.info(`ignore record at ${idx} as valid title is missing`)
                continue
            }
            const lowerCaseTitle = title.toLowerCase()
            if (!lowerCaseTitle.includes("[published]")) {
                continue
            }
            title = title.slice("[published]".length+2)
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
    async function writePostingToFileAsHtml(
        {
            htmlTemplate,
            $head,
            distPath,
        },
        posting,
    ) {
        logger.debug(`start writing posting to file [posting.title=${posting.title}]`)
        const filepath = postingFilePath(distPath, posting)
        const dirname = filepath.slice(0, filepath.lastIndexOf("/"))
        if(!fs.existsSync(dirname)) {
            await new Promise((resolve, reject) => {
                fx.mkdir(dirname, function (err) {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve()
                })
            })
        }

        await fsp.writeFile(filepath,
            useHugo ? postingToHugoHtml({ htmlTemplate, $head }, posting) : postingToHtml({ htmlTemplate, $head }, posting),
            )
        logger.debug(`finished writing posting to file [posting.title=${posting.title}]`)
    }
    function postingFilePath(distPath, p) {
        return path.resolve(distPath, `${p.uri.slice(1)}.html`)
    }
    function postingToHugoHtml({ $head }, posting) {
        return [
            hugoFrontMatter(posting),
            `<style>${sanitizeCss($head.find("style").html())}</style>`,
            cheerio.html(sanitizeStyle(posting.contentNodes)),
        ].join("")
    }
    function sanitizeStyle(nodes) {
        const nodesWithStyle = nodes.find("[style]")
        for (let i=0; i < nodesWithStyle.length; ++i) {
            const s = nodesWithStyle[i].attribs.style
            const r = /width:/
            const m = r.exec(s)
            if (!m) {
                delete nodesWithStyle[i].attribs["style"]
                continue
            }
            nodesWithStyle[i].attribs.style = "width:100%;" + s
                    .replace(/width:/gi, "max-width:")
                    .replace(/height:/gi, "max-height:")
                    .replace(/max-max-width:/gi, "max-width:")
                    .replace(/max-max-height:/gi, "max-height:")
        }
        return nodes
    }
    function sanitizeCss(original) {
        return [
            /font-family:\s*['"][\s\w]+['"];?/gi,
            /font-size:\s*\d+(pt|px|rem|em);?/gi,
            /line-height:\s*[\d.]+;?/gi,
            /padding:(\s*\d+(pt|px|rem|em)\s*)+;?/gi,
            /padding-top:\s*\d+(pt|px|rem|em);?/gi,
            /padding-right:\s*\d+(pt|px|rem|em);?/gi,
            /padding-bottom:\s*\d+(pt|px|rem|em);?/gi,
            /padding-left:\s*\d+(pt|px|rem|em);?/gi,
            /margin:(\s*\d+(pt|px|rem|em)\s*)+;?/gi,
            /margin-top:\s*\d+(pt|px|rem|em);?/gi,
            /margin-right:\s*\d+(pt|px|rem|em);?/gi,
            /margin-bottom:\s*\d+(pt|px|rem|em);?/gi,
            /margin-left:\s*\d+(pt|px|rem|em);?/gi,
        ].reduce((css, regex) => {
            return css.replace(regex, "")
        }, original)
    }
    function hugoFrontMatter(posting) {
        return `---
date: ${posting.postedDate}
title: ${posting.title}
---
`
    }
    function postingToHtml({ htmlTemplate, $head }, posting) {
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
