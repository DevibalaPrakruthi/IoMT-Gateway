# IoMT-Gateway

A solution for implementing a healthcare-research-focused IoT data collection system in AWS.

## Components

This repository contains a few basic components:

* [`firmware-config/`](firmware-config/)
  * A set of scripts for registering new gateways and building custom Raspbian images containing the code to run the gateway.
* [`registration-backend/`](registration-backend/)
  * A set of Lambda functions for handling the registration of new gateways and storing of credentials in the DynamoDB tables.
* [`thing-activation-form/`](thing-activation-form/)
  * A static-hosted form for field technicians to use to activate a gateway (or other thing in the same registry).

## TODO

* [ ] Finish this readme :)
* [ ] Finish the registration stack
* [ ] Integrate with the scripts to build the Raspbian images