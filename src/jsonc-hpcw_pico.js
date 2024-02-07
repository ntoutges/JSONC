"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringify = exports.parse = void 0;
function parse(text) {
    const strTokens = getStrTokensFromText(text);
}
exports.parse = parse;
function getStrTokensFromText(text) {
    let encapsulators = [];
    const textArr = Array.from(text);
    const strTokens = [];
    for (let i = 0; i < textArr.length; i++) {
        // const lastEncapsulator = encapsulators.length > 0 ? encapsulators[encapsulators.length-1] : null;
        const char = textArr[i];
        const chars = textArr.substring(i, i + 2);
        // if (lastEncapsulator.multiline) {
        //   continue;
        // }
        if (chars == "/*") {
        }
        else if (chars == "//") {
            let endI = textArr.indexOf("\n", i + 2);
            if (endI == -1)
                endI = text.length; // treat the rest as a comment
            strTokens.push({
                keys: [],
                type: "comment",
                value: text.substring(i, endI)
            });
        }
        else if (char == "\"" || char == "\'") { // look for string
            const endI = Array.from(text).findIndex();
            if (endI == -1)
                throw new Error(`JSONC string missing terminating <${char}>`);
        }
    }
    console.log(strTokens);
}
function stringify(value, comments = []) {
    const strTokens = getStrTokensFromObject(value);
    const uncomments = injectCommentsIntoStrTokens(strTokens, comments); // uncomments are the comments without matching keys
    let str = stringifyStrTokens(strTokens);
    // uncomments go at the start of the output
    let uncommentStrs = "";
    for (const uncomment of uncomments) {
        uncommentStrs += getCommentText(uncomment) + "\n";
    }
    return uncommentStrs + str;
}
exports.stringify = stringify;
function getStrTokensFromObject(value) {
    const keyData = [{ keys: [], value }];
    const seenValues = []; // stores objects already seen
    const strTokens = [];
    while (keyData.length > 0) {
        const keyVal = keyData.pop();
        const keys = keyVal.keys;
        const val = keyVal.value;
        if (typeof val == "object" && val !== null) { // push recursive objects
            const seenValue = seenValues.find((data) => data.value == val);
            if (seenValue !== undefined) { // self-reference
                strTokens.push({
                    keys,
                    type: "reference",
                    value: seenValue.keys
                });
                continue;
            }
            seenValues.push({ keys, value: val }); // track for self-reference
            const subkeys = Object.keys(val);
            keyData.push(...subkeys.reverse().map(k => { return { keys: keys.concat(k), value: val[k] }; }));
            if (!keys.length)
                continue; // invalid keys
            strTokens.push({
                keys,
                type: Array.isArray(val) ? "array" : "object",
                value: subkeys.length
            });
            continue;
        }
        strTokens.push({
            keys,
            type: "primative",
            value: val
        });
    }
    return strTokens;
}
function injectCommentsIntoStrTokens(strTokens, comments = []) {
    const uncomments = [];
    for (const comment of comments) {
        let strToken = strTokens.find((strToken) => arrMatches(strToken.keys, comment.reference));
        if (strToken === undefined) {
            uncomments.push(comment); // comment could not be added
            continue;
        }
        if (!strToken.comments)
            strToken.comments = []; // comment not yet added
        strToken.comments.push(comment);
    }
    return uncomments;
}
function stringifyStrTokens(strTokens) {
    let str = "{\n";
    const encapsulators = [];
    for (const i in strTokens) {
        const token = strTokens[i];
        let isLast = +i == strTokens.length;
        let doCheck = true;
        while (doCheck) {
            doCheck = false;
            if (encapsulators.length > 0) {
                let lastEncapsulator = encapsulators[encapsulators.length - 1];
                if (encapsulators.length > 0) {
                    lastEncapsulator.len--;
                    isLast = lastEncapsulator.len <= 0;
                }
                if (lastEncapsulator.len == -1) {
                    str += getTabs(encapsulators.length) + lastEncapsulator.ender + ",\n";
                    encapsulators.pop();
                    // lastEncapsulator = encapsulators[encapsulators.length-1];
                    doCheck = true;
                }
            }
        }
        const tab = getTabs(encapsulators.length + 1);
        const key = JSON.stringify(token.keys[token.keys.length - 1]);
        let oldLen = encapsulators.length;
        // build multiline comments
        if (token.comments) {
            for (const comment of token.comments) {
                if (!isCommentMultiline(comment))
                    continue; // not a block comment
                str += getCommentText(comment, tab) + "\n";
            }
        }
        str += tab;
        switch (token.type) {
            case "array":
                str += `${key}: [`;
                encapsulators.push({ len: token.value, ender: "]" });
                break;
            case "object":
                str += `${key}: {`;
                encapsulators.push({ len: token.value, ender: "}" });
                break;
            case "primative":
                switch (typeof token.value) {
                    case "string":
                        str += `${key}: ${JSON.stringify(token.value)}`;
                        break;
                    case "bigint":
                        str += `${key}: ${token.value}n`;
                        break;
                    case "boolean":
                    case "number":
                    case "undefined":
                    case "object": // null
                        str += `${key}: ${token.value}`;
                        break;
                }
                break;
            case "reference":
                str += `${key}: ${"__:[" + token.value.map(val => JSON.stringify(val)).join(",") + "]"}`;
                break;
        }
        if (oldLen == encapsulators.length && !isLast)
            str += ","; // if (not equal, started new encapsulator)/(isLast)--don't add comma
        // bulid single line comments
        if (token.comments) {
            for (const comment of token.comments) {
                if (isCommentMultiline(comment))
                    continue; // multiline
                str += getCommentText(comment);
            }
        }
        str += "\n";
    }
    // close all open encapsulators
    while (encapsulators.length > 0) {
        const encapsulator = encapsulators.pop();
        str += getTabs(encapsulators.length + 1) + encapsulator.ender + "\n";
    }
    return str + "}";
}
function getTabs(len = 0) {
    return "".padEnd(len * 2, " ");
}
function isCommentMultiline(comment) {
    return comment.text.indexOf("\n") != -1;
}
function getCommentText(comment, tabs = "") {
    if (!comment.inline && ("inline" in comment)) { // block
        return `${tabs}/*\n${tabs}${getTabs(1)}${comment.text}\n${tabs}*/`;
    }
    // inline
    return comment.text.split("\n").map(line => `${tabs}// ${line}`).join("\n");
}
function arrMatches(arr1, arr2) {
    if (arr1.length != arr2.length)
        return false;
    return arr1.every((val, i) => val == arr2[i]);
}
//# sourceMappingURL=jsonc.js.map