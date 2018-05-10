/*
 * Copyright 2018 Brigham Young University
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import * as AWS from 'aws-sdk';

export async function getSubnet(subnetId: string): Promise<AWS.EC2.Subnet | null> {
    const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
    const describeParams = {
        SubnetIds: [subnetId]
    };

    try {
        const describeResponse = await ec2.describeSubnets(describeParams).promise();
        if (describeResponse.Subnets && describeResponse.Subnets[0]) {
            return describeResponse.Subnets[0];
        }
        else {
            return null;
        }
    }
    catch (err) {
        if (err.code === 'InvalidSubnetID.NotFound') { // The subnet doesn't exist
            return null;
        }
        throw err; // Don't handle any other errors
    }
}

export async function shouldAssignPublicIp(subnetId: string): Promise<boolean> {
    const subnet = await getSubnet(subnetId);
    if (!subnet) {
        throw new Error(`The given subnet '${subnetId}' could not be found`);
    }
    if (subnet.MapPublicIpOnLaunch) {
        return true;
    }
    return false;
}

export async function getVpcConfiguration(): Promise<AWS.ECS.AwsVpcConfiguration> {
    const subnet = process.env.FARGATE_SUBNET!;
    const securityGroup = process.env.FARGATE_SECURITY_GROUP!;
    const assignPublicIp = await shouldAssignPublicIp(subnet);
    return {
        subnets: [subnet],
        securityGroups: [securityGroup],
        assignPublicIp: assignPublicIp ? 'ENABLED' : 'DISABLED'
    };
}

/**
 * This function invokes the ECS Fargate task
 */
export async function handler(event: any, context: any) {
    // tslint:disable-next-line:no-console
    console.log('Starting scheduled Fargate task');
    try {
        // these are now defined inside the handler so the aws-sdk-mock will work correctly
        const ecs = new AWS.ECS({ apiVersion: '2014-11-13' });
        const runParams: AWS.ECS.RunTaskRequest = {
            taskDefinition: process.env.TASK_DEF_NAME!,
            count: 1,
            launchType: 'FARGATE',
            networkConfiguration: {
                awsvpcConfiguration: await getVpcConfiguration()
            }
        };
        const response = await ecs.runTask(runParams).promise();
        // tslint:disable-next-line:no-console
        console.log('Started scheduled Fargate task');
        return 'Finished';
    }
    catch (err) {
        // tslint:disable-next-line:no-console
        console.error('Error while starting task: ');
        // tslint:disable-next-line:no-console
        console.error(err);
        throw err;
    }
}
