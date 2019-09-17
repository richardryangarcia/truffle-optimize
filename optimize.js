keccak256 = require("js-sha3").keccak256;

let data = { blocks: [], s: [] };
let CHARS = "0123456789abcdefghijklmnopqrstuvwxysABCDEFGHIJKLMNOPQRSTUVWXYS$_".split(
  ""
);
let CHAR_CODE_MAP = {};
CHARS.forEach((c, index) => {
  CHAR_CODE_MAP[index] = c.charCodeAt(0);
});

const toBytes = str => {
  let bytes = [];
  for (let i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }
  return bytes;
};

const toChars = bytes => {
  let str = "";
  for (let i = 0; i < bytes.length; ++i) {
    str += CHARS[bytes[i]];
  }
  return str;
};

const toCharCodes = bytes => {
  let codes = [];
  for (let i = 0; i < bytes.length; ++i) {
    codes.push(CHAR_CODE_MAP[bytes[i]]);
  }
  return codes;
};

const save = hash => {
  data.reset = hash.reset;
  data.block = hash.block;
  data.start = hash.start;
  data.finalized = hash.finalized;
  data.lastByteIndex = hash.lastByteIndex;
  for (let i = 0; i < hash.blocks.length; ++i) {
    data.blocks[i] = hash.blocks[i];
  }
  for (let i = 0; i < hash.s.length; ++i) {
    data.s[i] = hash.s[i];
  }
};

const restore = hash => {
  hash.reset = data.reset;
  hash.block = data.block;
  hash.start = data.start;
  hash.finalized = data.finalized;
  hash.lastByteIndex = data.lastByteIndex;
  for (let i = 0; i < data.blocks.length; ++i) {
    hash.blocks[i] = data.blocks[i];
  }
  for (let i = 0; i < data.s.length; ++i) {
    hash.s[i] = data.s[i];
  }
};

const increase = bytes => {
  bytes[0] += 1;
  for (let i = 0; i < bytes.length; ++i) {
    if (bytes[i] === 64) {
      bytes[i] = 0;
      if (i == bytes.length - 1) {
        bytes[i + 1] = 1;
      } else {
        bytes[i + 1] += 1;
      }
    } else {
      break;
    }
  }
  return bytes;
};

module.exports = {
  oneChar: obj => {
    let sig = obj.name + obj.args;
    let args = toBytes(obj.args);
    let bytes = [0];
    let index = 0;
    let prefix = toBytes(obj.name + "_");
    let hash = keccak256.create();
    hash.update(prefix);
    save(hash);

    let char,
      methodId = keccak256.array(sig);

    while (methodId[0]) {
      if (index >= CHARS.length) {
        increase(bytes);
        hash = keccak256.create();
        hash.update(prefix);
        hash.update(toCharCodes(bytes));
        save(hash);
        index = 0;
      }
      char = CHARS[index];
      hash.update(char);
      hash.update(args);
      methodId = hash.array();
      restore(hash);
      ++index;
    }
    if (index) {
      sig = obj.name + "_" + toChars(bytes) + char + obj.args;
    }
    return [sig, keccak256(sig).substr(0, 8), 64 * 1];
  },

  twoChar: obj => {
    let sig = obj.name + obj.args;
    let args = toBytes(obj.args);
    let bytes = [0];
    let index = 0;
    let prefix = toBytes(obj.name + "_");
    let hash = keccak256.create();
    hash.update(prefix);
    save(hash);

    let char,
      methodId = keccak256.array(sig);

    while (methodId[0] || methodId[1]) {
      if (index >= CHARS.length) {
        increase(bytes);
        hash = keccak256.create();
        hash.update(prefix);
        hash.update(toCharCodes(bytes));
        save(hash);
        index = 0;
      }
      char = CHARS[index];
      hash.update(char);
      hash.update(args);
      methodId = hash.array();
      restore(hash);
      ++index;
    }
    if (index) {
      sig = obj.name + "_" + toChars(bytes) + char + obj.args;
    }
    return [sig, keccak256(sig).substr(0, 8), 64 * 2];
  },
  threeChar: obj => {
    let sig = obj.name + obj.args;
    let args = toBytes(obj.args);
    let bytes = [0];
    let index = 0;
    let prefix = toBytes(obj.name + "_");
    let hash = keccak256.create();
    hash.update(prefix);
    save(hash);

    let char,
      methodId = keccak256.array(sig);

    while (methodId[0] || methodId[1] || methodId[2]) {
      if (index >= CHARS.length) {
        increase(bytes);
        hash = keccak256.create();
        hash.update(prefix);
        hash.update(toCharCodes(bytes));
        save(hash);
        index = 0;
      }
      char = CHARS[index];
      hash.update(char);
      hash.update(args);
      methodId = hash.array();
      restore(hash);
      ++index;
    }
    if (index) {
      sig = obj.name + "_" + toChars(bytes) + char + obj.args;
    }
    return [sig, keccak256(sig).substr(0, 8), 64 * 3];
  },
  fourChar: obj => {
    let sig = obj.name + obj.args;
    let args = toBytes(obj.args);
    let bytes = [0];
    let index = 0;
    let prefix = toBytes(obj.name + "_");
    let hash = keccak256.create();
    hash.update(prefix);
    save(hash);

    let char,
      methodId = keccak256.array(sig);

    while (methodId[0] || methodId[1] || methodId[2] || methodId[3]) {
      if (index >= CHARS.length) {
        increase(bytes);
        hash = keccak256.create();
        hash.update(prefix);
        hash.update(toCharCodes(bytes));
        save(hash);
        index = 0;
      }
      char = CHARS[index];
      hash.update(char);
      hash.update(args);
      methodId = hash.array();
      restore(hash);
      ++index;
    }
    if (index) {
      sig = obj.name + "_" + toChars(bytes) + char + obj.args;
    }
    return [sig, keccak256(sig).substr(0, 8), 64 * 4];
  },
  fiveChar: obj => {
    let sig = obj.name + obj.args;
    let args = toBytes(obj.args);
    let bytes = [0];
    let index = 0;
    let prefix = toBytes(obj.name + "_");
    let hash = keccak256.create();
    hash.update(prefix);
    save(hash);

    let char,
      methodId = keccak256.array(sig);

    while (
      methodId[0] ||
      methodId[1] ||
      methodId[2] ||
      methodId[3] ||
      methodId[4]
    ) {
      if (index >= CHARS.length) {
        increase(bytes);
        hash = keccak256.create();
        hash.update(prefix);
        hash.update(toCharCodes(bytes));
        save(hash);
        index = 0;
      }
      char = CHARS[index];
      hash.update(char);
      hash.update(args);
      methodId = hash.array();
      restore(hash);
      ++index;
    }
    if (index) {
      sig = obj.name + "_" + toChars(bytes) + char + obj.args;
    }
    return [sig, keccak256(sig).substr(0, 8), 64 * 5];
  },
  sixChar: obj => {
    let sig = obj.name + obj.args;
    let args = toBytes(obj.args);
    let bytes = [0];
    let index = 0;
    let prefix = toBytes(obj.name + "_");
    let hash = keccak256.create();
    hash.update(prefix);
    save(hash);

    let char,
      methodId = keccak256.array(sig);

    while (
      methodId[0] ||
      methodId[1] ||
      methodId[2] ||
      methodId[3] ||
      methodId[4] ||
      methodId[5]
    ) {
      if (index >= CHARS.length) {
        increase(bytes);
        hash = keccak256.create();
        hash.update(prefix);
        hash.update(toCharCodes(bytes));
        save(hash);
        index = 0;
      }
      char = CHARS[index];
      hash.update(char);
      hash.update(args);
      methodId = hash.array();
      restore(hash);
      ++index;
    }
    if (index) {
      sig = obj.name + "_" + toChars(bytes) + char + obj.args;
    }
    return [sig, keccak256(sig).substr(0, 8), 64 * 6];
  }
};
