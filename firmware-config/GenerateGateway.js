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
const type = constants.gatewayThingType;
const gateway_files_dir = path.join(__dirname, 'gateway');
const credentials_dir = "credentials";
const gateway_credentials_dir = path.join(gateway_files_dir, credentials_dir)
const iot_sdk_credentials_dir = path.join(__dirname, credentials_dir, "aws-iot-sdk");
const iot_sdk_credentials_filename = 'credentials.json';
const private_key_filename = 'privateKey.pem.key';
const public_key_filename = 'publicKey.pem.key';
const certificate_filename = 'certificate.pem.crt';
const root_ca_filename = 'VeriSign-Class 3-Public-Primary-Certification-Authority-G5.pem';
// const iot_sdk_config_path = path.join(iot_sdk_credentials_dir,'config.json');

function newThing() {
    const dynamoParams = {
        TableName: constants.gatewayRegistryTableName,
        IndexName: constants.gatewayRegistryIndexName,
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

            credentials.new({ thingName: thingName }, function (err, data) {
                // Add success callback code here.
                if (!err) {
                    console.log("New IoMT credentials:", data);
                    if (!fs.existsSync(gateway_files_dir)) {
                        fs.mkdirSync(gateway_files_dir);
                        fs.mkdirSync(gateway_credentials_dir);
                    }

                    fs.writeFileSync(path.join(gateway_credentials_dir, iot_sdk_credentials_filename), JSON.stringify(data));
                    fs.writeFileSync(path.join(gateway_credentials_dir, private_key_filename), data.keyPair.PrivateKey);
                    fs.writeFileSync(path.join(gateway_credentials_dir, public_key_filename), data.keyPair.PublicKey);
                    fs.writeFileSync(path.join(gateway_credentials_dir, certificate_filename), data.certificatePem);
                    const gateway_root_ca_path = path.join(gateway_credentials_dir, root_ca_filename);
                    if (!fs.existsSync(gateway_root_ca_path)) {
                        fs.createReadStream(path.join(iot_sdk_credentials_dir, root_ca_filename)).pipe(fs.createWriteStream(gateway_root_ca_path));
                    }
                    const certificateId = data.certificateId;
                    console.log("New IoMT credentials written to filesystem");

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

                    const registrationParams = {
                        topic: topic,
                        payload: JSON.stringify(registrationData),
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



            //Checking all devices were created

            iot.listThings().on('success', function (response) {
                var things = response.data.things;
                // var myThings = [];
                for (var i = 0; i < things.length; i++) {
                    if (things[i].thingName === thingName) {
                        // myThings[i] = things[i].thingName;
                        console.log(`${things[i].thingName} is registered!`);
                    }
                }

                // if (myThings.length = 50) {
                //     console.log("myThing1 to 50 created and registered!");
                // }
            }).on('error', function (response) {
                console.log(response);
            }).send();

            console.log("Registration data on the way to Lambda and DynamoDB");
        }
    });
}

// function getNewApiKey() {
//     // AWS.APIGateway.
// }
newThing();