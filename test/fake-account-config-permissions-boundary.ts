import { AccountConfig } from 'handel-extension-api';

const accountConfig: AccountConfig = {
  account_id: 'New-Account',
  region: 'us-west-2',
  vpc: 'vpc-aaaaaaaa',
  public_subnets: [
    'subnet-ffffffff',
    'subnet-gggggggg'
  ],
  private_subnets: [
    'subnet-hhhhhhhh',
    'subnet-iiiiiiii'
  ],
  data_subnets: [
    'subnet-jjjjjjjj',
    'subnet-jjjjjjjj'
  ],
  ssh_bastion_sg: 'sg-23456789',
  elasticache_subnet_group: 'FakeGroupName',
  rds_subnet_group: 'FakeGroupName',
  redshift_subnet_group: 'FakeGroupName',
  permissions_boundary: 'FakePermissionsBoundaryArn'
};

export default accountConfig;
