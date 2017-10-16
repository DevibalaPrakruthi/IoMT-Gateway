const AWS = require('aws-sdk');
const path = require('path');
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

function attachPolicies(credentials, callback) {

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
    const topicName = `thing/${certificateId}`;

    const certificateARN = credentials.certificateArn;
    // console.log(JSON.stringify(credentials));
    console.log("certificateARN: " + certificateARN);
    const policyName = `Policy_${certificateId}`;



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
            /*
            Step 3) Activate the certificate. Optionally, you can have your custom Certificate Revocation List (CRL) check
            logic here and ACTIVATE the certificate only if it is not in the CRL. Revoke the certificate if it is in the CRL
            */
            iot.updateCertificate({
                certificateId: certificateId,
                newStatus: 'ACTIVE'
            }, (err, data) => {
                if (err) {
                    console.log("update certificate error:", err, err.stack);
                    callback(err, data);
                } else {
                    console.log("certificate updated:", data);
                    callback(null, credentials);
                }
            });
        });
    });
    //     }
    // });
}

function generateCredentials(callback) {
    // var response = {};
    var params = {
        setAsActive: false
    };
    // var emitter = 
    iot.createKeysAndCertificate(params, function (err, data) {
        if (err) {
            console.log("create keys error:", err.stack); // an error occurred
            callback(err, {});
        } else {
            // console.log("created key:", data); // successful response
            // response.credentials = data;
            attachPolicies(data, function (err, policy_data) {
                if (err) {
                    console.log("attach policies error:", err.stack); // an error occurred
                    callback(err, {});
                } else {
                    // console.log("attached policies:", policy_data);
                    callback(false, data);
                }
            });
        }
    });

}

exports.new = generateCredentials;