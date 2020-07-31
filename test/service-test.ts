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
import { expect } from 'chai';
import {
    AccountConfig,
    ConsumeEventsContext,
    DeployContext,
    PreDeployContext,
    ProduceEventsContext,
    ServiceContext,
    ServiceEventConsumer,
    ServiceType,
    UnDeployContext
} from 'handel-extension-api';
import { deletePhases, deployPhase } from 'handel-extension-support';
import 'mocha';
import * as sinon from 'sinon';
import { ScheduledTasksServiceConfig } from '../src/config-types';
import * as ecsCalls from '../src/ecs-calls';
import { ScheduledTasksService } from '../src/scheduled-tasks-service';
import accountConfig from './fake-account-config';
import accountConfigPermissionBoundary from './fake-account-config-permissions-boundary';

describe('sns service deployer', () => {
    let sandbox: sinon.SinonSandbox;
    let serviceContext: ServiceContext<ScheduledTasksServiceConfig>;
    let serviceParams: ScheduledTasksServiceConfig;
    const appName = 'FakeApp';
    const envName = 'FakeEnv';
    const serviceName = 'FakeService';
    const serviceType = 'sns';
    const tasksDeployer = new ScheduledTasksService();
    const accountConfigs = [accountConfig, accountConfigPermissionBoundary]

    accountConfigs.forEach(config => {
        describe(config.account_id, () => {
            beforeEach(async () => {
                serviceParams = {
                    type: serviceType,
                    schedule: 'some cron schedule'
                };
                serviceContext = new ServiceContext(appName, envName, serviceName, new ServiceType('snsExtension', serviceType), serviceParams, config);
                sandbox = sinon.sandbox.create();
            });

            afterEach(() => {
                sandbox.restore();
            });

            describe('check', () => {
                it('should return an empty list when all required params are present', () => {
                    const errors = tasksDeployer.check(serviceContext, []);
                    expect(errors).to.deep.equal([]);
                });

                it('should require the schedule parameter', () => {
                    delete serviceContext.params.schedule;
                    const errors = tasksDeployer.check(serviceContext, []);
                    expect(errors.length).to.equal(1);
                    expect(errors[0]).to.include(`'schedule' parameter is required`);
                });
            });

            describe('deploy', () => {
                it('should deploy the topic', async () => {
                    const topicName = 'FakeTopic';
                    const topicArn = 'FakeArn';
                    const ownPreDeployContext = new PreDeployContext(serviceContext);
                    ownPreDeployContext.securityGroups.push({
                        GroupId: 'FakeId'
                    });
                    const createClusterStub = sandbox.stub(ecsCalls, 'createDefaultClusterIfNotExists').resolves({});
                    const deployStackStub = sandbox.stub(deployPhase, 'deployCloudFormationStack').resolves({});
                    const uploadLambdaCodeStub = sandbox.stub(deployPhase, 'uploadDeployableArtifactToHandelBucket').resolves({
                        Bucket: 'FakeBucket',
                        Key: 'FakeKey'
                    });

                    const deployContext = await tasksDeployer.deploy(serviceContext, ownPreDeployContext, []);
                    expect(deployStackStub.callCount).to.equal(1);
                    expect(deployContext).to.be.instanceof(DeployContext);
                });
            });
        });
    })
})