console.log('Loading function');
const constants = require('./constants');
const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const table = constants.gatewayRegistryTableName;

exports.handler = function (event, context) {
    //console.log('Received event:', JSON.stringify(event, null, 2));
    const params = {
        TableName: table,
        Item: {
            "serialNumber": event.serialNumber,
            "clientId": event.clientId,
            "activationCode": event.activationCode,
            "activated": event.activated,
            "certificateId": event.certificateId,
            "endpoint": event.endpoint,
            "thingName": event.thingName,
            "thingNumber": event.thingNumber,
            "type": event.type,
            "team": event.team,
            "study": event.study,
            "activatedBy": event.activatedBy
        }
    };

    console.log("Adding a new IoT device...");
    dynamo.put(params, function (err, data) {
        if (err) {
            console.error("Unable to add device. Error JSON:", JSON.stringify(err, null, 2));
            context.fail();
        } else {
            console.log("Added device:", JSON.stringify(data, null, 2));
            context.succeed();
        }
    });
}