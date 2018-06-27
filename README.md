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
      schedule: rate(1 minute) # See https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html for what to put here
      image_name: dsw88/handel-scheduled-task-example # The Docker image that should be executed as the task
```

That's all the configuration you need to do! Once you deploy this app using Handel, your task will execute on the schedule you've defined.
