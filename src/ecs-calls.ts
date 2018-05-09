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
import awsWrapper from './aws-wrapper';

export async function getCluster(clusterName: string): Promise<AWS.ECS.Cluster | null> {
    const params = {
        clusters: [clusterName]
    };
    const describeResponse = await awsWrapper.ecs.describeClusters(params);
    if (!describeResponse.clusters || describeResponse.clusters.length === 0) {
        return null;
    }
    else {
        return describeResponse.clusters[0];
    }
}

export async function createDefaultClusterIfNotExists(): Promise<AWS.ECS.Cluster | null> {
    const cluster = await getCluster('default');
    if (!cluster) {
        const createResponse = await awsWrapper.ecs.createCluster({});
        if (createResponse.cluster) {
            return createResponse.cluster;
        }
        else {
            return null;
        }
    }
    else {
        return cluster;
    }
}
