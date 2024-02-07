# JSONC+

## This repository gives an easy way of creating JSONC+ files

JSONC+ stands for:
* (**J**)ava(**S**)cript
* (**O**)bject
* (**N**)otation
* with (**C**)omments
* (**+**) some extra features

This is standard JSON, with standard JS-valid comments:
// this is an inline comment
/*
  This is a block comment
  I and exist on multiple lines!
*/

JSONC+ allows comments to be injected into an object being `stringified`, and to extract comments when `parsing` an object

## API
JSONC+ exposes 3 simple functions:
* `parse(text)`
* `parseAll(text)`
* `stringify(object, comments)`

### `parse(text)`
 This takes in a string, and returns a valid JavaScript object from the string. This functions the same way as JSON.parse(), but resolves references and ignores comments

### `parseAll(text)`
  This takes in a string, and returns an object containing the parsed JavaScript object (with resolved references), and an array of all the comments
  Specifically, this returns:
  ```
    {
      "object": ...
      "comments": [...]
    }
  ```

### `stringify(object, comments)`
  This takes in an object (which may include circular references), and an optional array of comments, then returns a JSONC+ string representing that data.

## Comments
To add a JSONC+ comment into a string, or read the comment of an object, you must understand the format that comments are stored in.
```
  var comment = {
    text: "Text content",
    reference: ["key","subkey"],
    inline: true
  };
```
`comment.text` is the text to be in the comment. This *can* contain new liens.
`comment.reference` is an array of the subkeys that inform the comment to what it is attached. (In this example, given `object`, this comment refers to `object.key.subkey`)
`comment.inline` is an optional value. If set to true or omitted, the comment is treated as inline/inline-multiline. Otherwise, it is treated as a block comment

## The + in JSONC+
JSONC+ adds the ability to have circular references, that is, if writing the following:
```
  var object = {
    "key": {
      "sub-key": {}
    }
  };
  object.key["sub-key"] = object;
```

With standard JSON/JSONC, the following error would be triggered: `Uncaught TypeError: Converting circular structure to JSON`, because sub-key's content is one of its ancestors (ie: it contains itself).
JSONC+ removes this problem with the reference type, denoted as `*` followed by a standard JSON `stringified` array, containing the sub-keys to get to the referenced location.

In this scenario, the JSONC+ output would be:
```
  `{
    "key": {
      "sub-key": *[]
    }
  }`
```
The reference, in this case, is `*[]`-- `sub-key` refers to the root node, so there are no sub keys.

If a reference refers to a non-root node:
```
  var object = {
    "key": {
      "sub-key": {
        "sub-sub-key": {}
      }
    }
  };
  object.key["sub-key"]["sub-sub-key] = object.key["sub-key"]; // here, sub-sub-key points to sub-key (its parent)
```
The generated JSONC+ would be:
```
  `{
    "key": {
      "sub-key": {
        "sub-sub-key": *["key","sub-key"]
      }
    }
  }`
```

# Better Comments in JSONC+
JSONC+ recognizes 3 types of comments:

1. Inline Comments
  These are comments written as `// Comment goes here!`
  These comments will appear next to the node they reference
  ```
      var object = {
      "x": 100,
      "y": 200,
      "z": {
        "key": "value"
      }
    };

    var zComment = {
      text: "This is an inline comment for the \"z\" key",
      reference: ["z"] // NOTE: this is the same format as references--an array of sub-keys
    };

    console.log(JSONC.stringify(object, [zComment]));
  ```
  The output of the above code will be:
  ```
    `{
      "x": 100,
      "y": 200,
      "z": { // This is an inline comment for the "z" key
        "key": "value"
      }
    }`
  ```
2. Multiline Inline Comments
  These are the same as inline comments, but with multiple lines.
  These are shown above the key they reference
  ```
    var object = {
      "x": 100,
      "y": 200,
      "z": {
        "key": "value"
      }
    };

    var zComment = {
      text: "This is an inline comment for the \"z\" key\nWith another line added on!",
      reference: ["z"]
    };

    console.log(JSONC.stringify(object, [zComment]));
  ```
  The output of the above code will be:
  ```
    `{
      "x": 100,
      "y": 200,
      // This is an inline comment for the "z" key
      // With another line added on!
      "z": {
        "key": "value"
      }
    }`
  ```
3. Block Comments
  These are comments formed between a `/*` and `*/`, and are generally used for longer multiline comments.
  These are put in the same places as multiline inline comments.
  ```
    var object = {
      "x": 100,
      "y": 200,
      "z": {
        "key": "value"
      }
    };

    var zComment = {
      text: "This is an inline comment for the \"z\" key",
      reference: ["z"],
      inline: false
    };

    console.log(JSONC.stringify(object, [zComment]));
  ```
  The output of the above code will be:
  ```
    `{
      "x": 100,
      "y": 200,
      /*
        This is an inline comment for the "z" key
        With another line added on!
      */
      "z": {
        "key": "value"
      }
    }`
  ```

When parsing, JSONC+ remembers the type of comment used. As such, a string can be read, modified, then reconstructed--all while maintaining the comments