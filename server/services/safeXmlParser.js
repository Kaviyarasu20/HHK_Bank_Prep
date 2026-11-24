/**
 * Hardened, zero-dependency XML tokenizer & feed parser for RSS 2.0 and Atom feeds.
 *
 * Security protections:
 * - Rejects <!DOCTYPE and <!ENTITY declarations outright (blocks XXE & Billion Laughs).
 * - Enforces maximum document size (default 2 MB), nesting depth (default 32), and node count (default 5,000).
 * - Decodes only standard XML predefined entities + numeric character references (single-pass, non-recursive).
 * - Preserves CDATA content intact without stripping URLs.
 * - Supports XML namespaces (e.g. dc:creator, content:encoded, atom:link).
 */

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const DEFAULT_MAX_DEPTH = 32;
const DEFAULT_MAX_NODES = 5000;

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
};

/**
 * Single-pass XML entity decoder (non-recursive to prevent entity-expansion attacks).
 * Never strips URLs.
 */
export function decodeXmlEntities(text = "") {
  return String(text).replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]+);/g, (full, ent) => {
    if (ent.startsWith("#x") || ent.startsWith("#X")) {
      const code = parseInt(ent.slice(2), 16);
      if (Number.isInteger(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return "";
        }
      }
      return "";
    }
    if (ent.startsWith("#")) {
      const code = parseInt(ent.slice(1), 10);
      if (Number.isInteger(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return "";
        }
      }
      return "";
    }
    const key = ent.toLowerCase();
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key)
      ? NAMED_ENTITIES[key]
      : full;
  });
}

/**
 * Strips HTML markup from article descriptions/summaries for plain-text storage
 * without stripping URLs or corrupting punctuation.
 */
export function stripHtmlToPlainText(text = "") {
  const decoded = decodeXmlEntities(text);
  return decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(attrString) {
  const attrs = {};
  let i = 0;
  const len = attrString.length;
  while (i < len) {
    while (i < len && /\s/.test(attrString[i])) i++;
    if (i >= len) break;

    const nameStart = i;
    while (i < len && !/[\s=/>]/.test(attrString[i])) i++;
    const name = attrString.slice(nameStart, i).toLowerCase();
    if (!name) break;

    while (i < len && /\s/.test(attrString[i])) i++;
    if (attrString[i] !== "=") {
      attrs[name] = "";
      continue;
    }
    i++; // skip '='
    while (i < len && /\s/.test(attrString[i])) i++;

    let value = "";
    if (attrString[i] === '"' || attrString[i] === "'") {
      const quote = attrString[i++];
      const valStart = i;
      while (i < len && attrString[i] !== quote) i++;
      value = decodeXmlEntities(attrString.slice(valStart, i));
      if (i < len && attrString[i] === quote) i++;
    } else {
      const valStart = i;
      while (i < len && !/[\s>]/.test(attrString[i])) i++;
      value = decodeXmlEntities(attrString.slice(valStart, i));
    }
    attrs[name] = value;
  }
  return attrs;
}

/**
 * Parses an XML string into a lightweight, safe tree structure.
 * Throws descriptive errors on XXE/DOCTYPE, oversized payloads, excessive nesting, or malformed syntax.
 */
export function parseSafeXml(
  xmlInput,
  {
    maxBytes = DEFAULT_MAX_BYTES,
    maxDepth = DEFAULT_MAX_DEPTH,
    maxNodes = DEFAULT_MAX_NODES,
  } = {},
) {
  if (typeof xmlInput !== "string") {
    throw new Error("XML input must be a string.");
  }

  const byteLen = Buffer.byteLength(xmlInput, "utf8");
  if (byteLen === 0) {
    throw new Error("XML document is empty.");
  }
  if (byteLen > maxBytes) {
    throw new Error(`XML document exceeds maximum allowed size (${maxBytes} bytes).`);
  }

  // Reject NUL bytes and disallowed XML 1.0 control characters
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xmlInput)) {
    throw new Error("XML document contains invalid control characters.");
  }

  // Strictly block DOCTYPE and ENTITY declarations (XXE & Billion Laughs mitigation)
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xmlInput)) {
    throw new Error("XML DOCTYPE and ENTITY declarations are forbidden.");
  }

  const root = { tag: "#root", localName: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  let nodeCount = 0;
  let i = 0;
  const len = xmlInput.length;

  // Strip UTF-8 BOM if present
  if (xmlInput.charCodeAt(0) === 0xfeff) i = 1;

  while (i < len) {
    const lt = xmlInput.indexOf("<", i);
    if (lt === -1) {
      const trailing = xmlInput.slice(i);
      if (trailing.trim()) {
        stack[stack.length - 1].text += decodeXmlEntities(trailing);
      }
      break;
    }

    if (lt > i) {
      const textChunk = xmlInput.slice(i, lt);
      stack[stack.length - 1].text += decodeXmlEntities(textChunk);
    }

    // CDATA section
    if (xmlInput.startsWith("<![CDATA[", lt)) {
      const end = xmlInput.indexOf("]]>", lt + 9);
      if (end === -1) throw new Error("Unterminated CDATA section.");
      stack[stack.length - 1].text += xmlInput.slice(lt + 9, end);
      i = end + 3;
      continue;
    }

    // Comment
    if (xmlInput.startsWith("<!--", lt)) {
      const end = xmlInput.indexOf("-->", lt + 4);
      if (end === -1) throw new Error("Unterminated XML comment.");
      i = end + 3;
      continue;
    }

    // Processing instruction (<?xml ... ?>)
    if (xmlInput.startsWith("<?", lt)) {
      const end = xmlInput.indexOf("?>", lt + 2);
      if (end === -1) throw new Error("Unterminated XML processing instruction.");
      i = end + 2;
      continue;
    }

    // Closing tag
    if (xmlInput.startsWith("</", lt)) {
      const gt = xmlInput.indexOf(">", lt + 2);
      if (gt === -1) throw new Error("Malformed closing XML tag.");
      const closeTag = xmlInput.slice(lt + 2, gt).trim().toLowerCase();
      if (stack.length <= 1) {
        throw new Error(`Unexpected closing tag </${closeTag}>.`);
      }
      const top = stack[stack.length - 1];
      if (top.tag !== closeTag) {
        throw new Error(`Mismatched closing tag: expected </${top.tag}>, got </${closeTag}>.`);
      }
      stack.pop();
      i = gt + 1;
      continue;
    }

    // Opening or self-closing tag
    let gt = lt + 1;
    let inQuote = null;
    while (gt < len) {
      const ch = xmlInput[gt];
      if (inQuote) {
        if (ch === inQuote) inQuote = null;
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ">") {
        break;
      }
      gt++;
    }
    if (gt >= len || xmlInput[gt] !== ">") {
      throw new Error("Unterminated XML opening tag.");
    }

    const rawTag = xmlInput.slice(lt + 1, gt).trim();
    if (!rawTag) throw new Error("Empty XML tag.");

    const selfClosing = rawTag.endsWith("/");
    const tagBody = selfClosing ? rawTag.slice(0, -1).trim() : rawTag;
    const spaceIdx = tagBody.search(/\s/);
    const fullTagName = (spaceIdx === -1 ? tagBody : tagBody.slice(0, spaceIdx)).toLowerCase();
    const attrPart = spaceIdx === -1 ? "" : tagBody.slice(spaceIdx + 1);

    if (!/^[a-z_][a-z0-9._:-]*$/i.test(fullTagName)) {
      throw new Error(`Invalid XML tag name: "${fullTagName}".`);
    }

    nodeCount += 1;
    if (nodeCount > maxNodes) {
      throw new Error(`XML document exceeds maximum allowed node count (${maxNodes}).`);
    }

    const colonIdx = fullTagName.indexOf(":");
    const localName = colonIdx === -1 ? fullTagName : fullTagName.slice(colonIdx + 1);
    const node = {
      tag: fullTagName,
      localName,
      attrs: attrPart ? parseAttributes(attrPart) : {},
      children: [],
      text: "",
    };

    stack[stack.length - 1].children.push(node);
    if (!selfClosing) {
      if (stack.length >= maxDepth) {
        throw new Error(`XML document exceeds maximum nesting depth (${maxDepth}).`);
      }
      stack.push(node);
    }
    i = gt + 1;
  }

  if (stack.length !== 1) {
    throw new Error(`Unclosed XML tag <${stack[stack.length - 1].tag}>.`);
  }

  return root;
}

function findChild(node, ...names) {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return node.children.find((c) => wanted.has(c.tag) || wanted.has(c.localName)) || null;
}

function findChildren(node, ...names) {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return node.children.filter((c) => wanted.has(c.tag) || wanted.has(c.localName));
}

function extractAtomLink(entry) {
  const links = findChildren(entry, "link", "atom:link");
  if (!links.length) return "";
  const alternate = links.find((l) => !l.attrs.rel || l.attrs.rel.toLowerCase() === "alternate");
  const chosen = alternate || links[0];
  return (chosen.attrs.href || chosen.text || "").trim();
}

function extractRssLink(item) {
  const linkNode = findChild(item, "link");
  if (linkNode) {
    const textLink = (linkNode.text || "").trim();
    if (textLink) return textLink;
    if (linkNode.attrs.href) return linkNode.attrs.href.trim();
  }
  const atomLink = findChild(item, "atom:link");
  if (atomLink?.attrs?.href) return atomLink.attrs.href.trim();

  const guid = findChild(item, "guid");
  if (guid && /^https?:\/\//i.test((guid.text || "").trim())) {
    const isPerma = (guid.attrs.ispermalink || "true").toLowerCase() !== "false";
    if (isPerma) return guid.text.trim();
  }
  return "";
}

/**
 * Parses an RSS 2.0 or Atom XML string into normalized raw feed entries.
 */
export function parseFeedXml(xmlInput, options = {}) {
  const root = parseSafeXml(xmlInput, options);

  // Detect RSS 2.0 (<rss><channel><item>...) or RDF (<rdf:RDF><item>...)
  const rssRoot = findChild(root, "rss");
  if (rssRoot) {
    const channel = findChild(rssRoot, "channel");
    if (!channel) throw new Error("RSS feed is missing <channel> element.");
    const feedTitle = stripHtmlToPlainText(findChild(channel, "title")?.text || "");
    const items = findChildren(channel, "item").map((item) => {
      const title = stripHtmlToPlainText(findChild(item, "title")?.text || "");
      const link = extractRssLink(item);
      const descRaw =
        findChild(item, "content:encoded")?.text ||
        findChild(item, "description")?.text ||
        findChild(item, "summary")?.text ||
        "";
      const description = stripHtmlToPlainText(descRaw);
      const pubDateRaw = (
        findChild(item, "pubdate", "dc:date", "published", "updated")?.text || ""
      ).trim();
      const sourceNode = findChild(item, "source");
      const sourceName = stripHtmlToPlainText(sourceNode?.text || "") || feedTitle;
      return { title, link, description, pubDateRaw, sourceName };
    });
    return { format: "rss", feedTitle, items };
  }

  // Detect Atom (<feed><entry>...)
  const atomRoot = findChild(root, "feed");
  if (atomRoot) {
    const feedTitle = stripHtmlToPlainText(findChild(atomRoot, "title")?.text || "");
    const items = findChildren(atomRoot, "entry").map((entry) => {
      const title = stripHtmlToPlainText(findChild(entry, "title")?.text || "");
      const link = extractAtomLink(entry);
      const descRaw =
        findChild(entry, "summary")?.text ||
        findChild(entry, "content")?.text ||
        "";
      const description = stripHtmlToPlainText(descRaw);
      const pubDateRaw = (
        findChild(entry, "published", "updated")?.text || ""
      ).trim();
      const sourceTitle = stripHtmlToPlainText(
        findChild(findChild(entry, "source") || { children: [] }, "title")?.text || "",
      );
      return { title, link, description, pubDateRaw, sourceName: sourceTitle || feedTitle };
    });
    return { format: "atom", feedTitle, items };
  }

  throw new Error("Unsupported XML feed format (expected RSS 2.0 <rss> or Atom <feed>).");
}
