# lambda-s3-zip

Code to directly stream-and-zip a list of files from and to S3 from a lambda function. Copied from https://amiantos.net/zip-multiple-files-on-aws-s3/. 

## Deployment

### Requirements

- AWS CLI 2.*
- node 18.*

### Install dependencies, zip them and publish them as a lambda layer

Install node dependencies :

```
npm install
```

This installs the dependencies in a new `node_modules` folder. Zip that folder : 

```
zip layer_zip.zip node_modules/*
```

We create a lambda layer based on this, because it's unlikely to change often :

```
aws lambda publish-layer-version \
--layer-name "lambda-s3-zip-layer-node" \
--description "dependencies for lambda-s3-zip" \
--compatible-architectures "x86_64" \
--compatible-runtimes "nodejs18.x" \
--zip-file layer_zip.zip
```

Copy the `LayerVersionArn` from the terminal output. 

### Create the lambda role and zip the runtime. 

First, create a role for your function 

```
aws iam create-role --role-name lambda-s3-zip-role --assume-role-policy-document '{"Version": "2012-10-17","Statement": [{ "Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}]}'
```

Update the lambda role so that it has full S3 access 

```
aws iam attach-role-policy \
--role-name lambda-s3-zip-role \
--policy-arn "arn:aws:iam::aws:policy/AmazonS3FullAccess"
```

Now you can create the function on the console, reusing the layer and the role created above. Once the function is created, edit its runtime code on the console, by adding the `index.js` file in this repository. 


## Usage

You can test the function on the console with a "test" that uses `example_input.json`.