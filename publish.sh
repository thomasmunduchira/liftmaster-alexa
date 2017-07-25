rm index.zip
zip -r -X ./index.zip *
aws lambda update-function-code --function-name 'garageOpener' --zip-file 'fileb://index.zip'
