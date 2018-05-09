/*
 *  @license
 *    Copyright 2018 Brigham Young University
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */
import * as AWS from 'aws-sdk';
import {
    AccountConfig,
    PreDeployContext,
    ServiceConfig,
    ServiceContext,
    ServiceDeployer,
    Tags,
    UnDeployContext
} from 'handel-extension-api';
import { DeployContext } from 'handel-extension-api';
import {
    deletePhases,
    deployPhase,
    handlebars,
    tagging
} from 'handel-extension-support';
import { ScheduledTasksServiceConfig } from './config-types';
import * as ecsCalls from './ecs-calls';

const SERVICE_NAME = 'ServerlessTasks';

export class ScheduledTasksService implements ServiceDeployer {

    public readonly consumedDeployOutputTypes = [
        'environmentVariables',
        'policies',
        'securityGroups'
    ];
    public readonly producedDeployOutputTypes = [];
    public readonly producedEventsSupportedServices = [];

    public readonly supportsTagging = true;

    public check(serviceContext: ServiceContext<ScheduledTasksServiceConfig>, dependenciesServiceContexts: Array<ServiceContext<ServiceConfig>>): string[] {
        const errors = [];
        const params = serviceContext.params;

        if (!params.schedule) {
            errors.push(`${SERVICE_NAME} - The 'schedule' parameter is required`);
        }

        return errors;
    }

    public async deploy(ownServiceContext: ServiceContext<ScheduledTasksServiceConfig>, ownPreDeployContext: PreDeployContext, dependenciesDeployContexts: DeployContext[]): Promise<DeployContext> {
        const stackName = ownServiceContext.stackName();
        // tslint:disable-next-line:no-console
        console.log(`${SERVICE_NAME} - Deploying Scheduled Tasks Service '${stackName}'`);

        await ecsCalls.createDefaultClusterIfNotExists();
        const s3ArtifactInfo = await this.uploadInvokerLambdaCode(ownServiceContext);
        const stackTags = tagging.getTags(ownServiceContext);
        const compiledTemplate = await this.getCompiledTemplate(stackName, ownServiceContext, dependenciesDeployContexts, s3ArtifactInfo, stackTags);
        const deployedStack = await deployPhase.deployCloudFormationStack(stackName, compiledTemplate, [], true, SERVICE_NAME, 30, stackTags);

        // tslint:disable-next-line:no-console
        console.log(`${SERVICE_NAME} - Finished Scheduled Tasks Service '${stackName}'`);
        return new DeployContext(ownServiceContext);
    }

    public unDeploy(ownServiceContext: ServiceContext<ScheduledTasksServiceConfig>): Promise<UnDeployContext> {
        return deletePhases.unDeployService(ownServiceContext, SERVICE_NAME);
    }

    private async uploadInvokerLambdaCode(serviceContext: ServiceContext<ScheduledTasksServiceConfig>): Promise<AWS.S3.ManagedUpload.SendData> {
        const s3FileName = `invoker-lambda.zip`;
        const pathToArtifact = `${__dirname}/invoker-lambda`;
        return deployPhase.uploadDeployableArtifactToHandelBucket(serviceContext, pathToArtifact, s3FileName);
    }

    private async getCompiledTemplate(stackName: string, serviceContext: ServiceContext<ScheduledTasksServiceConfig>, dependenciesDeployContexts: DeployContext[], s3ArtifactInfo: AWS.S3.ManagedUpload.SendData, tags: Tags): Promise<string> {
        const serviceParams = serviceContext.params;

        const handlebarsParams = {
            resourceName: stackName,
            policyStatements: deployPhase.getAllPolicyStatementsForServiceRole(serviceContext, [], dependenciesDeployContexts, true),
            scheduleExpression: serviceParams.schedule,
            s3ArtifactBucket: s3ArtifactInfo.Bucket,
            s3ArtifactKey: s3ArtifactInfo.Key,
            tags,
            taskCpu: serviceParams.max_mb || 256,
            taskMemory: serviceParams.cpu_units || 512,
            imageName: this.getImageName(serviceContext),
            environmentVariables: deployPhase.getEnvVarsForDeployedService(serviceContext, dependenciesDeployContexts, serviceParams.environment_variables),
            workingDirMountPath: serviceParams.work_dir_path || '/mnt/share/task-workdir'
        };
        return handlebars.compileTemplate(`${__dirname}/scheduled-tasks-template.handlebars`, handlebarsParams);
    }

    private getImageName(ownServiceContext: ServiceContext<ScheduledTasksServiceConfig>): string {
        const serviceParams = ownServiceContext.params;
        const accountConfig = ownServiceContext.accountConfig;
        if (serviceParams.image_name) { // Custom user-provided image
            const customImageName = serviceParams.image_name;
            if (customImageName.startsWith('<account>')) { // Comes from own account registry
                const imageNameAndTag = customImageName.substring(9);
                return `${accountConfig.account_id}.dkr.ecr.${accountConfig.region}.amazonaws.com${imageNameAndTag}`;
            }
            else { // Must come from somewhere else (Docker Hub, Quay.io, etc.)
                return customImageName;
            }
        }
        else { // Else try to use default image name
            return `${accountConfig.account_id}.dkr.ecr.${accountConfig.region}.amazonaws.com/${ownServiceContext.appName}-${ownServiceContext.serviceName}:${ownServiceContext.environmentName}`;
        }
    }
}
