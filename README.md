# Serverless Tasks Handel Extension
This repository contains a Handel extension that provides serverless scheduled tasks using ECS Fargate.

Currently, Fargate doesn't have great built-in support for scheduled tasks. You can accomplish this with CloudWatch Events, Lambda, and Fargate working in concert, but it requires quite a
bit of CloudFormation, particularly in the permission wiring.

