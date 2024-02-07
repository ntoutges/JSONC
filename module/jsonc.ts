type strToken_t2 = {
  type: string;
  value: any;
}

export function parseAll(jsonString: string): { object: any, comments: comment_t[] } {
  const tokens = tokenize(jsonString);
  let index = 0;
  const rootObj = {};
  const keys: string[] = [];
  const stack: { object: any, key: string, type?: string }[] = [{ object: rootObj, key: ":root:" }];

  const commentStack: comment_t[] = []; // stores comments whose references come after the comment
  const initializedComments: comment_t[] = []; // stores all finished comments

  const selfRefs: { object: any, key: string, token: strToken_t2 }[] = [];

  function replaceLastItemOnStack(newVal: any) {
    if (stack.length < 2) return; // impossible
    const key = stack.pop().key;
    stack[stack.length - 1].object[key] = newVal;
    return key;
  }

  let isNextKey = false;
  while (index < tokens.length) {
    const token = tokens[index++];
    let stackItem = stack[stack.length - 1];

    if (token.type == "COMMENT_BLOCK" || token.type == "COMMENT_INLINE") {
      if (token.type == "COMMENT_BLOCK") { // block keys always come AFTER
        commentStack.push({
          text: token.value,
          reference: [], // none yet defined
          inline: false
        });
      }
      else if (index >= 2 && tokens[index - 2].type == "LINE_END") { // inline comment refers to next (comment on its own line)
        commentStack.push({
          text: token.value,
          reference: [], // none yet defined
          inline: true
        });

        if (index < tokens.length && tokens[index].type == "LINE_END") index++; // skip next newline
      }
      else { // inline comment that refers to its own line
        const keysCopy = keys.slice(); // make copy
        if (keys[keys.length - 1] === null) keysCopy.pop(); // cut off last element (only one that can be uninitalized)
        initializedComments.push({
          text: token.value,
          reference: keysCopy, // none yet defined
          inline: true
        });
      }
      continue; // ignore comments
    }
    if (token.type == "LINE_END") continue; // skip

    // next cannot be key if bracket/brace
    if (isNextKey && (token.type == "RIGHT_BRACKET" || token.type == "RIGHT_BRACE")) isNextKey = false;
    if (isNextKey) {
      if (token.type != "STRING") throw new Error("Key must be of type string.");
      if (tokens[index++].type != "COLON") throw new Error("Expected \":\" after key.");

      const key = token.value;
      stackItem.object[key] = {};
      stack.push({
        key: key,
        object: stackItem.object[key]
      });
      // set new last key
      keys[keys.length - 1] = key;

      isNextKey = false;

      // populate comment references
      const keysCopy = keys.slice(); // make copy
      if (keys[keys.length - 1] === null) keysCopy.pop(); // cut off last element (only one that can be uninitalized)
      for (const comment of commentStack) { comment.reference = keysCopy; }

      initializedComments.push(...commentStack);
      commentStack.splice(0); // delete all elements
      continue;
    }

    switch (token.type) {
      case "LEFT_BRACE": // object
        keys.push(null); // to be set later
        isNextKey = true;
        break;
      case "LEFT_BRACKET": { // array
        const arr = [];
        const key = replaceLastItemOnStack(arr);
        stack.push({ key, object: arr, type: stackItem.type }, { key: "0", object: {}, type: "array" });
        keys.push(null);
        break;
      }
      case "RIGHT_BRACKET":
      case "RIGHT_BRACE": {
        if (
          (token.type == "RIGHT_BRACKET" && stackItem.type != "array")
          || (token.type == "RIGHT_BRACE" && stackItem.type == "array")
        ) throw new Error("Mismatched { and [");

        stack.pop(); // remove array placeholder value
        keys.pop();
        if (stack.length == 0) break; // empty stack
        stackItem = stack[stack.length - 1];
        if (Array.isArray(stackItem.object) && stackItem.type != "array") stack.pop(); // remove array from stack
        if (index < tokens.length && !["RIGHT_BRACKET", "RIGHT_BRACE", "COMMENT_BLOCK", "COMMENT_INLINE", "LINE_END"].includes(tokens[index].type)) {
          if (tokens[index++].type != "COMMA") throw new Error(`Expected \",\" after ${token.value}`);
        }
        if (stackItem.type != "array") isNextKey = true; // object requiring key
        break;
      }
      case "REFERENCE":
      case "NUMBER":
      case "STRING":
      case "BOOLEAN":
      case "BIGINT":
      case "NULL": {
        const value = token.type == "REFERENCE" ? {} : token.value;

        let key: string;
        if (stackItem.type == "array") {
          const oldKey = +replaceLastItemOnStack(value);
          keys[keys.length - 1] = oldKey.toString();
          key = (oldKey + 1).toString();
          stack.push({ key, object: {}, type: "array" });

          if (tokens[index].type == "COMMA") index++;
          // else if (tokens[index].type != "RIGHT_BRACKET") throw new Error(`Expected \",\" after ${token.value}`); // only reason there shouldn't be another comma
        }
        else {
          key = replaceLastItemOnStack(value);
          if (tokens[index].type == "COMMA") index++;
          isNextKey = true;
        }
        if (token.type == "REFERENCE") {
          const object = stack[stack.length - 1].object;
          selfRefs.push({ object, key, token });
        }
        break;
      }
      default:
        debugger;
        console.log(`Unrecognized token: ${token.type}`)
    }
  }

  if (stack.length !== 0) {
    throw new Error("Invalid JSON format: unmatched braces.");
  }

  // resolve references
  for (const ref of selfRefs) {
    const keys = ref.token.value;
    if (keys.length == 0) {
      ref.object[ref.key] = rootObj; // circle back to root
      continue;
    }
    let head = rootObj;
    for (const i in keys) {
      const subkey = keys[i];
      if (!head.hasOwnProperty(subkey)) throw new Error(`Reference *[${keys.join(",")}] could not be reached`)
      if (typeof head != "object" || head === null) throw new Error(`Reference *[${keys.join(",")}] refers to non-iterable object`)
      head = head[subkey]; // assign head on all but the last itteration
    }
    ref.object[ref.key] = head;
  }

  return {
    object: rootObj,
    comments: initializedComments.concat(commentStack) // push any comments put at the end in
  };
}

function tokenize(jsonString: string): strToken_t2[] {
  const tokens: strToken_t2[] = [];
  let index = 0;

  while (index < jsonString.length) {
    const char = jsonString[index];
    switch (char) {
      case '{':
        tokens.push({ type: "LEFT_BRACE", value: "{" });
        index++;
        break;
      case '}':
        tokens.push({ type: "RIGHT_BRACE", value: "}" });
        index++;
        break;
      case '[':
        tokens.push({ type: "LEFT_BRACKET", value: "[" });
        index++;
        break;
      case ']':
        tokens.push({ type: "RIGHT_BRACKET", value: "]" });
        index++;
        break;
      case ',':
        tokens.push({ type: "COMMA", value: "," });
        index++;
        break;
      case ':':
        tokens.push({ type: "COLON", value: ":" });
        index++;
        break;
      case '\"':
      case '\'':
        let stringValue = "";
        index++; // Move past opening quote
        while (index < jsonString.length) {
          const currentChar = jsonString[index];
          if (currentChar === '\\' && jsonString[index + 1] === char) {
            // Escaped quote, add as part of the string
            stringValue += '\\"';
            index += 2; // Move past escaped quote
          } else if (currentChar === char) {
            // End of string
            index++; // Move past closing quote
            break;
          } else {
            stringValue += currentChar;
            index++;
          }
        }
        tokens.push({ type: "STRING", value: stringValue });
        break;

      case '/':
        if (jsonString[index + 1] === '/') {
          // Inline comment, skip until end of line
          let comment = "";
          index += 2; // move past //
          while (jsonString[index] !== '\n' && index < jsonString.length) {
            comment += jsonString[index];
            index++;
          }
          if (tokens.length >= 2 && tokens[tokens.length-1].type == "LINE_END" && tokens[tokens.length-2].type == "COMMENT_INLINE") {
            tokens[tokens.length-2].value += "\n" + comment.trim();
          }
          else tokens.push({ type: "COMMENT_INLINE", value: comment.trim() });
        } else if (jsonString[index + 1] === '*') {
          // Multiline comment, skip until */
          let comment = "";
          index += 2; // Move past /*
          while (!(jsonString[index] === '*' && jsonString[index + 1] === '/') && index < jsonString.length) {
            comment += jsonString[index];
            index++;
          }
          tokens.push({
            type: "COMMENT_BLOCK",
            value: comment.trim().split("\n").map(line => line.trim()).join("\n") // remove extra spaces between lines
          });
          index += 2; // Move past */
        } else {
          throw new Error("Invalid character: " + char);
        }
        break;
      case '*':
        if (jsonString.substring(index, index + 2) === "*[") {
          let referenceValue = "";
          index += 1; // Move past *
          while (jsonString[index] !== ']') {
            referenceValue += jsonString[index];
            index++;
          }
          referenceValue += jsonString[index];
          index++; // Move past closing bracket

          tokens.push({ type: "REFERENCE", value: JSON.parse(referenceValue) });
        } else {
          throw new Error("Invalid character: " + char);
        }
        break;
      case '\n':
        tokens.push({ type: "LINE_END", value: "\n" });
        index++;
        break;
      case ' ':
      case '\t':
      case '\r':
        // Ignore whitespace
        index++;
        break;
      default:
        if (/\d/.test(char)) {
          let numberValue = "";
          while (/\d/.test(jsonString[index]) || jsonString[index] === '.') {
            numberValue += jsonString[index++];
          }
          if (jsonString[index] == "n") { // signifies BigInt
            index++;
            tokens.push({ type: "BIGINT", value: BigInt(numberValue) });
          }
          else tokens.push({ type: "NUMBER", value: parseInt(numberValue) });
        }
        else if (char === 't' && jsonString.substring(index, index + 4) === 'true') {
          tokens.push({ type: "BOOLEAN", value: true });
          index += 4;
        }
        else if (char === 'f' && jsonString.substring(index, index + 5) === 'false') {
          tokens.push({ type: "BOOLEAN", value: false });
          index += 5;
        }
        else if (char === 'n' && jsonString.substring(index, index + 4) === 'null') {
          tokens.push({ type: "NULL", value: null });
          index += 4;
        }

        else {
          throw new Error("Invalid character: " + char);
        }
    }
  }

  return tokens;
}


// if primative, value is primative
// if object/array, value is the amount of values
// if reference, value is the sub-key array
type strToken_t = {
  keys: string[]
  type: "primative" | "object" | "array" | "reference",
  value: any,
  comments?: comment_t[]
}

export type comment_t = {
  text: string
  inline?: boolean // inline indicates inline comment, otherwise, block comment above; defaults to inline:true
  reference: string[] // key this comment refers to; split into multiple array chunks to indicate sub-keys
}

export function stringify(value: any, comments: comment_t[] = []) {
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

function getStrTokensFromObject(value: any) {
  const keyData: Array<{ keys: string[], value: any }> = [{ keys: [], value }];

  const seenValues: { keys: string[], value: any }[] = []; // stores objects already seen
  const strTokens: strToken_t[] = [];

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
      if (!keys.length) continue; // invalid keys

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

function injectCommentsIntoStrTokens(strTokens: strToken_t[], comments: comment_t[] = []) {
  const uncomments: comment_t[] = [];
  for (const comment of comments) {
    let strToken = strTokens.find((strToken) => arrMatches(strToken.keys, comment.reference));
    if (strToken === undefined) {
      uncomments.push(comment); // comment could not be added
      continue;
    }

    if (!strToken.comments) strToken.comments = []; // comment not yet added
    strToken.comments.push(comment);
  }
  return uncomments;
}

function stringifyStrTokens(strTokens: strToken_t[]) {
  let str = "{\n";
  const encapsulators: { len: number, ender: string }[] = [];

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
        if (!isCommentMultiline(comment)) continue;
        str += getCommentText(comment, tab, str[str.length-1]) + "\n";
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
            str += `${key}: ${JSON.stringify(token.value)}`
            break;
          case "bigint":
            str += `${key}: ${token.value}n`
            break;
          case "boolean":
          case "number":
          case "undefined":
            str += `${key}: ${token.value}`
            break;
          case "object": // null
            if (token.value === null) str += `${key}: null`;
            else str += `${key}\"[Object object]\"`; // invalid
            break;
        }
        break;
      case "reference":
        str += `${key}: ${"*[" + (token.value as string[]).map(val => JSON.stringify(val)).join(",") + "]"}`;
        break;
    }
    if (oldLen == encapsulators.length && !isLast) str += ","; // if (not equal, started new encapsulator)/(isLast)--don't add comma

    // bulid single line comments
    if (token.comments) {
      for (const comment of token.comments) {
        if (isCommentMultiline(comment)) continue; // multiline
        str += getCommentText(comment, "", str[str.length-1]);
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

function isCommentMultiline(comment: comment_t) {
  if (comment.inline === false) return true; // block comment, these WILL (eventually) take up multiple lines
  return comment.text.indexOf("\n") != -1;
}

function getCommentText(comment: comment_t, tabs: string = "", lastChar: string = "") {
  if (!comment.inline && ("inline" in comment)) { // block
    const longTab = tabs + getTabs(1);
    const content = comment.text.split("\n").map(line => longTab + line).join("\n");
    return `${tabs}/*\n${content}\n${tabs}*/`;
  }
  // inline
  let space = (lastChar == " " || lastChar == "\n") ? "" : " "; // only add in space if no whitespace before
  return comment.text.split("\n").map(line => `${tabs}${space}// ${line}`).join("\n");
}

function arrMatches(arr1: any[], arr2: any[]) {
  if (arr1.length != arr2.length) return false;
  return arr1.every((val, i) => val == arr2[i]);
}
