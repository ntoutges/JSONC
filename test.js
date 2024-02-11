const JSONC = require("./src/jsonc.js");

// const toStringify = {
//   1: {
//     2: {
//       3: {
//         4: 5
//       },
//       5: 6
//     },
//     7:8,
//     9:10
//   }
// }

// const comment = {
//   text: "test of block comments 2",
//   inline: false,
//   reference: []
// }
// const comment2 = {
//   text: "test of inline comments\nand another line?",
//   inline: true,
//   reference: ["1", "2", "3"]
// }

// toStringify.selfRef = toStringify;
// toStringify.selfRef2 = { selfRef21: { selfRef22: {} } };
// toStringify.selfRef2.selfRef21.selfRef22 = toStringify.selfRef2;
// toStringify.selfRef2.selfRef3 = toStringify.selfRef2.selfRef21

// console.log(JSONC.stringify(toStringify, [comment, comment2]))

const text = `/*
    test
    of
    multiline
*/
/*
test of block comments 2
*/
{
"1": {
  "2": {
    // test of inline comments
    // and another line?
    "3": {
      "4": 5
    },
    "5": 6
  },
  "7": 8,
  "9": 10
},
"selfRef": *[]
"selfRef2": {
  "selfRef21": {
    "selfRef22": *["selfRef2"],
    "3 cycle": {
      "ref": *["selfRef2"]
    }
  },
  "selfRef3": *["selfRef2","selfRef21"]
}
}`;

// const text = `{
//   "ref": {
//     "ref2": {
//       "ref3": *["ref"]
//     },
//     "ref3": *["ref","ref2"]
//   }
// }`

// const text = `{"c":{"1":{"2":3,"4":"4"},"4":[5,6],"5":[]}}`
// const text = `// undefined comment
// {
//   "x": [ // 'x' comment
//     // does this properly comment 1?
//     1,
//     2,
//     3 // test of 3
//   ],
//   "y": {
//     "z": 2n
//   }
// }

// // what does this do?`;

// const {object, comments} = JSONC.parse(text);
const object = JSONC.parse(text);
console.log(JSONC.stringify(object));
