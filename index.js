keccak256 = require('js-sha3').keccak256;
const { readdirSync } = require('fs');

module.exports = async (config) => {
  const args = config._;
  const contract = config.c;
  const numberOfBytes = config.b || 2 ;
  const functions = args.slice(1,args.length);
  const contractsBuildDir = config.contracts_build_directory;
  let data = { blocks: [], s: [] };
  let CHARS = '0123456789abcdefghijklmnopqrstuvwxysABCDEFGHIJKLMNOPQRSTUVWXYS$_'.split('');
  let CHAR_CODE_MAP = {};
  CHARS.forEach((c, index) => {
    CHAR_CODE_MAP[index] = c.charCodeAt(0);
  });
  let functionSignatures = [];

  const gatherSignatures = (buildDir, contractName) => {
    const artifactPath = `${buildDir}/${contractName}`
    const artifact = require(artifactPath)
    artifact.abi.forEach(contractArtifact => {
      if (contractArtifact.type === 'function' && contractArtifact.stateMutability != 'view'){
        let types = contractArtifact.inputs.map(input => input.type);
        functionSignatures.push(`${contractArtifact.name}(${types})`)
      }
    })
  }

  const selectSignatures = (buildDir, contractName, functionNames) => {
    const artifactPath = `${buildDir}/${contractName}`
    const artifact = require(artifactPath)
    artifact.abi.forEach(contractArtifact => {
      if (contractArtifact.type === 'function' && contractArtifact.stateMutability != 'view' && functionNames.includes(contractArtifact.name)){
        let types = contractArtifact.inputs.map(input => input.type);
        functionSignatures.push(`${contractArtifact.name}(${types})`)
      }
    })
  }

  const parseSignature = signature => {
    if (signature.charAt(signature.length - 1) != ')' || signature.indexOf(' ') !== -1) {
        return false;
    }
    let parts = signature.split('(');
    if (parts.length == 2) {
        return {
        name: parts[0],
        args: '(' + parts[1]
        };
    } else {
        return false;
    }
  }


  const find = obj => {
    let orig_sig = obj.name + obj.args
    let sig = obj.name + obj.args;
    let args = toBytes(obj.args);
    let bytes = [0];
    let index = 0;
    let prefix = toBytes(obj.name + '_');
    let hash = keccak256.create();
    hash.update(prefix);
    save(hash);
    let char, methodId = keccak256.array(sig);
    
    while (methodId[0]|| methodId[1]) {
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
        sig = obj.name + '_' + toChars(bytes) + char + obj.args;
    }
    return [orig_sig, sig, keccak256(sig).substr(0, 8)];
  }

  const toBytes = str => {
    let bytes = [];
    for (let i = 0; i < str.length; ++i) {
        bytes.push(str.charCodeAt(i));
    }
    return bytes;
  }

  const toChars = bytes => {
    let str = '';
    for (let i = 0; i < bytes.length; ++i) {
        str += CHARS[bytes[i]];
    }
    return str;
  }

  const toCharCodes = bytes => {
    let codes = [];
    for (let i = 0; i < bytes.length; ++i) {
        codes.push(CHAR_CODE_MAP[bytes[i]]);
    }
    return codes;
  }

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
  }

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
  }

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
  }

/////

if (contract) {
  if (functions && functions.length > 0 ){
    selectSignatures(contractsBuildDir, contract, functions)
  } else {
    gatherSignatures(contractsBuildDir, contract)
  }

  console.log(`will run ${functionSignatures.length} functions from ${contract} contract`)
} else { 
  const files = readdirSync(contractsBuildDir);
  files.forEach(contractName => {
    gatherSignatures(contractsBuildDir, contractName)
  })
  console.log(`will run ${functionSignatures.length} functions across ${files.length} contracts`)
}

  let suggestions = [];
  for (let i=0; i < functionSignatures.length; i++){
    let a = parseSignature(functionSignatures[i]);
    result = find(a);
    suggestions.push(result)
  }

  console.log(suggestions)
}