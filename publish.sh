rm index.zip
zip -r -X ./index.zip *
# aws lambda update-function-code --function-name 'myqGarage' --region us-east-1 --zip-file 'fileb://index.zip' # uploads your zip file to Lambda function in US East through the AWS Command Line
# aws lambda update-function-code --function-name 'myqGarage' --region eu-west-1 --zip-file 'fileb://index.zip' # uploads your zip file to Lambda function in EU West through the AWS Command Line
