const AWS = require('aws-sdk');
const path = require('path');
const constants = require('./constants');
const aws_config_path = path.join(__dirname, 'credentials', 'aws-sdk', 'awsConfig.json');
const action_config_path = path.join(__dirname, 'credentials', 'aws-sdk', 'actionConfig.json');

AWS.config.loadFromPath(aws_config_path);
const fs = require('fs');
const action_config = JSON.parse(String(fs.readFileSync(action_config_path)));
let iot = new AWS.Iot({
    endpoint: action_config.iotSdkEndpoint,
    region: action_config.region
});
let sts = new AWS.STS();

function attachPolicies(thingName, thingNumber, credentials, callback) {

    //Replace it with the AWS region the lambda will be running in
    const region = action_config.region;

    // var params = {};
    // sts.getCallerIdentity(params, function (err, data) {
    //     if (err) console.log("get caller identity error:",err, err.stack); // an error occurred
    //     else {
    // console.log(data); // successful response
    // const accountId = data.Account;
    const accountId = action_config.accountId;

    // var iot = new AWS.Iot({ 'region': region, apiVersion: '2015-05-28' });
    const certificateId = credentials.certificateId;

    //Replace it with your desired topic prefix
    const topicName = `${constants.team}/${constants.study}/${constants.type}/${thingNumber}`;

    const certificateARN = credentials.certificateArn;
    // console.log(JSON.stringify(credentials));
    console.log("certificateARN: " + certificateARN);
    const policyName = `Policy_${thingName}`;



    //Policy that allows connect, publish, subscribe and receive
    var policy = {
        "Version": "2012-10-17",
        "Statement": [{
                "Effect": "Allow",
                "Action": [
                    "iot:Connect"
                ],
                "Resource": `arn:aws:iot:${region}:${accountId}:client/${certificateId}`
            },
            {
                "Effect": "Allow",
                "Action": [
                    "iot:Publish",
                    "iot:Receive"
                ],
                "Resource": `arn:aws:iot:${region}:${accountId}:topic/${topicName}/*`
            }
        ]
    };

    /*
    Step 1) Create a policy
    */
    const create_policy_params = {
        policyDocument: JSON.stringify(policy),
        policyName: policyName
    };
    // console.log("create_policy_params", create_policy_params);

    iot.createPolicy(create_policy_params, (err, data) => {
        //Ignore if the policy already exists
        if (err && (!err.code || err.code !== 'ResourceAlreadyExistsException')) {
            console.log("create policy error:", err);
            callback(err, data);
            return;
        }
        console.log("create policy success:", data);

        /*
        Step 2) Attach the policy to the certificate
        */
        const attach_principle_policy_params = {
            policyName: policyName,
            principal: certificateARN
        };
        // console.log("attach_principle_policy_params:", attach_principle_policy_params);
        iot.attachPrincipalPolicy(attach_principle_policy_params, (err, data) => {
            //Ignore if the policy is already attached
            if (err && (!err.code || err.code !== 'ResourceAlreadyExistsException')) {
                console.log("attach principle error:", err);
                callback(err, data);
                return;
            }
            console.log("attach principle success:", data);
            const attach_thing_principle_params = {
                principal: certificateARN,
                thingName: thingName
            };
            iot.attachThingPrincipal(attach_thing_principle_params, (err, data) => {
                if (err) {
                    console.log("attachThingPrincipal error:", err, err.stack);
                    callback(err, data);
                } else {
                    callback(null, { credentials: credentials, policy: policy });
                }    
            });

        });
    });
    //     }
    // });
}

function generateCredentials(args, callback) {
    if (!("thingName" in args) || !("thingNumber" in args)) {
        const err = new Error("InvalidArgumentError: Parameter 'args' must contain indexes \"thingName\" and \"thingNumber\"");
        callback(err, {});
    }
    var params = {
        setAsActive: false
    };
    // var emitter = 
    iot.createKeysAndCertificate(params, function (err, credentials) {
        if (err) {
            console.log("create keys error:", err.stack); // an error occurred
            callback(err, {});
        } else {
            // console.log("created key:", data); // successful response
            // response.credentials = data;
            attachPolicies(args.thingName, args.thingNumber, credentials, function (err, data) {
                if (err) {
                    console.log("attach policies error:", err.stack); // an error occurred
                    callback(err, {});
                } else {
                    // console.log("attached policies:", policy_data);
                    callback(null, data);
                }
            });
        }
    });

}

exports.new = generateCredentials;