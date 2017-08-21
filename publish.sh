rm index.zip
zip -r -X ./index.zip *
aws lambda update-function-code --function-name 'myqGarage' --region eu-west-1 --zip-file 'fileb://index.zip'
