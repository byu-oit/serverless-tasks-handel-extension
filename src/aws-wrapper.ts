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

/**
 * This module exists because I haven't yet been able to figure out a way
 * to mock the AWS SDK when using Sinon and TypeScript. The 'aws-sdk-mock'
 * tool doesn't work in TypeScript, and I have yet to find out how to use
 * Sinon to mock the SDK when using promises.
 */

import * as AWS from 'aws-sdk';

const awsWrapper = {
    ecs: {
        describeClusters: (params: AWS.ECS.DescribeClustersRequest) => {
            const ecs = new AWS.ECS({ apiVersion: '2014-11-13' });
            return ecs.describeClusters(params).promise();
        },
        createCluster: (params: AWS.ECS.CreateClusterRequest) => {
            const ecs = new AWS.ECS({ apiVersion: '2014-11-13' });
            return ecs.createCluster(params).promise();
        }
    },
    lambda: {
        addPermission: (params: AWS.Lambda.AddPermissionRequest) => {
            const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
            return lambda.addPermission(params).promise();
        },
        getPolicy: (params: AWS.Lambda.GetPolicyRequest) => {
            const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
            return lambda.getPolicy(params).promise();
        }
    }
};

export default awsWrapper;
