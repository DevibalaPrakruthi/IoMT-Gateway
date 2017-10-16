# IoMT-Gateway

A solution for implementing a healthcare-research-focused IoT data collection system in AWS.

## Components

This repository contains a few basic components:

* [`iomt-gateway-firmware-config/`](iomt-gateway-firmware-config/)
  * A set of scripts for registering new gateways and building custom Raspbian images containing the code to run the gateway.
* [`iomt-gateway-registration-backend/`](iomt-gateway-registration-backend/)
  * A set of Lambda functions for handling the registration of new gateways and storing of credentials in the DynamoDB tables.

## TODO

* [ ] Finish this readme :)
* [ ] Finish the registration stack
* [ ] Integrate with the scripts to build the Raspbian images