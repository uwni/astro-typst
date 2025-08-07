import { NodeCompiler, DynLayoutCompiler } from "@myriaddreamin/typst-ts-node-compiler";
// import TypstTsCompiler from "@myriaddreamin/typst-ts-node-compiler";
// console.log({TypstTsCompiler});
// const { NodeCompiler, DynLayoutCompiler, } = TypstTsCompiler;
// type CompileArgs = any;
// type NodeTypstDocument = any;
// type CompileDocArgs = any;
// type NodeCompiler = any;
// type DynLayoutCompiler = any;
import { load } from "cheerio";
import logger from "./logger.js";
import { getConfig } from "./store.js";
/** The cached compiler instance */
let compilerIns;
/** The cached dynamic layout compiler instance */
let dynCompilerIns;
function prepareSource(source, _options) {
    if (typeof source === "string") {
        source = { mainFileContent: source };
    }
    return source;
}
function getInitOptions() {
    const config = getConfig();
    const initOptions = {
        workspace: "./", // default
    };
    if (config.fontArgs) {
        initOptions.fontArgs = config.fontArgs;
    }
    return initOptions;
}
function initCompiler() {
    return NodeCompiler.create(getInitOptions());
}
export function getOrInitCompiler() {
    return (compilerIns ||= initCompiler());
}
export function getOrInitDynCompiler() {
    return (dynCompilerIns ||= DynLayoutCompiler.fromBoxed(NodeCompiler.create(getInitOptions()).intoBoxed()));
}
export function getFrontmatter($typst, source) {
    var frontmatter = {};
    try {
        const data = $typst.query(source, { selector: "<frontmatter>" });
        if (data?.length > 0) {
            frontmatter = data[0].value;
        }
    }
    catch (error) {
        logger.compileError("Querying frontmatter but got", error);
        if (JSON.stringify(error).includes("unknown variable: html")) {
            logger.compileError("You may be rendering a Typst file that is intended to be using html export, but you are using SVG export. Please check if the file path matches the result of the `mode.detect` in your configuration.");
        }
    }
    return frontmatter;
}
/**
 * @param source The source code of the .typ file.
 * @param options Options for rendering the SVG.
 * @returns The SVG string.
 */
export async function renderToSVGString(source, options) {
    source = prepareSource(source, options);
    const $typst = source.mainFileContent ? getOrInitCompiler() : initCompiler();
    const svg = await renderToSVGString_($typst, source);
    $typst.evictCache(60);
    let $ = load(svg, {
        xml: true,
    });
    (options?.cheerio?.preprocess) && ($ = options?.cheerio?.preprocess($, source));
    const remPx = options?.remPx || 16;
    const width = $("svg").attr("width");
    if (options?.width === undefined && width !== undefined) {
        const remWidth = parseFloat(width) * 2 / remPx;
        $("svg").attr("width", `${remWidth}rem`);
    }
    else {
        $("svg").attr("width", options?.width);
    }
    const height = $("svg").attr("height");
    if (options?.height === undefined && height !== undefined) {
        const remHeight = parseFloat(height) * 2 / remPx;
        $("svg").attr("height", `${remHeight}rem`);
    }
    else if (options?.height) {
        $("svg").attr("height", options?.height);
    }
    if (options?.style === false) {
        $("style").remove();
    }
    if (options?.props) {
        for (const [key, value] of Object.entries(options?.props)) {
            $("svg").attr(key, value);
        }
    }
    (options?.cheerio?.postprocess) && ($ = options?.cheerio?.postprocess($, source));
    const svgString = options?.cheerio?.stringify ? options?.cheerio?.stringify($, source) : $.html();
    // @ts-ignore
    return { svg: svgString, frontmatter: () => getFrontmatter($typst, source) };
}
async function renderToSVGString_($typst, source) {
    const docRes = $typst.compile(source);
    if (!docRes.result) {
        docRes.printDiagnostics();
        return "";
    }
    const doc = docRes.result;
    const svg = $typst.svg(doc);
    return svg;
}
export async function renderToVectorFormat(source, options) {
    source = prepareSource(source, options);
    const $typst = getOrInitCompiler();
    const vector = $typst.vector(source);
    return { vector };
}
export async function renderToDynamicLayout(source, options) {
    if (!options["x-target"]) {
        options["x-target"] = "web";
    }
    source = prepareSource(source, options);
    const $dyn = getOrInitDynCompiler();
    const res = $dyn.vector(source);
    return res;
}
/**
 * @param source The source code of the .typ file.
 * @param options Options for rendering the HTML.
 * @returns The HTML string.
 */
export async function renderToHTML(source, options) {
    const onlyBody = source.body;
    source = prepareSource(source, options);
    const $typst = getOrInitCompiler();
    const docRes = $typst.compileHtml(source);
    if (!docRes.result) {
        logger.error("Error compiling typst to HTML");
        docRes.printDiagnostics();
        return { html: "" };
    }
    const doc = docRes.result;
    const html = $typst.tryHtml(doc);
    if (!html.result) {
        html.printDiagnostics();
        return { html: "" };
    }
    return {
        html: onlyBody === "hast" ?
            html.result.hast() :
            onlyBody !== false ?
                html.result.body() :
                html.result.html(),
        frontmatter: () => getFrontmatter($typst, doc),
    };
}
/**
 * @deprecated Need to be removed
 */
export async function renderToHast(source, options) {
    const onlyBody = source?.body !== false;
    source = prepareSource(source, options);
    const $typst = getOrInitCompiler();
    const docRes = $typst.compileHtml(source);
    if (!docRes.result) {
        logger.error("Error compiling typst to HTML");
        docRes.printDiagnostics();
        return { html: "" };
    }
    const doc = docRes.result;
    const html = $typst.tryHtml(doc);
    if (!html.result) {
        html.printDiagnostics();
        return { html: "" };
    }
    return {
        html: html.result.hast(),
        frontmatter: () => getFrontmatter($typst, doc),
    };
}
export async function renderToHTMLish(source, options, isHtml = true) {
    var html;
    var getFrontmatter = () => ({});
    if (isHtml) {
        // source.body = options?.body !== false;
        let { html: htmlRes, frontmatter } = await renderToHTML(source, options);
        html = htmlRes;
        getFrontmatter = frontmatter || (() => ({}));
    }
    else /* svg */ {
        let { svg, frontmatter } = await renderToSVGString(source, options);
        html = svg;
        getFrontmatter = frontmatter || (() => ({}));
    }
    return {
        html,
        getFrontmatter,
    };
}
//# sourceMappingURL=typst.js.map