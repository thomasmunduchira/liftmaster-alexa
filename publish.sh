rm index.zip
zip -r -X ./index.zip *
aws lambda update-function-code --function-name 'garageOpenerTest' --zip-file 'fileb://index.zip'
