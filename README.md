# Serverless Tasks Handel Extension
This repository contains a Handel extension that provides serverless scheduled tasks using ECS Fargate.

# Motivation
As of Jun. 2018, Fargate doesn't have built-in support for scheduled tasks. You can accomplish this with CloudWatch Events, Lambda, and Fargate working in concert. 

The above setup works great, but it requires quite a bit of CloudFormation, particularly when wiring the permissions together properly.

This Handel extension aims to provide that functionality with only a line or two of configuration.

# Usage
To use this extension, add it to the `extensions` section of your Handel file, and then add the `scheduledtask` service to your environment:

```yaml
version: 1

name: schedtask-example

extensions: # This tells Handel to import this extension
  tasks: serverless-tasks-handel-extension # This is the NPM package name of this extension

environments:
  dev:
    task:
      type: tasks::scheduledtask # You must use the <extensionName>::<serviceType> syntax here
      schedule: rate(1 minute) # Required. See https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html for what to put here
      image_name: dsw88/handel-scheduled-task-example # Optional. The Docker image that should be executed as the task
      work_dir_path: '/mnt/share/workdir' # Optional. The directory where the task 8GB working directory should be mounted
```

That's all the configuration you need to do! Once you deploy this app using Handel, your task will execute on the schedule you've defined.

## Image Names
The `image_name` parameter can take several forms: 

If you want to pull a public image from somewhere like DockerHub, just reference the image name directly:
```
dsw88/handel-scheduled-task-example
```

If you want to reference an image in your AWS account’s EC2 Container Registry (ECR), reference it like this:
```
# The <account> piece will be replaced with your account's long ECR repository name
<account>/handel-scheduled-task-example
```

If you don’t specify an image_name, this extension will automatically choose an image name for you based on your Handel naming information. It will use the following image naming pattern:
```
<appName>-<serviceName>-<containerName>:<environmentName>
```

For example, if you don’t specify an image_name in the above example Handel file, the image this extension will look for is the following:
```
schedtask-example-task:dev
```

## Working Directory
You are provided with a 4GB mounted volume in each task. This can be used as scratch space for your tasks. 

You can use the optional `work_dir_path` parameter to configure where this volume should be mounted in your container.

If you don't specify the `work_dir_path` parameter, this volume will be mounted at the following default location:
```
/mnt/share/task-workdir
```

**Be aware that this scratch space *does not* persist across tasks!**