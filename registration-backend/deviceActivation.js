console.log('Loading function');

var AWS = require('aws-sdk');
var dynamo = new AWS.DynamoDB.DocumentClient();
const constants = require('./constants');
var table = constants.gatewayRegistryTableName;

exports.handler = function (event, context) {
    //console.log('Received event:', JSON.stringify(event, null, 2));

    var params = {
        TableName: table,
        Key: {
            "serialNumber": event.serialNumber,
            "clientId": event.clientId,
        }
    };

    console.log("Gettings IoT device details...");
    dynamo.get(params, function (err, data) {
        if (err) {
            console.error("Unable to get device details. Error JSON:", JSON.stringify(err, null, 2));
            context.fail();
        } else {
            console.log("Device data:", JSON.stringify(data, null, 2));
            console.log(data.Item.activationCode);
            if (data.Item.activationCode == event.activationCode) {
                console.log("Valid Activation Code! Proceed to register owner e-mail and update activation status");
                var params = {
                    TableName: table,
                    Key: {
                        "serialNumber": event.serialNumber,
                        "clientId": event.clientId,
                    },
                    UpdateExpression: "set email = :val1, activated = :val2",
                    ExpressionAttributeValues: {
                        ":val1": event.email,
                        ":val2": "true"
                    },
                    ReturnValues: "UPDATED\_NEW"
                };
                dynamo.update(params, function (err, data) {
                    if (err) {
                        console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                        context.fail();
                    } else {
                        console.log("Device now active!", JSON.stringify(data, null, 2));
                        context.succeed("Device now active! Your e-mail is now registered as device owner, thank you for activating your Smart IoT Device!");
                    }
                });
            } else {
                context.fail("Activation Code Invalid");
            }
        }
    });
}