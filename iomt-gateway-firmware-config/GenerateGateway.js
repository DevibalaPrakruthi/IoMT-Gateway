const AWS = require('aws-sdk');
const path = require('path');
// const constants = require('./constants');
const aws_config_path = path.join(__dirname, '..', 'credentials', 'aws-sdk', 'config.json');
AWS.config.loadFromPath(aws_config_path);
const fs = require('fs');
const config = JSON.parse(String(fs.readFileSync(aws_config_path)));
// let iot = new AWS.Iot(config);
const constants = require('./constants');

const endpoint = config.endpoint;
var iot = new AWS.Iot();
var iotdata = new AWS.IotData({ endpoint: endpoint });
let dynamodb = new AWS.DynamoDB.DocumentClient({
    region: 'us-east-2',
});

const topic = "registration";
const type = "Gateway"

function newThing() {
    const dynamoParams = {
        TableName: constants.gatewayRegistryTableName,
        KeyConditionExpression: "#thingType = :type",
        ExpressionAttributeNames: {
            "#thingType": "type"
        },
        ExpressionAttributeValues: {
            ":type": type
        },
        Select: "COUNT"
    };
    // Get the number of gateways in the catalog so we can assign the incremented thingName
    dynamodb.query(dynamoParams, function (err, data) {
        if (err) console.log("DynamoDB error: " + err.stack);
        else {
            var serialNumber = `SN-${crypto.randomBytes(Math.ceil(12 / 2)).toString('hex').slice(0, 15).toUpperCase()}`;
            var activationCode = `AC-${crypto.randomBytes(Math.ceil(20 / 2)).toString('hex').slice(0, 20).toUpperCase()}`;
            var thing = `IoMT_Gateway_${data.Count + 1}`;
            var thingParams = {
                thingName: thing
            };

            iot.createThing(thingParams).on('success', function (response) {
                //Thing Created!
            }).on('error', function (response) {
                console.log(response);
            }).send();

            //Publish JSON to Registration Topic

            var registrationData = `{\n \"serialNumber\": \"${serialNumber}\",\n \"device\": \"${thing}\",\n \"endpoint\": \"${endpoint}\",\n\"type\": \"${type}\",\n \"activationCode\": \"${activationCode}\",\n \"activated\": \"false\",\n \"uuid\": \"Not registered yet\" \n}`;

            var registrationParams = {
                topic: topic,
                payload: registrationData,
                qos: 0
            };

            iotdata.publish(registrationParams, function (err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                // else Published Successfully!
            });

            //Checking all devices were created

            iot.listThings().on('success', function (response) {
                var things = response.data.things;
                var myThings = [];
                for (var i = 0; i < things.length; i++) {
                    if (things[i].thingName.includes("myThing")) {
                        myThings[i] = things[i].thingName;
                    }
                }

                if (myThings.length = 50) {
                    console.log("myThing1 to 50 created and registered!");
                }
            }).on('error', function (response) {
                console.log(response);
            }).send();

            console.log("Registration data on the way to Lambda and DynamoDB");
        }
    });    
}

function getNewApiKey() {
    // AWS.APIGateway.
}