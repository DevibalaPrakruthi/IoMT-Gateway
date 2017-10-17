const AWS = require('aws-sdk');
const path = require('path');
const crypto = require('crypto');
// const constants = require('./constants');
const aws_config_path = path.join(__dirname, 'credentials', 'aws-sdk', 'awsConfig.json');
const action_config_path = path.join(__dirname, 'credentials', 'aws-sdk', 'actionConfig.json');
AWS.config.loadFromPath(aws_config_path);
const fs = require('fs');
const action_config = JSON.parse(String(fs.readFileSync(action_config_path)));
// let iot = new AWS.Iot(config);
const constants = require('./constants');
const credentials = require('./credentials');

// const endpoint = config.endpoint;
var iot = new AWS.Iot({
    endpoint: action_config.iotSdkEndpoint,
    region: action_config.region
});
var iotdata = new AWS.IotData({
    endpoint: action_config.iotEndpoint,
    region: action_config.region
});
let dynamodb = new AWS.DynamoDB.DocumentClient({
    endpoint: action_config.dynamodbEndpoint,
    region: action_config.region
});

const topic = constants.registrationTopic;
const type = constants.type;
const gateway_files_dir = path.join(__dirname, 'gateway');
const gateway_credentials_dir = path.join(gateway_files_dir, 'credentials')
const iot_sdk_credentials_dir = path.join(__dirname, 'credentials', "aws-iot-sdk");
const iot_sdk_credentials_filename = 'credentials.json';
const private_key_filename = 'privateKey.pem.key';
const public_key_filename = 'publicKey.pem.key';
const certificate_filename = 'certificate.pem.crt';
const root_ca_filename = 'VeriSign-Class 3-Public-Primary-Certification-Authority-G5.pem';
const thing_config_filename = 'thingConfig.json';
const thing_policy_filename = 'thingPolicy.json'
// const iot_sdk_config_path = path.join(iot_sdk_credentials_dir,'config.json');

function newThing() {
    const dynamoParams = {
        TableName: constants.registryTableName,
        IndexName: constants.registryIndexName,
        KeyConditionExpression: "#primaryIndex = :p",
        ExpressionAttributeNames: {
            "#primaryIndex": "type",
        },
        ExpressionAttributeValues: {
            ":p": type
        },
        ScanIndexForward: false,
        Limit: 1
    };
    // Get the number of gateways in the catalog so we can assign the incremented thingName
    dynamodb.query(dynamoParams, function (err, data) {
        if (err) console.log("DynamoDB error: " + err.stack);
        else {
            const last_thing = data.Items.length ? data.Items[0] : {};
            const serialNumber = `SN-${crypto.randomBytes(Math.ceil(12 / 2)).toString('hex').slice(0, 15).toUpperCase()}`;
            const activationCode = `AC-${crypto.randomBytes(Math.ceil(20 / 2)).toString('hex').slice(0, 20).toUpperCase()}`;
            const thingNumber = "thingNumber" in last_thing ? last_thing.thingNumber + 1 : 1;
            const thingName = `${type}_${thingNumber}`;
            const thingParams = {
                thingName: thingName,
                thingTypeName: type
            };

            iot.createThing(thingParams).on('success', function (response) {
                //Thing Created!
            }).on('error', function (response) {
                console.log("createThing error:", response);
            }).send();

            credentials.new({ thingName: thingName, thingNumber: thingNumber }, function (err, data) {
                // Add success callback code here.
                if (!err) {
                    const credentials = data.credentials;
                    const policy = data.policy;
                    console.log("New IoMT credentials:", credentials);
                    if (!fs.existsSync(gateway_files_dir)) {
                        fs.mkdirSync(gateway_files_dir);
                        fs.mkdirSync(gateway_credentials_dir);
                    }

                    fs.writeFile(path.join(gateway_credentials_dir, iot_sdk_credentials_filename), JSON.stringify(credentials), function (err) {
                        if (err) console.log(`Error writing '${iot_sdk_credentials_filename}' to filesystem`);
                    });
                    fs.writeFile(path.join(gateway_credentials_dir, private_key_filename), credentials.keyPair.PrivateKey, function (err) {
                        if (err) console.log(`Error writing '${private_key_filename}' to filesystem`);
                    });
                    fs.writeFile(path.join(gateway_credentials_dir, public_key_filename), credentials.keyPair.PublicKey, function (err) {
                        if (err) console.log(`Error writing '${public_key_filename}' to filesystem`);
                    });
                    fs.writeFile(path.join(gateway_credentials_dir, certificate_filename), credentials.certificatePem, function (err) {
                        if (err) console.log(`Error writing '${certificate_filename}' to filesystem`);
                    });
                    const gateway_root_ca_path = path.join(gateway_credentials_dir, root_ca_filename);
                    if (!fs.existsSync(gateway_root_ca_path)) {
                        fs.createReadStream(path.join(iot_sdk_credentials_dir, root_ca_filename)).pipe(fs.createWriteStream(gateway_root_ca_path));
                    }
                    const certificateId = credentials.certificateId;

                    //Publish JSON to Registration Topic

                    const registrationData = {
                        serialNumber: serialNumber,
                        clientId: constants.fallStudyGatewayClientId,
                        activationCode: activationCode,
                        activated: false,
                        activatedBy: "not@activated.yet",
                        certificateId: certificateId,
                        endpoint: action_config.iotEndpoint,
                        thingName: thingName,
                        thingNumber: thingNumber,
                        type: type,
                        team: constants.team,
                        study: constants.study
                    };
                    const registrationDataString = JSON.stringify(registrationData);
                    fs.writeFile(path.join(gateway_files_dir, thing_config_filename), registrationDataString, function (err) {
                        if (err) console.log(`Error writing '${thing_config_filename}' to filesystem`);
                    });
                    fs.writeFile(path.join(gateway_files_dir, thing_policy_filename), JSON.stringify(policy), function (err) {
                        if (err) console.log(`Error writing '${thing_policy_filename}' to filesystem`);
                    });

                    const registrationParams = {
                        topic: topic,
                        payload: registrationDataString,
                        qos: 0
                    };

                    iotdata.publish(registrationParams, function (err, data) {
                        if (err) console.log("IoTData error:", err, err.stack); // an error occurred
                        // else Published Successfully!
                    });
                } else {
                    console.log("new credentials error:", err, err.stack);
                }
            });

            console.log("Registration data on the way to Lambda and DynamoDB");
        }
    });
}

// function getNewApiKey() {
//     // AWS.APIGateway.
// }
newThing();