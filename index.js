keccak256 = require('js-sha3').keccak256;
const { readdirSync, writeFileSync, open, appendFileSync, readFileSync } = require('fs');

module.exports = async (config) => {
  const workingDir=config.working_directory;
  const args = config._;
  const contract = config.c;
  const createIndex = config.createIndex;
  const modify = config.modify;
  let functionCount = 0;
  let totalGasSaved = 0.0;
  let numberOfBytes; 
  if (config.b > 0 && config.b < 32){
    numberOfBytes = config.b;
  } else {
    numberOfBytes = 2;
  }
  const functions = args.slice(1,args.length);
  const contractsBuildDir = config.contracts_build_directory;
  let data = { blocks: [], s: [] };
  let CHARS = '0123456789abcdefghijklmnopqrstuvwxysABCDEFGHIJKLMNOPQRSTUVWXYS$_'.split('');
  let CHAR_CODE_MAP = {};
  CHARS.forEach((c, index) => {
    CHAR_CODE_MAP[index] = c.charCodeAt(0);
  });
  let availableContracts = [];
  let functionSignatures = [];

  const gatherFunctionsWithSignatures = (artifactPath, functionNames) => {
    let functionsArray = [];
    const artifact = require(artifactPath)
    artifact.abi.forEach(contractArtifact => {
      if (contractArtifact.type === 'function' && contractArtifact.stateMutability != 'view' && (functionNames.length === 0 || functionNames.length > 0 && functionNames.includes(contractArtifact.name) )){
        let types = contractArtifact.inputs.map(input => input.type);
        functionsArray.push([contractArtifact.name, `${contractArtifact.name}(${types})`])
      }
    })
    return functionsArray;
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


  const optimize = obj => {
    let sig = obj.name + obj.args;
    let args = toBytes(obj.args);
    let bytes = [0];
    let index = 0;
    let prefix = toBytes(obj.name + '_');
    let hash = keccak256.create();
    hash.update(prefix);
    save(hash);
    let char, methodId = keccak256.array(sig);

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
        sig = obj.name + '_' + toChars(bytes) + char + obj.args;
    }
    return [sig, keccak256(sig).substr(0, 8), 64*2];
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

  //get contract json
  const files = contract ? [contract] : readdirSync(contractsBuildDir);

  //ensure contract json has a contract in contracts directory 
  const contractFiles = readdirSync(`${workingDir}/contracts`);
  filteredFiles = files.filter(file => {
    return contractFiles.includes(file.replace('.json', '.sol'))
  })

  //gather valid contract info
  filteredFiles.forEach(contractName => {
    let contractObject = {
      name: contractName.replace(".json", ""), 
      artifactPath: `${contractsBuildDir}/${contractName}`,
      estimatedGasSavings: 0.0,
      functions: functions,
      functionCount: 0
    }
    availableContracts.push(contractObject)
  })

  console.log('\n\n///////////// GATHERING FUNCTIONS ////////////')
  //for each contract gather function info
  availableContracts.forEach(contract => {
    console.log(`\n${contract.name}...`)
    contract.functions = gatherFunctionsWithSignatures(contract.artifactPath, contract.functions);
    contract.functionCount = contract.functions.length;
    functionCount += contract.functionCount;
    contract.functions.forEach(func => {
      console.log(`\t${func[1]}`)
    })
  })

  //filter out contracts with no valid functions to optimize
  const contracts = availableContracts.filter((contract) => {
    if (contract && contract.functionCount > 0){
      return contract;
    }
  })

  console.log(`\n\n //////// WILL OPTIMIZE ${functionCount} FUNCTION(S) ACROSS ${contracts.length} CONTRACTS ////////\n\n`);

  let results = [];

  //for each contract, loop through valid functions and optimize
  contracts.forEach(contract => {
    console.log(`Optimizing contract ${contract.name}.... `);
    for (let i=0; i < contract.functions.length; i++){
      let sig = parseSignature(contract.functions[i][1]);
      result = optimize(sig);
      contract.functions[i][2] = result[0];
      contract.functions[i][3] = result[1];
      contract.functions[i][4] = result[2];
      contract.functions[i][5] = contract.name;
      contract.estimatedGasSavings += result[2];
      results.push(contract.functions[i]);
    }
    totalGasSaved += contract.estimatedGasSavings;

    console.log(`\tcontract savings: ${contract.estimatedGasSavings} wei`);
  })

  //if create index parameter is passed, create index file to add values to
  let newFile;
  if (createIndex){
    newFile = contractsBuildDir.replace("src/contracts","src/optimizedIndex.js");
  }
  
  console.log("\n\n\n///////////// RESULTS ////////////\n")
  //loop through final results to add to index, update contracts and display values
  results.forEach(result => {
    //add to index file if exists
    if (newFile){
      appendFileSync(newFile, `export const ${result[0]} = ${result[2].substring(0,result[2].indexOf("("))};\n`, ()=> console.log('saved to file'))
    }

    // if modify parameter is passed, find function names in contract and update them 
    // if(modify){
    //   let new_contents ="";
    //   let stringToReplace=`function[ \t]+${result[0]}\\(`;
    //   var re = new RegExp(stringToReplace,"g");
    //   try {
    //     const file_contents = readFileSync(`${workingDir}/contracts/${result[5]}.sol`, 'utf8')
    //     new_contents = file_contents.replace(re, `function ${result[2]}`);
    //     console.log('done in here', new_contents)
    //     // writeFileSync(`${workingDir}/contracts/${result[5]}.sol`, new_contents);
    //   } catch(e){
    //     console.log(e);
    //   }
    // }

    console.log(`${result[1]} >> ${result[2]}`)
  })
  
  console.log(`\n\n////////// TOTAL GAS SAVINGS: ${totalGasSaved} WEI //////////\n`);

}