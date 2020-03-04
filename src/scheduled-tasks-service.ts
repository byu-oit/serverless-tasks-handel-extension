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
    DeployOutputType,
    PreDeployContext,
    ServiceConfig,
    ServiceContext,
    ServiceDeployer,
    ServiceEventType,
    Tags,
    UnDeployContext,
    UnPreDeployContext
} from 'handel-extension-api';
import { DeployContext } from 'handel-extension-api';
import {
    awsCalls,
    deletePhases,
    deployPhase,
    handlebars,
    preDeployPhase,
    tagging
} from 'handel-extension-support';
import { ScheduledTasksServiceConfig } from './config-types';
import * as ecsCalls from './ecs-calls';

const SERVICE_NAME = 'ServerlessTasks';

function getDeployContext(serviceContext: ServiceContext<ScheduledTasksServiceConfig>, cfStack: AWS.CloudFormation.Stack): DeployContext {
    const deployContext = new DeployContext(serviceContext);
    const invokerLambdaArn = awsCalls.cloudFormation.getOutput('FunctionArn', cfStack);
    const invokerLambdaName = awsCalls.cloudFormation.getOutput('FunctionName', cfStack);
    if(!invokerLambdaArn || !invokerLambdaName) {
        throw new Error('Expected to receive invoker lambda name and invoker lambda ARN from invoker lambda service');
    }

    // Output policy for consuming this Lambda
    deployContext.policies.push({
        'Effect': 'Allow',
        'Action': [
            'lambda:InvokeFunction',
            'lambda:InvokeAsync'
        ],
        'Resource': [
            invokerLambdaArn
        ]
    });

    // Inject env vars
    deployContext.addEnvironmentVariables({
        FUNCTION_ARN: invokerLambdaArn,
        FUNCTION_NAME: invokerLambdaName
    });

    // Inject event outputs
    deployContext.eventOutputs = {
        resourceArn: invokerLambdaArn,
        resourceName: invokerLambdaName,
        resourcePrincipal: 'lambda.amazonaws.com',
        serviceEventType: ServiceEventType.Lambda
    };

    return deployContext;
}

export class ScheduledTasksService implements ServiceDeployer {

    public readonly consumedDeployOutputTypes = [
        DeployOutputType.EnvironmentVariables,
        DeployOutputType.Policies,
        DeployOutputType.SecurityGroups
    ];
    public readonly providedEventType = null;
    public readonly producedDeployOutputTypes = [];
    public readonly producedEventsSupportedTypes = [];

    public readonly supportsTagging = true;

    public check(serviceContext: ServiceContext<ScheduledTasksServiceConfig>, dependenciesServiceContexts: Array<ServiceContext<ServiceConfig>>): string[] {
        const errors = [];
        const params = serviceContext.params;

        if (!params.schedule) {
            errors.push(`${SERVICE_NAME} - The 'schedule' parameter is required`);
        }

        return errors;
    }

    public async preDeploy(serviceContext: ServiceContext<ScheduledTasksServiceConfig>): Promise<PreDeployContext> {
        return preDeployPhase.preDeployCreateSecurityGroup(serviceContext, null, SERVICE_NAME);
    }

    public async deploy(ownServiceContext: ServiceContext<ScheduledTasksServiceConfig>, ownPreDeployContext: PreDeployContext, dependenciesDeployContexts: DeployContext[]): Promise<DeployContext> {
        const stackName = ownServiceContext.stackName();
        // tslint:disable-next-line:no-console
        console.log(`${SERVICE_NAME} - Deploying Scheduled Tasks Service '${stackName}'`);

        await ecsCalls.createDefaultClusterIfNotExists();
        const s3ArtifactInfo = await this.uploadInvokerLambdaCode(ownServiceContext);
        const stackTags = tagging.getTags(ownServiceContext);
        const compiledTemplate = await this.getCompiledTemplate(ownServiceContext.resourceName(), ownServiceContext, ownPreDeployContext, dependenciesDeployContexts, s3ArtifactInfo, stackTags);
        const deployedStack = await deployPhase.deployCloudFormationStack(ownServiceContext, stackName, compiledTemplate, [], true, 30, stackTags);

        // tslint:disable-next-line:no-console
        console.log(`${SERVICE_NAME} - Finished Scheduled Tasks Service '${stackName}'`);
        return getDeployContext(ownServiceContext, deployedStack);
    }

    public unDeploy(ownServiceContext: ServiceContext<ScheduledTasksServiceConfig>): Promise<UnDeployContext> {
        return deletePhases.unDeployService(ownServiceContext, SERVICE_NAME);
    }

    public unPreDeploy(ownServiceContext: ServiceContext<ScheduledTasksServiceConfig>): Promise<UnPreDeployContext> {
        return deletePhases.unPreDeploySecurityGroup(ownServiceContext, SERVICE_NAME);
    }

    private async uploadInvokerLambdaCode(serviceContext: ServiceContext<ScheduledTasksServiceConfig>): Promise<AWS.S3.ManagedUpload.SendData> {
        const s3FileName = `invoker-lambda.zip`;
        const pathToArtifact = `${__dirname}/invoker-lambda`;
        return deployPhase.uploadDeployableArtifactToHandelBucket(serviceContext, pathToArtifact, s3FileName);
    }

    private async getCompiledTemplate(resourceName: string, serviceContext: ServiceContext<ScheduledTasksServiceConfig>, preDeployContext: PreDeployContext, dependenciesDeployContexts: DeployContext[], s3ArtifactInfo: AWS.S3.ManagedUpload.SendData, tags: Tags): Promise<string> {
        const serviceParams = serviceContext.params;
        const accountConfig = serviceContext.accountConfig;

        const handlebarsParams = {
            resourceName,
            policyStatements: deployPhase.getAllPolicyStatementsForServiceRole(serviceContext, [], dependenciesDeployContexts, true),
            scheduleExpression: serviceParams.schedule,
            s3ArtifactBucket: s3ArtifactInfo.Bucket,
            s3ArtifactKey: s3ArtifactInfo.Key,
            tags,
            taskCpu: serviceParams.cpu_units || 256,
            taskMemory: serviceParams.max_mb || 512,
            imageName: this.getImageName(serviceContext),
            subnetId: accountConfig.private_subnets[0],
            securityGroupId: preDeployContext.securityGroups[0].GroupId,
            environmentVariables: deployPhase.getEnvVarsForDeployedService(serviceContext, dependenciesDeployContexts, serviceParams.environment_variables),
            workingDirMountPath: serviceParams.work_dir_path || '/mnt/share/task-workdir'
        };
        return handlebars.compileTemplate(`${__dirname}/scheduled-tasks-template.yml`, handlebarsParams);
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
