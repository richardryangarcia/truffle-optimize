const {
  readdirSync,
  appendFileSync,
  readFileSync,
  writeFileSync
} = require("fs");
const optimizeFile = require("./optimize");
const {
  oneChar,
  twoChar,
  threeChar,
  fourChar,
  fiveChar,
  sixChar
} = optimizeFile;

const gatherFunctionsWithSignatures = (
  artifactPath,
  functionNames,
  contractPath
) => {
  let functionsArray = [];
  const artifact = require(artifactPath);
  artifact.abi.forEach(contractArtifact => {
    if (
      contractArtifact.type === "function" &&
      contractArtifact.stateMutability != "view" &&
      (functionNames.length === 0 ||
        (functionNames.length > 0 &&
          functionNames.includes(contractArtifact.name)))
    ) {
      const f_contents = readFileSync(contractPath);
      let stringToMatch = `function[ \t]+${contractArtifact.name}\\(`;
      //check if function is contracts directory to avoid altering anything in node modules
      if (new RegExp(stringToMatch).test(f_contents)) {
        let types = contractArtifact.inputs.map(input => input.type);
        functionsArray.push([
          contractArtifact.name,
          `${contractArtifact.name}(${types})`
        ]);
      }
    }
  });
  return functionsArray;
};

const parseSignature = signature => {
  if (
    signature.charAt(signature.length - 1) != ")" ||
    signature.indexOf(" ") !== -1
  ) {
    return false;
  }
  let parts = signature.split("(");
  if (parts.length == 2) {
    return {
      name: parts[0],
      args: "(" + parts[1]
    };
  } else {
    return false;
  }
};

const updateFunctionInContract = (result, workingDir) => {
  let new_contents = "";
  let stringToReplace = `function[ \t]+${result[0]}\\(`;
  let stringWithLeadingSpace = new RegExp(stringToReplace, "g");
  try {
    const file_contents = readFileSync(
      `${workingDir}/contracts/${result[5]}.sol`,
      "utf8"
    );
    new_contents = file_contents.replace(
      stringWithLeadingSpace,
      `function ${result[2].substring(0, result[2].indexOf("("))}(`
    );
    writeFileSync(`${workingDir}/contracts/${result[5]}.sol`, new_contents);
  } catch (e) {
    console.log(e);
  }
};

module.exports = async config => {
  const workingDir = config.working_directory;
  const args = config._;
  const contract = config.c;
  const numberOfBytes = config.b;
  const modify = config.modify;
  const functions = args.slice(1, args.length);
  const contractsBuildDir = config.contracts_build_directory;
  const files = contract ? [contract] : readdirSync(contractsBuildDir); //get contracts json files to be optimized
  const contractFiles = readdirSync(`${workingDir}/contracts`); //ensure there's a contract in the contract directory
  let functionCount = 0;
  let totalGasSaved = 0.0;
  let availableContracts = [];

  filteredFiles = files.filter(file => {
    let fileName = file.replace(".json", "");
    return contractFiles.includes(`${fileName}.sol`);
  });

  //gather valid contract info
  filteredFiles.forEach(contractName => {
    let contractObject = {
      name: contractName.replace(".json", ""),
      artifactPath: `${contractsBuildDir}/${contractName}`,
      contractPath: `${workingDir}/contracts/${contractName.replace(
        ".json",
        ""
      )}.sol`,
      estimatedGasSavings: 0.0,
      functions: functions,
      functionCount: 0
    };
    availableContracts.push(contractObject);
  });

  console.log("\n\n///////////// GATHERING FUNCTIONS ////////////");
  //for each valid contract gather function info
  availableContracts.forEach(contract => {
    console.log(`\n${contract.name}...`);
    contract.functions = gatherFunctionsWithSignatures(
      contract.artifactPath,
      contract.functions,
      contract.contractPath
    );
    contract.functionCount = contract.functions.length;
    functionCount += contract.functionCount;
    contract.functions.forEach(func => {
      console.log(`\t${func[1]}`);
    });
  });

  //filter out contracts with no valid functions to optimize
  const contracts = availableContracts.filter(contract => {
    if (contract && contract.functionCount > 0) {
      return contract;
    }
  });

  console.log(
    `\n\n //////// WILL OPTIMIZE ${functionCount} FUNCTION(S) ACROSS ${contracts.length} CONTRACTS ////////\n\n`
  );

  let results = [];

  //for each contract, loop through valid functions and optimize
  contracts.forEach(contract => {
    console.log(`Optimizing contract ${contract.name}.... `);
    for (let i = 0; i < contract.functions.length; i++) {
      let sig = parseSignature(contract.functions[i][1]);
      switch (numberOfBytes) {
        case 1:
          result = oneChar(sig);
          break;
        case 3:
          result = threeChar(sig);
          break;
        case 4:
          result = fourChar(sig);
          break;
        case 5:
          result = fiveChar(sig);
          break;
        case 6:
          result = sixChar(sig);
          break;
        default:
          result = twoChar(sig);
      }
      // result = optimize(sig, numberOfBytes);
      contract.functions[i][2] = result[0];
      contract.functions[i][3] = result[1];
      contract.functions[i][4] = result[2];
      contract.functions[i][5] = contract.name;
      contract.estimatedGasSavings += result[2];
      results.push(contract.functions[i]);
    }
    totalGasSaved += contract.estimatedGasSavings;

    console.log(`\tcontract savings: ${contract.estimatedGasSavings} wei`);
  });

  //create index file
  let newFile = contractsBuildDir.replace(
    "src/contracts",
    "src/optimizedIndex.js"
  );

  console.log("\n\n\n///////////// RESULTS ////////////\n");
  //loop through final results to add to index, update contracts and display values
  results.forEach(result => {
    //add to index file
    appendFileSync(
      newFile,
      `export const ${result[0]} = \"${result[2].substring(
        0,
        result[2].indexOf("(")
      )}\";\n`,
      () => console.log("saved to file")
    );

    if (modify) {
      updateFunctionInContract(result, workingDir);
    }

    console.log(`${result[1]} >> ${result[2]}`);
  });

  console.log(
    `\n\n////////// TOTAL GAS SAVINGS: ${totalGasSaved} WEI //////////\n`
  );
};
